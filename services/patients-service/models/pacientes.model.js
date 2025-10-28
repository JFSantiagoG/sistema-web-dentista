const db = require('../db/connection');

// ====== BUSCAR PACIENTES (tu código, levemente limpio) ======
async function buscarPacientes(q, page = 1) {
  const limite = 15;
  const offset = (page - 1) * limite;

  let query = `
    SELECT 
      id,
      nombre,
      apellido,
      email,
      telefono_principal,
      telefono_secundario
    FROM pacientes
  `;
  let params = [];

  if (q && q.trim()) {
    query += `
      WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono_principal LIKE ? OR telefono_secundario LIKE ?
    `;
    params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
  }

  query += ` ORDER BY apellido LIMIT ? OFFSET ?`;
  params.push(limite, offset);

  const [rows] = await db.query(query, params);

  // total para páginas
  const [totalRows] = await db.query(`
    SELECT COUNT(*) AS total FROM pacientes
    ${q && q.trim() ? `
      WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono_principal LIKE ? OR telefono_secundario LIKE ?
    ` : ''}
  `, q && q.trim() ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : []);

  const total = totalRows[0].total;
  const totalPaginas = Math.ceil(total / limite);

  return { pacientes: rows, totalPaginas };
}

const inList = (arr) => arr.map(() => '?').join(',');
async function getFormsSummary(pacienteId) {
  const conn = await db.getConnection();
  try {
    // 1) Paciente
    const [pacRows] = await conn.query('SELECT * FROM pacientes WHERE id=?', [pacienteId]);
    const paciente = pacRows[0];
    if (!paciente) return { paciente: null };

    // 2) Formularios (usa creado_por y fecha_creacion según tu esquema)
    const [forms] = await conn.query(
      `
      SELECT
        f.id, f.tipo_id, f.creado_por, f.estado, f.fecha_creacion,
        ft.nombre AS tipo
      FROM formulario f
      JOIN formulario_tipo ft ON ft.id = f.tipo_id
      WHERE f.paciente_id = ?
      ORDER BY f.fecha_creacion DESC
      `,
      [pacienteId]
    );

    const porTipo = {};
    for (const f of forms) (porTipo[f.tipo] ||= []).push(f);

    // 3) Mapa de doctores: formulario.creado_por (users.id) -> medicos.user_id
    let medMap = {};
    const userIds = [...new Set(forms.map(f => f.creado_por).filter(Boolean))];
    if (userIds.length) {
      const [medRows] = await conn.query(
        `
        SELECT m.user_id, CONCAT_WS(' ', COALESCE(m.nombre,''), COALESCE(m.apellido,'')) AS nombre_completo
        FROM medicos m
        WHERE m.user_id IN (${inList(userIds)})
        `,
        userIds
      );
      // clave: user_id (NO m.id)
      medMap = Object.fromEntries(medRows.map(m => [m.user_id, m.nombre_completo]));
    }

    // ====== Evoluciones – Fecha | Descripción | Doctor
    let evoluciones = [];
    if (porTipo['evolucion_clinica']?.length) {
      const evoForms = porTipo['evolucion_clinica'];
      const evoIds = evoForms.map(f => f.id);

      const [rows] = await conn.query(
        `SELECT d.formulario_id, d.fecha, d.tratamiento AS descripcion
         FROM formulario_evolucion_detalle d
         WHERE d.formulario_id IN (${inList(evoIds)})
         ORDER BY d.fecha DESC, d.id DESC`,
        evoIds
      );

      // doctor = medMap[form.creado_por]
      const creadoPorMap = Object.fromEntries(evoForms.map(f => [f.id, f.creado_por]));
      evoluciones = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        descripcion: r.descripcion || '—',
        doctor: medMap[creadoPorMap[r.formulario_id]] || '—'
      }));
    }

    // ====== Recetas – Fecha | Doctor | #Meds | Estado
    let recetas = [];
    if (porTipo['receta_medica']?.length) {
      const formsRecetas = porTipo['receta_medica']; // ya trae f.id, f.creado_por, f.estado
      const ids = formsRecetas.map(f => f.id);

      // Fechas de emisión por formulario
      const [rRows] = await conn.query(
        `SELECT formulario_id, fecha
        FROM formulario_receta
        WHERE formulario_id IN (${inList(ids)})
        ORDER BY fecha DESC`,
        ids
      );
      const fechaMap = Object.fromEntries(rRows.map(r => [r.formulario_id, r.fecha]));

      // Conteo de medicamentos por formulario
      const [cntRows] = await conn.query(
        `SELECT formulario_id, COUNT(*) AS meds_count
        FROM formulario_receta_medicamentos
        WHERE formulario_id IN (${inList(ids)})
        GROUP BY formulario_id`,
        ids
      );
      const medsCountMap = Object.fromEntries(cntRows.map(r => [r.formulario_id, r.meds_count]));

      // Armado final (doctor desde medMap por creado_por; si no hay, '—')
      recetas = formsRecetas.map(f => ({
        formulario_id: f.id,
        fecha: fechaMap[f.id] || null,
        doctor: medMap[f.creado_por] || '—',
        meds_count: medsCountMap[f.id] || 0,
        estado: f.estado || 'borrador'
      }))
      // ordena del más reciente por id (opcional)
      .sort((a, b) => b.formulario_id - a.formulario_id);
    }


    // ====== Presupuestos Dentales — Fecha | Total | Mensualidad | Meses
    let presupuestos = [];
    if (porTipo['presupuesto_dental']?.length) {
      const prIds = porTipo['presupuesto_dental'].map(f => f.id);

      // Cabecera: fecha (o fallback a fecha_creacion), total, total_mensual, meses
      const [hdr] = await conn.query(
        `
        SELECT 
          p.formulario_id,
          COALESCE(p.fecha, DATE(f.fecha_creacion)) AS fecha,
          p.total,
          p.total_mensual,
          p.meses
        FROM formulario_presupuesto_dental p
        JOIN formulario f ON f.id = p.formulario_id
        WHERE p.formulario_id IN (${inList(prIds)})
        ORDER BY COALESCE(p.fecha, DATE(f.fecha_creacion)) DESC, p.formulario_id DESC
        `,
        prIds
      );

      // Si falta total en cabecera, lo calculamos (dientes + generales)
      const missingTotals = hdr.filter(r => r.total == null);
      let totalsMap = {};
      if (missingTotals.length) {
        const ids = missingTotals.map(r => r.formulario_id);
        const [sumRows] = await conn.query(
          `
          SELECT x.formulario_id,
                IFNULL((SELECT SUM(costo) FROM formulario_presupuesto_dental_dientes d WHERE d.formulario_id = x.formulario_id), 0) +
                IFNULL((SELECT SUM(costo) FROM formulario_presupuesto_dental_generales g WHERE g.formulario_id = x.formulario_id), 0) AS total
          FROM formulario_presupuesto_dental x
          WHERE x.formulario_id IN (${inList(ids)})
          `,
          ids
        );
        totalsMap = Object.fromEntries(sumRows.map(r => [r.formulario_id, Number(r.total || 0)]));
      }

      presupuestos = hdr.map(r => ({
        formulario_id : r.formulario_id,
        fecha         : r.fecha,                                      // ← AHORA SÍ VIENE FECHA
        total         : r.total != null ? Number(r.total) : (totalsMap[r.formulario_id] ?? null),
        total_mensual : r.total_mensual != null ? Number(r.total_mensual) : null,
        meses         : r.meses ?? null
      }));
    }

