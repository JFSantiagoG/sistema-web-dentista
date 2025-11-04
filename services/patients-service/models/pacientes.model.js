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

 // === INSERT patient_files ===
async function insertPatientFile({
  paciente_id,
  tipo,
  nombre_archivo, // <- SOLO el nombre hasheado
  storage_path,   // <- ruta pública servible por el gateway/visualizador
  size_bytes,
  mime_type,
  notas
}) {
  // Inserta el registro
  const [result] = await db.query(
    `INSERT INTO patient_files
      (paciente_id, tipo, nombre_archivo, storage_path, size_bytes, mime_type, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [paciente_id, tipo, nombre_archivo, storage_path, size_bytes ?? null, mime_type ?? null, notas ?? null]
  );

  // Retorna el row insertado (incluye fecha_subida autogenerada)
  const [rows] = await db.query(
    `SELECT id, paciente_id, tipo, nombre_archivo, storage_path,
            size_bytes, mime_type, fecha_subida, notas
       FROM patient_files
      WHERE id = ?`,
    [result.insertId]
  );

  return rows[0];
}

async function insertJustificante(pacienteId, medicoId, data) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Insertar folio en tabla formulario
    const [formRes] = await conn.query(
      `INSERT INTO formulario (paciente_id, medico_id, tipo_id) VALUES (?, ?, 'justificante')`,
      [pacienteId, medicoId]
    );
    const formularioId = formRes.insertId;

    // Insertar datos del justificante
    await conn.query(
      `INSERT INTO justificante (formulario_id, fecha_emision, procedimiento, fecha_procedimiento, dias_reposo) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        formularioId,
        data.fechaEmision,
        data.procedimiento,
        data.fechaProcedimiento,
        data.diasReposo
      ]
    );

    await conn.commit();
    return { formulario_id: formularioId };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ✅ Obtener justificante por formulario_id
async function getJustificanteByFormId(formularioId) {
  const [rows] = await db.query(
    `SELECT 
        f.id AS formulario_id,
        j.paciente_id,
        j.nombre_paciente,
        j.fecha_emision,
        j.procedimiento,
        j.fecha_procedimiento,
        j.dias_reposo
     FROM formulario_justificante j
     INNER JOIN formulario f ON f.id = j.formulario_id
     WHERE j.formulario_id = ?
       AND f.eliminado_logico = 0
     LIMIT 1`,
    [formularioId]
  );
  return rows[0] || null;
}

async function getConsentQuiroById(formularioId) {
  const sql = `
    SELECT
      cq.formulario_id,
      cq.paciente_id,
      cq.fecha,
      cq.numero_paciente,

      -- Nombre completo construido solo con columnas existentes
      TRIM(CONCAT(COALESCE(p.nombre,''),' ',COALESCE(p.apellido,''))) AS paciente_nombre,

      cq.pronostico,
      cq.condiciones_posop,
      cq.recuperacion_dias,

      cq.historia_aceptada,
      cq.anestesia_consentida,
      cq.pronostico_entendido,
      cq.recuperacion_entendida,
      cq.responsabilidad_aceptada,
      cq.economico_aceptado,

      cq.acuerdo_economico,
      cq.firma_paciente_at,
      cq.firma_medico_at
    FROM formulario_consent_quiro cq
    INNER JOIN formulario f ON f.id = cq.formulario_id AND f.eliminado_logico = 0
    INNER JOIN pacientes  p ON p.id = cq.paciente_id
    WHERE cq.formulario_id = ?
    LIMIT 1
  `;
  const [rows] = await db.query(sql, [formularioId]);
  return rows[0] || null;
}

