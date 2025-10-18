const db = require('../db/connection'); // db es tu pool/conn pool

const STRIP_PHONE_SQL = (col) =>
  `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${col},'-',''),' ',''),'(',''),')',''),'.','')`;

async function searchPatients(q, page = 1, pageSize = 15) {
  const cleaned = (q || '').trim().replace(/\s+/g, ' ');
  const limit = Math.max(1, Math.min(pageSize, 50));
  const offset = Math.max(0, (Number(page) - 1) * limit);

  if (!cleaned) {
    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM pacientes`);
    const total = countRows[0]?.total || 0;
    const totalPaginas = Math.max(1, Math.ceil(total / limit));

    const [rows] = await db.query(
      `SELECT id, nombre, apellido, email, telefono_principal, telefono_secundario
       FROM pacientes
       ORDER BY nombre ASC, apellido ASC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return { pacientes: rows, totalPaginas };
  }

  const tokens = cleaned.split(' ');
  const whereParts = [];
  const params = [];

  tokens.forEach((tok) => {
    const isEmail = tok.includes('@');
    const numeric = tok.replace(/\D+/g, '');
    const isNumeric = /^\d{3,}$/.test(numeric);
    const like = `%${tok}%`;

    if (isEmail) {
      whereParts.push(`(COALESCE(p.email,'') COLLATE utf8mb4_general_ci LIKE ?)`);
      params.push(like);
    } else if (isNumeric) {
      whereParts.push(`(
        ${STRIP_PHONE_SQL('COALESCE(p.telefono_principal,"")')} LIKE ?
        OR ${STRIP_PHONE_SQL('COALESCE(p.telefono_secundario,"")')} LIKE ?
      )`);
      params.push(`%${numeric}%`, `%${numeric}%`);
    } else {
      whereParts.push(`(
        CONCAT(COALESCE(p.nombre,''), ' ', COALESCE(p.apellido,'')) COLLATE utf8mb4_general_ci LIKE ?
        OR p.nombre COLLATE utf8mb4_general_ci LIKE ?
        OR COALESCE(p.apellido,'') COLLATE utf8mb4_general_ci LIKE ?
      )`);
      params.push(like, like, like);
    }
  });

  const where = `WHERE ${whereParts.join(' AND ')}`;

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM pacientes p ${where}`,
    params
  );
  const total = countRows[0]?.total || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));

  const [rows] = await db.query(
    `SELECT p.id, p.nombre, p.apellido, p.email, p.telefono_principal, p.telefono_secundario
     FROM pacientes p
     ${where}
     ORDER BY p.nombre ASC, p.apellido ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { pacientes: rows, totalPaginas };
}

// util
const inList = (arr) => arr.map(() => '?').join(',');