// === Crear Diagnóstico Infantil ===
  async function crearDiagInfantil(req, res) {
    console.log('──────────────────────────────────────────────');
    console.log('📩 POST /patients/:id/diag-infantil');
    console.log('Auth header presente:', !!req.headers.authorization);
    console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });

    const pacienteId = Number(req.params.id || 0);
    if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

    const b = req.body || {};
    const fechaRegistro = b?.paciente?.fechaRegistro || null;  // 'YYYY-MM-DD'
    const numeroPaciente = b?.paciente?.numeroPaciente || String(pacienteId);

    const porDiente = Array.isArray(b?.odontograma) ? b.odontograma : [];
    const generales = Array.isArray(b?.tratamientosGenerales) ? b.tratamientosGenerales : [];

    const meses        = Number(b?.presupuesto?.meses ?? 1) || 1;
    const totalCosto   = Number(b?.presupuesto?.total ?? 0) || 0;
    const totalMensual = Number(b?.presupuesto?.mensualidad ?? (meses ? totalCosto/meses : 0)) || 0;

    if (!fechaRegistro) {
      return res.status(400).json({ error: 'fecha requerida' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      console.log('🔹 TX diag-infantil iniciada');

      // 1) tipo_id = diag_infantil
      const [tipoRows] = await conn.query(
        'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
        ['diag_infantil']
      );
      if (!tipoRows.length) {
        throw new Error('No existe tipo "diag_infantil"');
      }
      const tipoId = tipoRows[0].id;

      // 2) formulario
      const creadoPor = req.user?.id || null; // users.id
      const [formIns] = await conn.query(
        `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
        VALUES (?, ?, ?, 'borrador', NOW())`,
        [pacienteId, tipoId, creadoPor]
      );
      const formularioId = formIns.insertId;
      console.log('✔️ formulario insertado id =', formularioId);

      // 3) mapear users.id -> medicos.id (puede quedar NULL)
      let medicoId = null;
      if (creadoPor) {
        const [mRow] = await conn.query('SELECT id FROM medicos WHERE user_id = ? LIMIT 1', [creadoPor]);
        medicoId = mRow[0]?.id ?? null;
      }

      // 4) Cabecera formulario_diag_infantil
      // Guardamos snapshots en JSON:
      const tratamientosPorDienteJson = JSON.stringify(porDiente || []);
      const tratamientosGeneralesJson = JSON.stringify(generales || []);
      // opcional: un pequeño snapshot del “odontograma_json”
      const odontogramaJson = JSON.stringify({
        dientes: (porDiente || []).map(x => x?.diente).filter(Boolean)
      });

      await conn.query(
        `INSERT INTO formulario_diag_infantil
          (formulario_id, paciente_id, medico_id, fecha, numero_paciente,
          odontograma_json, tratamientos_por_diente_json, tratamientos_generales_json,
          meses, total_costo, total_mensual)
        VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
        [
          formularioId, pacienteId, medicoId, fechaRegistro, numeroPaciente,
          odontogramaJson, tratamientosPorDienteJson, tratamientosGeneralesJson,
          meses, totalCosto, totalMensual
        ]
      );
      console.log('✔️ cabecera diag-infantil insertada');

      // 5) Detalle por diente
      if (porDiente.length) {
        const vals = [];
        const params = [];
        porDiente.forEach(it => {
          vals.push('(?, ?, ?, ?)');
          params.push(
            formularioId,
            Number(it?.diente || 0) || 0,
            String(it?.tratamiento || ''),
            (it?.costo == null ? null : Number(it.costo))
          );
        });
        await conn.query(
          `INSERT INTO formulario_diag_infantil_detalle
            (formulario_id, diente, tratamiento, costo)
          VALUES ${vals.join(',')}`,
          params
        );
        console.log(`✔️ ${porDiente.length} filas detalle (por diente) insertadas`);
      }

      // 6) Detalle generales
      if (generales.length) {
        const vals = [];
        const params = [];
        generales.forEach(g => {
          vals.push('(?, ?, ?)');
          params.push(
            formularioId,
            String(g?.nombre || ''),
            (g?.costo == null ? null : Number(g.costo))
          );
        });
        await conn.query(
          `INSERT INTO formulario_diag_infantil_generales
            (formulario_id, tratamiento, costo)
          VALUES ${vals.join(',')}`,
          params
        );
        console.log(`✔️ ${generales.length} filas generales insertadas`);
      }

      await conn.commit();
      console.log('✅ TX confirmada (diag-infantil)');
      console.log('──────────────────────────────────────────────');
      return res.status(201).json({ ok: true, formulario_id: formularioId });

    } catch (err) {
      try { await conn.rollback(); } catch {}
      console.error('❌ crearDiagInfantil error:', err);
      console.log('──────────────────────────────────────────────');
      return res.status(500).json({ error: 'Error al crear diagnóstico infantil', detalle: err.message });
    } finally {
      conn.release();
    }
  }



// ====== Consentimiento Odontológico – Fecha | Procedimiento | Firmado
      let consentimiento_odontologico = [];
      if (porTipo['consentimiento_odontologico']?.length) {
        const ids = porTipo['consentimiento_odontologico'].map(f => f.id);
        if (ids.length) {
          const [rows] = await conn.query(
            `
            SELECT
              formulario_id,
              fecha,
              tratamiento AS procedimiento,
              (firma_paciente_at IS NOT NULL) AS firmado
            FROM formulario_consent_odont
            WHERE formulario_id IN (${inList(ids)})
            ORDER BY fecha DESC
            `,
            ids
          );
          consentimiento_odontologico = rows.map(r => ({
            formulario_id: r.formulario_id,
            fecha: r.fecha,
            procedimiento: r.procedimiento || '—',
            firmado: !!r.firmado
          }));
        }
      }

      // ====== Consentimiento Quirúrgico – Fecha | Intervención/Resumen | Firmado
      let consentimiento_quirurgico = [];
      if (porTipo['consentimiento_quirurgico']?.length) {
        const ids = porTipo['consentimiento_quirurgico'].map(f => f.id);
        const [rows] = await conn.query(
          `SELECT formulario_id,
                  fecha,
                  acuerdo_economico AS intervencion,           -- algo corto para mostrar
                  (CASE WHEN firma_paciente_at IS NOT NULL OR firma_medico_at IS NOT NULL THEN 1 ELSE 0 END) AS firmado
          FROM formulario_consent_quiro
          WHERE formulario_id IN (${inList(ids)})
          ORDER BY fecha DESC`,
          ids
        );
        consentimiento_quirurgico = rows.map(r => ({
          formulario_id: r.formulario_id,
          fecha: r.fecha,
          intervencion: r.intervencion || '—',
          firmado: !!r.firmado
        }));
      }


    // ====== Historia clínica
    let historia_clinica = [];
    if (porTipo['historia_clinica']?.length) {
      const ids = porTipo['historia_clinica'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, nombre_paciente, creado_en
         FROM formulario_historia_clinica
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY creado_en DESC`,
        ids
      );
      historia_clinica = rows;
    }

    // ====== Justificantes
    let justificantes = [];
    if (porTipo['justificante_medico']?.length) {
      const ids = porTipo['justificante_medico'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha_emision, procedimiento, dias_reposo
         FROM formulario_justificante
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha_emision DESC`,
        ids
      );
      justificantes = rows;
    }

    // ====== Odontograma final
    let odontograma_final = [];
    if (porTipo['odontograma_final']?.length) {
      const ids = porTipo['odontograma_final'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT o.formulario_id, o.fecha_termino,
                (SELECT COUNT(*) FROM formulario_odontograma_final_detalle d WHERE d.formulario_id=o.formulario_id) AS t_count,
                (SELECT COUNT(*) FROM formulario_odontograma_final_encia e WHERE e.formulario_id=o.formulario_id) AS e_count
         FROM formulario_odontograma_final o
         WHERE o.formulario_id IN (${inList(ids)})
         ORDER BY o.fecha_termino DESC`,
        ids
      );
      odontograma_final = rows;
    }

    // ====== Ortodoncia
    let ortodoncia = [];
    if (porTipo['historia_ortodoncia']?.length) {
      const ids = porTipo['historia_ortodoncia'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha_ingreso, fecha_alta
         FROM formulario_ortodoncia
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha_ingreso DESC`,
        ids
      );
      ortodoncia = rows;
    }

    // ====== CREAR EVOLUCIÓN CLÍNICA ======
    async function crearEvolucion(pacienteId, body, user = {}) {
      const conn = await db.getConnection();
      try {
        console.log('🔹 Transacción iniciada');
        await conn.beginTransaction();

        // tipo_id
        const tipoNombre = 'evolucion_clinica';
        const tipoId = await getTipoIdByName(conn, tipoNombre);
        console.log('✔️ tipo_id:', tipoId);

        // Insertar en formulario
        const [resForm] = await conn.query(
          `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
          VALUES (?, ?, ?, 'completo', NOW())`,
          [pacienteId, tipoId, user.id || null]
        );
        const formularioId = resForm.insertId;
        console.log('✔️ formulario insertado id=', formularioId);

        // Médico
        let medicoId = null;
        if (user?.id) {
          const [medRows] = await conn.query(
            'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
            [user.id]
          );
          medicoId = medRows.length ? medRows[0].id : null;
          console.log(`users.id = ${user.id} → medicos.id = ${medicoId ?? '—'}`);
        }

        // Cabecera en formulario_evolucion
        const numeroPaciente = String(pacienteId);
        const fechaRegistro = body.fecha_registro || null;
        const evolJSON = JSON.stringify(body.evoluciones || []);

        await conn.query(
          `INSERT INTO formulario_evolucion
          (formulario_id, paciente_id, medico_id, numero_paciente, fecha_registro, evoluciones_json, firma_paciente_at)
          VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), NULL)`,
          [formularioId, pacienteId, medicoId, numeroPaciente, fechaRegistro, evolJSON]
        );
        console.log('✔️ cabecera de evolución insertada');

        // Detalles
        const det = body.evoluciones || [];
        if (!det.length) throw new Error('evoluciones[] vacío');

        let count = 0;
        for (const e of det) {
          await conn.query(
            `INSERT INTO formulario_evolucion_detalle
            (formulario_id, fecha, tratamiento, costo, ac, proxima_cita_tx)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              formularioId,
              e.fecha || null,
              e.tratamiento || null,
              e.costo != null ? Number(e.costo) : null,
              e.ac || null,
              e.proxima || null
            ]
          );
          count++;
          console.log(`   🧾 [${count}] ${e.fecha} | ${e.tratamiento ?? '—'}`);
        }
        console.log(`✔️ ${count} evoluciones insertadas`);

        await conn.commit();
        console.log('✅ Transacción confirmada');
        console.log('──────────────────────────────────────────────');

        return { formulario_id: formularioId };
      } catch (err) {
        try { await conn.rollback(); } catch {}
        console.error('❌ Transacción revertida por error:', err);
        console.log('──────────────────────────────────────────────');
        throw err;
      } finally {
        conn.release();
      }
    }

    // ====== Diagnóstico Infantil ======
    let diag_infantil = [];
    if (porTipo['diag_infantil']?.length) {
      const ids = porTipo['diag_infantil'].map(f => f.id);

      // Cabecera
      const [hdr] = await conn.query(
        `
        SELECT 
          d.formulario_id,
          d.fecha,
          d.meses,
          d.total_costo,
          d.total_mensual
        FROM formulario_diag_infantil d
        WHERE d.formulario_id IN (${inList(ids)})
        ORDER BY d.fecha DESC
        `,
        ids
      );

      // Conteos
      const [cntD] = await conn.query(
        `SELECT formulario_id, COUNT(*) AS t_count
        FROM formulario_diag_infantil_detalle
        WHERE formulario_id IN (${inList(ids)})
        GROUP BY formulario_id`,
        ids
      );
      const [cntG] = await conn.query(
        `SELECT formulario_id, COUNT(*) AS g_count
        FROM formulario_diag_infantil_generales
        WHERE formulario_id IN (${inList(ids)})
        GROUP BY formulario_id`,
        ids
      );

      const tCountMap = Object.fromEntries(cntD.map(r => [r.formulario_id, r.t_count]));
      const gCountMap = Object.fromEntries(cntG.map(r => [r.formulario_id, r.g_count]));
      const hdrMap = Object.fromEntries(hdr.map(r => [r.formulario_id, r]));

      diag_infantil = ids.map(fid => {
        const h = hdrMap[fid] || {};
        return {
          formulario_id: fid,
          fecha: h.fecha || null,
          meses: h.meses != null ? Number(h.meses) : null,
          total_costo: h.total_costo != null ? Number(h.total_costo) : null,
          total_mensual: h.total_mensual != null ? Number(h.total_mensual) : null,
          t_count: tCountMap[fid] || 0,
          g_count: gCountMap[fid] || 0
        };
      });
    }

    return {
      paciente,
      evoluciones,
      recetas,
      presupuestos,
      consentimiento_odontologico,
      consentimiento_quirurgico,
      historia_clinica,
      justificantes,
      odontograma_final,
      crearEvolucion,
      crearDiagInfantil,
      diag_infantil,
      ortodoncia
    };
  } finally {
    conn.release();
  }
}
async function getPatientStudies(pacienteId) {
  const [rows] = await db.query(
    `SELECT
       id,
       paciente_id,
       tipo,
       nombre_archivo,
       storage_path,
       size_bytes,
       mime_type,
       fecha_subida,
       notas
     FROM patient_files
     WHERE paciente_id = ?
     ORDER BY fecha_subida DESC, id DESC`,
    [pacienteId]
  );
  return rows;
}


  async function insertPaciente(data) {
    const {
      nombre,
      apellido,
      sexo,
      fecha_nacimiento, // 'YYYY-MM-DD' o null
      edad,             // number o null
      email,
      estado_civil,
      telefono_principal,
      telefono_secundario,
      domicilio,
      ocupacion
    } = data;

    const sql = `
      INSERT INTO pacientes
        (nombre, apellido, sexo, fecha_nacimiento, edad, email,
        telefono_principal, telefono_secundario, domicilio, estado_civil, ocupacion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      nombre || null,
      apellido || null,
      sexo || null,
      (fecha_nacimiento || null),
      (Number.isFinite(edad) ? edad : null),
      (email || null),
      telefono_principal || null,
      (telefono_secundario || null),
      (domicilio || null),
      (estado_civil || null),
      (ocupacion || null),
    ];

    const [res] = await db.query(sql, params);
    return res.insertId;
  }


module.exports = { buscarPacientes, getFormsSummary, getPatientStudies, insertPaciente };