async function getOrtodonciaByFormId(formularioId) {
  const sql = `
    SELECT 
      fo.*,
      f.paciente_id,
      p.nombre AS paciente_nombre,
      p.apellido AS paciente_apellido,
      p.edad AS paciente_edad,
      CONCAT_WS(' ', COALESCE(m.nombre,''), COALESCE(m.apellido,'')) AS medico_nombre
    FROM formulario_ortodoncia fo
    JOIN formulario f ON fo.formulario_id = f.id
    LEFT JOIN pacientes p ON f.paciente_id = p.id
    LEFT JOIN medicos m   ON fo.medico_id = m.id
    WHERE fo.formulario_id = ?
    LIMIT 1
  `;

  const [rows] = await db.query(sql, [Number(formularioId)]);
  if (!rows.length) return null;

  const r = rows[0];

  // Helper robusto para parsear columnas JSON (pueden venir como string u objeto)
  const J = (v, fallback = []) => {
    if (v == null) return fallback;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return fallback; }
    }
    if (typeof v === 'object') return v;
    return fallback;
  };

  return {
    formularioId: r.formulario_id,
    paciente: {
      id: r.paciente_id,
      nombre: `${r.paciente_nombre || ''} ${r.paciente_apellido || ''}`.trim(),
      edad: r.paciente_edad ?? null
    },
    medico: r.medico_nombre || '—',

    nombrePaciente: r.nombre_paciente,
    fechaIngreso: r.fecha_ingreso,
    fechaAlta: r.fecha_alta,

    examenClinico: {
      tipoCuerpo: r.tipo_cuerpo,
      tipoCara: r.tipo_cara,
      tipoCraneo: r.tipo_craneo,
      otros: r.examen_otros
    },

    analisisFuncional: {
      respiracion: r.fun_respiracion,
      deglucion: r.fun_deglucion,
      masticacion: r.fun_masticacion,
      fonacion: r.fun_fonacion,
      problemasATM: r.atm_problemas_actuales,
      dolorATM: r.atm_dolor_si ? 'si' : 'no',
      ruidosATM: r.atm_ruidos_si ? 'si' : 'no',
      dolorPalpacion: r.atm_dolor_palpacion,
      aperturaMax: r.atm_max_apertura_mm,
      latIzq: r.atm_lateralidad_izq_mm,
      protrusion: r.atm_protrusion_mm,
      latDer: r.atm_lateralidad_der_mm,
      verticalOCRC: r.dis_ocrc_vertical_mm,
      horizontalOCRC: r.dis_ocrc_horizontal_mm,
      otrosOCRC: r.dis_ocrc_otro
    },

    analisisModelos: {
      relacionesDentarias: {
        oclusionMolaresDer: r.mod_ocl_molares_der_mm,
        oclusionMolaresIzq: r.mod_ocl_molares_izq_mm,
        oclusionCaninosDer: r.mod_ocl_caninos_der_mm,
        oclusionCaninosIzq: r.mod_ocl_caninos_izq_mm,
        resalteHorizontal: r.mod_resalte_horizontal_mm,
        resalteVertical: r.mod_resalte_vertical_mm,
        lineaMediaSup: r.mod_linea_media_sup_mm,
        lineaMediaInf: r.mod_linea_media_inf_mm,
        mordidaCruzadaDer: r.mod_mordida_cruzada_post_der_mm,
        mordidaCruzadaIzq: r.mod_mordida_cruzada_post_izq_mm
      },
      anomaliasDentarias: {
        dientesAusentes: r.mod_anom_ausentes,
        dientesMalformados: r.mod_anom_malformacion,
        dientesGiroversion: r.mod_anom_giroversion,
        dientesInfraversion: r.mod_anom_infraversion,
        dientesSupraversion: r.mod_anom_supraversion,
        dientesPigmentados: r.mod_anom_pigmentados
      },
      arcadasIndividuales: {
        arcadaSuperior: r.arcada_sup,
        arcadaInferior: r.arcada_inf
      }
    },

    indicesValorativos: {
      pontMaxilar: {
        premaxila:  { nc: r.pont_premaxila_nc,  pac: r.pont_premaxila_pac,  dif: r.pont_premaxila_dif },
        premolares: { nc: r.pont_premolares_nc, pac: r.pont_premolares_pac, dif: r.pont_premolares_dif },
        molares:    { nc: r.pont_molares_nc,    pac: r.pont_molares_pac,    dif: r.pont_molares_dif }
      },
      pontMandibular: {
        premolares: { pac: r.col_mand_premolares_pac, dif: r.col_mand_premolares_dif },
        molares:    { pac: r.col_mand_molares_pac,    dif: r.col_mand_molares_dif }
      },
      sumaIncisivos: r.suma_incisivos,
      boltonSuperiores: J(r.bolton_sup_json, []),
      boltonInferiores: J(r.bolton_inf_json, []),
      diferenciaBolton: r.bolton_dif_mm,
      longitudArco: {
        apinamiento:       r.long_apinamiento_mm,
        protrusionDental:  r.long_protrusion_dental_mm,
        curvaSpee:         r.long_curva_spee_mm,
        totalLongitud:     r.long_total_mm
      }
    },

    planTratamiento: {
      ortopediaMaxilar:  r.plan_ortopedia_maxilar,
      ortopediaMandibula:r.plan_ortopedia_mandibula,
      dientesInfIncisivo:r.plan_inf_incisivo,
      dientesInfMolar:   r.plan_inf_molar,
      dientesSupMolar:   r.plan_sup_molar,
      dientesSupIncisivo:r.plan_sup_incisivo,
      dientesSupEstetica:r.plan_sup_estetica,
      anclaje: {
        maxilar:   r.anclaje_max,
        mandibular:r.anclaje_man
      }
    },

    analisisCefalometrico: {
      biotipoFacial:        J(r.biotipo_facial_json),
      claseEsqueletica:     J(r.clase_esqueletica_json),
      problemasVerticales:  J(r.problemas_verticales_json),
      factoresDentales:     J(r.factores_dentales_json),
      diagnosticoCefalometrico: r.diagnostico
    },

    factoresComplementarios: {
      claseII:   J(r.clase_ii_json),
      claseIII:  J(r.clase_iii_json),
      verticales:J(r.compl_verticales_json)
    },

    analisisJaraback:   J(r.jaraback_json),
    medidasLineales:    J(r.medidas_lineales_json),
    analisisMcNamara:   J(r.mcnamara_json)
  };
}

