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


    // ====== Presupuestos (legacy) – Fecha | Tratamiento | Costo
    let presupuestos = [];
    if (porTipo['presupuesto_dental']?.length) {
      const prIds = porTipo['presupuesto_dental'].map(f => f.id);

      const [firstRows] = await conn.query(
        `SELECT d.formulario_id,
                (SELECT MIN(id) FROM formulario_presupuesto_dental_dientes x WHERE x.formulario_id=d.formulario_id) AS minid
         FROM formulario_presupuesto_dental_dientes d
         WHERE d.formulario_id IN (${inList(prIds)})
         GROUP BY d.formulario_id`,
        prIds
      );
      const minIds = firstRows.map(r => r.minid).filter(Boolean);

      let byId = {};
      if (minIds.length) {
        const [detRows] = await conn.query(
          `SELECT id, formulario_id, tratamiento, costo
           FROM formulario_presupuesto_dental_dientes
           WHERE id IN (${inList(minIds)})`,
          minIds
        );
        byId = Object.fromEntries(detRows.map(r => [r.formulario_id, r]));
      }

      const [totRows] = await conn.query(
        `SELECT d.formulario_id,
                (SELECT IFNULL(SUM(costo),0) FROM formulario_presupuesto_dental_dientes WHERE formulario_id=d.formulario_id) +
                (SELECT IFNULL(SUM(costo),0) FROM formulario_presupuesto_dental_generales WHERE formulario_id=d.formulario_id) AS total
         FROM formulario_presupuesto_dental d
         WHERE d.formulario_id IN (${inList(prIds)})`,
        prIds
      );
      const totalMap = Object.fromEntries(totRows.map(r => [r.formulario_id, r.total]));

      presupuestos = prIds.map(id => ({
        formulario_id: id,
        fecha: null,
        tratamiento: byId[id]?.tratamiento || '—',
        costo: byId[id]?.costo ?? totalMap[id] ?? null
      }));
    }

    // ====== Consentimiento Odontológico – Fecha | Procedimiento | Firmado
    let consentimiento_odontologico = [];
    if (porTipo['consentimiento_odontologico']?.length) {
      const ids = porTipo['consentimiento_odontologico'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha, tratamiento AS procedimiento, firma_path
         FROM formulario_consent_odont
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha DESC`,
        ids
      );
      consentimiento_odontologico = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        procedimiento: r.procedimiento || '—',
        firmado: !!r.firma_path
      }));
    }

    // ====== Consentimiento Quirúrgico – Fecha | Intervención | Firmado
    let consentimiento_quirurgico = [];
    if (porTipo['consentimiento_quirurgico']?.length) {
      const ids = porTipo['consentimiento_quirurgico'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha, intervencion, firma_path
         FROM formulario_consent_quiro
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha DESC`,
        ids
      );
      consentimiento_quirurgico = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        intervencion: r.intervencion || '—',
        firmado: !!r.firma_path
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

module.exports = { buscarPacientes, getFormsSummary, getPatientStudies };