// === OJO: aquí sí usa db.getConnection() (no pool suelto) ===
async function getFormsSummary(pacienteId) {
  const conn = await db.getConnection();
  try {
    const [pacRows] = await conn.query('SELECT * FROM pacientes WHERE id=?', [pacienteId]);
    const paciente = pacRows[0];
    if (!paciente) return { paciente: null };

    const [forms] = await conn.query(`
      SELECT f.id, f.tipo_id, f.medico_id, f.estado, f.creado_en, ft.nombre AS tipo
      FROM formulario f
      JOIN formulario_tipo ft ON ft.id = f.tipo_id
      WHERE f.paciente_id = ?
      ORDER BY f.creado_en DESC
    `, [pacienteId]);

    const porTipo = {};
    for (const f of forms) (porTipo[f.tipo] ||= []).push(f);

    const medicoIds = [...new Set(forms.map(f => f.medico_id).filter(Boolean))];
    let medMap = {};
    if (medicoIds.length) {
      const [medRows] = await conn.query(
        `SELECT id, nombre_completo FROM medicos WHERE id IN (${inList(medicoIds)})`,
        medicoIds
      );
      medMap = Object.fromEntries(medRows.map(m => [m.id, m.nombre_completo]));
    }

    // === Evoluciones
    let evoluciones = [];
    if (porTipo['evolucion_clinica']?.length) {
      const ids = porTipo['evolucion_clinica'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT d.formulario_id, d.fecha, d.tratamiento AS descripcion
         FROM formulario_evolucion_detalle d
         WHERE d.formulario_id IN (${inList(ids)})
         ORDER BY d.fecha DESC, d.id DESC`,
        ids
      );
      evoluciones = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        descripcion: r.descripcion,
        doctor: medMap[porTipo['evolucion_clinica'].find(f => f.id===r.formulario_id)?.medico_id] || '—'
      }));
    }

    // === Recetas
    let recetas = [];
    if (porTipo['receta_medica']?.length) {
      const ids = porTipo['receta_medica'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT r.formulario_id, r.fecha,
                (SELECT medicamento FROM formulario_receta_medicamentos m
                  WHERE m.formulario_id=r.formulario_id ORDER BY m.id ASC LIMIT 1) AS medicamento,
                (SELECT indicaciones FROM formulario_receta_medicamentos m
                  WHERE m.formulario_id=r.formulario_id ORDER BY m.id ASC LIMIT 1) AS indicaciones
         FROM formulario_receta r
         WHERE r.formulario_id IN (${inList(ids)})
         ORDER BY r.fecha DESC`,
        ids
      );
      recetas = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        medicamento: r.medicamento || '—',
        indicaciones: r.indicaciones || '—'
      }));
    }

    // === Presupuestos (legacy)
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
      const minMap = Object.fromEntries(firstRows.map(r => [r.formulario_id, r.minid]));
      const [detRows] = firstRows.length
        ? await conn.query(
            `SELECT id, formulario_id, tratamiento, costo
             FROM formulario_presupuesto_dental_dientes
             WHERE id IN (${inList(firstRows.map(r=>r.minid))})`,
            firstRows.map(r=>r.minid)
          )
        : [[],[]];
      const byId = Object.fromEntries(detRows.map(r => [r.formulario_id, r]));

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

    // === Consentimientos
    let consentOdont = [];
    if (porTipo['consentimiento_odontologico']?.length) {
      const ids = porTipo['consentimiento_odontologico'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha, tratamiento AS procedimiento, firma_path
         FROM formulario_consent_odont
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha DESC`,
        ids
      );
      consentOdont = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        procedimiento: r.procedimiento,
        firmado: !!r.firma_path
      }));
    }

    let consentQuiro = [];
    if (porTipo['consentimiento_quirurgico']?.length) {
      const ids = porTipo['consentimiento_quirurgico'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, fecha, intervencion, firma_path
         FROM formulario_consent_quiro
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY fecha DESC`,
        ids
      );
      consentQuiro = rows.map(r => ({
        formulario_id: r.formulario_id,
        fecha: r.fecha,
        intervencion: r.intervencion || '—',
        firmado: !!r.firma_path
      }));
    }

    // === Historia clínica
    let historias = [];
    if (porTipo['historia_clinica']?.length) {
      const ids = porTipo['historia_clinica'].map(f => f.id);
      const [rows] = await conn.query(
        `SELECT formulario_id, nombre_paciente, creado_en
         FROM formulario_historia_clinica
         WHERE formulario_id IN (${inList(ids)})
         ORDER BY creado_en DESC`,
        ids
      );
      historias = rows;
    }

    // === Justificantes
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

    // === Odontograma final
    let odontFinal = [];
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
      odontFinal = rows;
    }

    // === Ortodoncia
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
      consentimiento_odontologico: consentOdont,
      consentimiento_quirurgico:  consentQuiro,
      historia_clinica: historias,
      justificantes,
      odontograma_final: odontFinal,
      ortodoncia
    };
  } finally {
    conn.release();
  }
}

module.exports = {
  searchPatients,
  getFormsSummary
};