async function getHistoriaByFormId(formularioId) {
  const [rows] = await db.query(
    `
    SELECT
      formulario_id,
      paciente_id,
      medico_id,
      nombre_paciente,
      domicilio,
      telefono,
      sexo,
      DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
      edad,
      estado_civil,
      ocupacion,
      motivo_consulta,

      -- JSON y flags
      antecedentes_patologicos,
      antecedentes_patologicos_json,
      tratamiento_medico_si,
      tratamiento_medico_cual,
      medicamento_si,
      medicamento_cual,
      problema_dental_si,
      problema_dental_cual,
      solo_mujeres_json,
      no_patologicos_json,
      antecedentes_familiares_json,

      -- Interrogatorio por sistemas
      sis_cardiovascular,
      sis_circulatorio,
      sis_respiratorio,
      sis_digestivo,
      sis_urinario,
      sis_genital,
      sis_musculoesqueletico,
      sis_snc,

      -- Exploración
      expl_cabeza_cuello_cara_perfil,
      expl_atm,
      expl_labios_frenillos_lengua_paladar_orofaringe_yugal,
      expl_piso_boca_glandulas_salivales_carrillos,
      expl_encias_procesos_alveolares,

      -- Otros
      observaciones,
      hallazgos,
      firma_paciente_at,
      creado_en,
      actualizado_en
    FROM formulario_historia_clinica
    WHERE formulario_id = ?
    LIMIT 1
    `,
    [formularioId]
  );
  return rows[0] || null;
}

async function getOdontogramaFinalByFormularioId(formularioId) {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT fof.*, f.estado, f.paciente_id,
              p.nombre, p.apellido
       FROM formulario_odontograma_final fof
       JOIN formulario f ON f.id = fof.formulario_id
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE fof.formulario_id = ? LIMIT 1`,
      [formularioId]
    );
    if (!rows.length) return null;
    const main = rows[0];

    const [det] = await conn.query(
      `SELECT diente, tratamiento
         FROM formulario_odontograma_final_detalle
        WHERE formulario_id = ?
        ORDER BY diente ASC, tratamiento ASC`,
      [formularioId]
    );

    const [enc] = await conn.query(
      `SELECT condicion, valoracion
         FROM formulario_odontograma_final_encia
        WHERE formulario_id = ?
        ORDER BY id ASC`,
      [formularioId]
    );

    // --- mapas ---
    const tratamientosPorDiente = {};
    for (const r of det) {
      const k = String(r.diente);
      if (!tratamientosPorDiente[k]) tratamientosPorDiente[k] = [];
      tratamientosPorDiente[k].push(r.tratamiento);
    }

    const estadoEncia = {};
    for (const e of enc) estadoEncia[e.condicion] = e.valoracion || '';

    // --- nombre paciente desde BD (fallback si no viene en fof.nombre_paciente) ---
    const nombrePacienteBD = [main.nombre, main.apellido].filter(Boolean).join(' ').trim();

    return {
      formulario_id: formularioId,
      estado: main.estado,
      paciente_id: main.paciente_id,
      paciente: main.nombre_paciente || nombrePacienteBD || '',
      fecha_termino: main.fecha_termino,
      datos: {
        tratamientos_por_diente: tratamientosPorDiente,
        estado_encia: estadoEncia,
        odontograma_json: main.odontograma_json,
        tratamientos_json: main.tratamientos_json,
      }
    };
  } finally {
    conn.release();
  }
}

async function getPresupuestoByFormIdModel(formularioId) {
  const conn = await db.getConnection();
  try {
    const [cab] = await conn.query(
      `SELECT fpd.*, f.estado, f.paciente_id, p.nombre, p.apellido
       FROM formulario_presupuesto_dental fpd
       JOIN formulario f ON f.id = fpd.formulario_id
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE fpd.formulario_id = ? LIMIT 1`,
      [formularioId]
    );
    if (!cab.length) return null;
    const h = cab[0];

    const [detDientes] = await conn.query(
      `SELECT diente, tratamiento, costo
       FROM formulario_presupuesto_dental_dientes
       WHERE formulario_id = ?
       ORDER BY id ASC`,
      [formularioId]
    );

    const [detGenerales] = await conn.query(
      `SELECT tratamiento AS nombre, costo
       FROM formulario_presupuesto_dental_generales
       WHERE formulario_id = ?
       ORDER BY id ASC`,
      [formularioId]
    );

    return {
      formulario_id: formularioId,
      estado: h.estado,
      paciente_id: h.paciente_id,
      paciente: [h.nombre, h.apellido].filter(Boolean).join(' '),
      fecha: h.fecha,
      datos: {
        meses: h.meses,
        total: Number(h.total || 0),
        mensualidad: Number(h.total_mensual || 0),
        odontograma: detDientes.map(r => ({
          diente: r.diente,
          tratamiento: r.tratamiento,
          costo: Number(r.costo || 0)
        })),
        tratamientosGenerales: detGenerales.map(g => ({
          nombre: g.nombre,
          costo: Number(g.costo || 0)
        }))
      }
    };
  } finally {
    conn.release();
  }
}

// =================== OBTENER POR FORMULARIO_ID ===================
async function getDiagInfantilByFormularioId(formularioId) {
  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `SELECT 
         fdi.formulario_id,
         DATE_FORMAT(fdi.fecha, '%Y-%m-%d') AS fecha,
         fdi.paciente_id,
         f.estado,
         fdi.numero_paciente,
         fdi.meses,
         fdi.total_costo,
         fdi.total_mensual,
         p.nombre, p.apellido
       FROM formulario_diag_infantil fdi
       JOIN formulario f ON f.id = fdi.formulario_id
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE fdi.formulario_id = ?
       LIMIT 1`,
      [formularioId]
    );
    if (!rows.length) return null;
    const main = rows[0];

    const [det] = await conn.query(
      `SELECT diente, tratamiento, IFNULL(costo,0) AS costo
       FROM formulario_diag_infantil_detalle
       WHERE formulario_id = ?
       ORDER BY diente ASC, tratamiento ASC`,
      [formularioId]
    );

    const [gen] = await conn.query(
      `SELECT tratamiento AS nombre, IFNULL(costo,0) AS costo
       FROM formulario_diag_infantil_generales
       WHERE formulario_id = ?
       ORDER BY id ASC`,
      [formularioId]
    );

    const nombrePaciente = [main.nombre, main.apellido].filter(Boolean).join(' ').trim();

    return {
      formulario_id: main.formulario_id,
      estado: main.estado,
      paciente_id: main.paciente_id,
      paciente: { id: main.paciente_id, nombre: nombrePaciente || '' },
      fecha: main.fecha, // yyyy-MM-dd para <input type="date">
      odontograma: det.map(r => ({
        diente: String(r.diente),
        tratamiento: r.tratamiento,
        costo: Number(r.costo || 0),
      })),
      tratamientosGenerales: gen.map(g => ({
        nombre: g.nombre,
        costo: Number(g.costo || 0),
      })),
      presupuesto: {
        meses: Number(main.meses || 1),
        total: Number(main.total_costo || 0),
        mensualidad: Number(main.total_mensual || 0),
      },
    };
  } finally {
    conn.release();
  }
}

async function getEvolucionCabeceraByFormId(formularioId) {
  const conn = await db.getConnection();
  try {
    // Ajusta nombres si tu cabecera tiene otro nombre de tabla/campos
    const [rows] = await conn.query(
      `SELECT fe.*, f.estado, f.paciente_id,
              p.nombre, p.apellido
       FROM formulario_evolucion fe
       JOIN formulario f ON f.id = fe.formulario_id
       LEFT JOIN pacientes p ON p.id = f.paciente_id
       WHERE fe.formulario_id = ?
       LIMIT 1`,
      [formularioId]
    );
    if (!rows.length) return null;

    // Normalizo el posible nombre del paciente si lo guardaste en cabecera
    const row = rows[0];
    if (!row.nombre_paciente) {
      const nom = [row.nombre, row.apellido].filter(Boolean).join(' ').trim();
      row.nombre_paciente = nom || null;
    }
    return row;
  } finally {
    conn.release();
  }
}

// ===============
// DETALLE
// ===============
async function getEvolucionDetalleByFormId(conn, formularioId) {
  const [rows] = await conn.query(
    `
      SELECT
        id,
        fecha,
        tratamiento,
        costo,
        ac,
        proxima_cita_tx
      FROM formulario_evolucion_detalle
      WHERE formulario_id = ?
      ORDER BY fecha ASC, id ASC
    `,
    [formularioId]
  );
  // Normaliza el nombre para el frontend
  return rows.map(r => ({
    id: r.id,
    fecha: r.fecha,
    tratamiento: r.tratamiento,
    costo: r.costo,
    ac: r.ac,
    proxima: r.proxima_cita_tx ?? null
  }));
}

async function appendEvolucionesDetalle(formularioId, evoluciones, userId = null) {
  if (!Array.isArray(evoluciones) || evoluciones.length === 0) return;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const rows = evoluciones.map(ev => ([
      Number(formularioId),
      (ev.fecha || '').slice(0,10),                                  // YYYY-MM-DD
      ev.tratamiento || null,
      (ev.costo !== undefined && ev.costo !== null && ev.costo !== '') ? Number(ev.costo) : null,
      ev.ac || null,
      ev.proxima || ev.proxima_cita_tx || null                       // map a proxima_cita_tx
    ]));

    await conn.query(
      `INSERT INTO formulario_evolucion_detalle
       (formulario_id, fecha, tratamiento, costo, ac, proxima_cita_tx)
       VALUES ?`,
      [rows]
    );

    await conn.query(
      `UPDATE formulario
         SET fecha_actualizacion = NOW(),
             actualizado_por = ?
       WHERE id = ?`,
      [userId, Number(formularioId)]
    );

    // Opcional: tocar cabecera específica
    // await conn.query(`UPDATE formulario_evolucion SET actualizado_en = NOW() WHERE formulario_id = ?`, [Number(formularioId)]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
async function getEvolucionSummaryForPatient(pacienteId, conn) {
  const sql = `
    SELECT
      f.id                       AS formulario_id,
      f.paciente_id,
      fe.fecha_registro,
      MIN(d.fecha)              AS primera_fecha,
      MAX(d.fecha)              AS ultima_fecha,
      COUNT(d.id)               AS entradas
    FROM formulario f
    JOIN formulario_tipo ft        ON ft.id = f.tipo_id AND (ft.clave = 'evolucion' OR ft.nombre LIKE '%evoluci%')
    JOIN formulario_evolucion fe   ON fe.formulario_id = f.id
    LEFT JOIN formulario_evolucion_detalle d ON d.formulario_id = f.id
    WHERE f.paciente_id = ?
      AND f.eliminado_logico = 0
    GROUP BY f.id, f.paciente_id, fe.fecha_registro
    ORDER BY f.fecha_actualizacion DESC
    LIMIT 1
  `;
  const [rows] = await (conn || pool).query(sql, [pacienteId]);
  return rows[0] || null;
}


module.exports = { 
  buscarPacientes, 
  getFormsSummary, 
  getPatientStudies, 
  insertPaciente, 
  insertPatientFile, 
  insertJustificante, 
  getJustificanteByFormId,
  getConsentQuiroById,
  getOrtodonciaByFormId,
  getHistoriaByFormId,
  getOdontogramaFinalByFormularioId,
  getPresupuestoByFormIdModel,
  getDiagInfantilByFormularioId,
  getEvolucionCabeceraByFormId,
  getEvolucionDetalleByFormId,
  appendEvolucionesDetalle,
  getEvolucionSummaryForPatient,
};