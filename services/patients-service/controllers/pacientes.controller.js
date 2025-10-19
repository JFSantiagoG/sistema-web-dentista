// services/patients-service/controllers/pacientes.controller.js
const db = require('../db/connection');
const { buscarPacientes, getFormsSummary, getPatientStudies } = require('../models/pacientes.model');

/* =======================
 *   Pacientes: Buscar
 * ======================= */
async function buscar(req, res) {
  const q = req.query.q?.trim();
  const page = parseInt(req.query.page) || 1;

  try {
    const { pacientes, totalPaginas } = await buscarPacientes(q, page);
    res.json({ pacientes, totalPaginas });
  } catch (err) {
    console.error('Error al buscar pacientes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

/* =======================
 *   Pacientes: Obtener por ID
 * ======================= */
async function obtenerPorId(req, res) {
  const id = req.params.id;
  try {
    const [rows] = await db.query(`
      SELECT id, nombre, apellido, sexo, edad, email, telefono_principal, telefono_secundario
      FROM pacientes
      WHERE id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener paciente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

/* =======================
 *   Pacientes: Resumen de Formularios
 * ======================= */
async function obtenerFormsSummary(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'paciente_id inválido' });

    const data = await getFormsSummary(id);
    if (!data || !data.paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    res.json({
      paciente: data.paciente,
      evoluciones: data.evoluciones || [],
      recetas: data.recetas || [],
      presupuestos: data.presupuestos || [],
      consentimiento_odontologico: data.consentimiento_odontologico || [],
      consentimiento_quirurgico: data.consentimiento_quirurgico || [],
      historia_clinica: data.historia_clinica || [],
      justificantes: data.justificantes || [],
      odontograma_final: data.odontograma_final || [],
      ortodoncia: data.ortodoncia || []
    });
  } catch (err) {
    console.error('getFormsSummary error:', err);
    res.status(500).json({ error: 'Error al consultar formularios' });
  }
}

/* =======================
 *   Pacientes: Estudios
 * ======================= */
async function obtenerStudies(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'paciente_id inválido' });

    const rows = await getPatientStudies(id);
    res.json(rows); // siempre array
  } catch (err) {
    console.error('getPatientStudies error:', err);
    res.status(500).json({ error: 'Error al consultar estudios' });
  }
}

/* =======================
 *   Formularios: Crear Receta (SIN firma por ahora)
 *   - Crea en:
 *     1) formulario
 *     2) formulario_receta
 *     3) formulario_receta_medicamentos
 * ======================= */
async function crearReceta(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/recetas');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', req.user);
  console.log('Body:', JSON.stringify(req.body));

  const pacienteId = Number(req.params.id);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const {
    fecha,                 // 'YYYY-MM-DD'
    medicamentos = [],     // [{nombre,dosis,frecuencia,duracion,indicaciones}]
    nombreMedico,          // opcional
    cedula,                // opcional
    edad                   // ej. "45 años" (opcional)
    // firma IGNORADA por ahora
  } = req.body || {};

  if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
  if (!Array.isArray(medicamentos) || medicamentos.length === 0) {
    return res.status(400).json({ error: 'Debe incluir al menos un medicamento' });
  }

  // Derivados limpios
  const edadTexto = (typeof edad === 'string' && edad.trim()) ? edad.trim() : null;
  const edadAnios = (edadTexto && /^\d+/.test(edadTexto)) ? parseInt(edadTexto, 10) : null;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 Transacción iniciada');

    // 1) tipo_id receta_medica
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['receta_medica']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "receta_medica"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) INSERT formulario (sin especificar "estado" => DEFAULT 'borrador')
    const creadoPor = req.user?.id || null;
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, fecha_creacion)
       VALUES (?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 2.1) Resolver medico_id (medicos.id) a partir del users.id del token (req.user.id)
    //      Si no hay relación, dejamos NULL (la FK lo permite).
    const userId = req.user?.id ?? null;
    let medicoId = null;
    if (userId) {
      const [medRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [userId]
      );
      medicoId = medRow[0]?.id ?? null;
    }
    console.log('users.id =', userId, '→ medicos.id =', medicoId);

    // 3) INSERT formulario_receta (SIN firma por ahora)
    await conn.query(
      `INSERT INTO formulario_receta
        (formulario_id, paciente_id, medico_id, fecha, edad_texto, edad_anios, nombre_medico, cedula, firma_path, firma_hash)
       VALUES
        (?,             ?,           ?,        ?,     ?,          ?,          ?,             ?,      NULL,       NULL)`,
      [
        formularioId,
        pacienteId,
        medicoId,                 // puede ser NULL si no hay fila en medicos
        fecha,
        edadTexto,
        edadAnios,
        nombreMedico || null,
        cedula || null
      ]
    );
    console.log('✔️ receta insertada (sin firma)');

    // 4) INSERT medicamentos (bulk)
    const values = [];
    const params = [];
    medicamentos.forEach((m, i) => {
      values.push('(?, ?, ?, ?, ?, ?)');
      params.push(
        formularioId,
        m?.nombre || '',
        m?.dosis || '',
        m?.frecuencia || '',
        m?.duracion || '',
        m?.indicaciones || ''
      );
      console.log(`   💊 [${i + 1}]`, m?.nombre || '(sin nombre)');
    });

    await conn.query(
      `INSERT INTO formulario_receta_medicamentos
         (formulario_id, medicamento, dosis, frecuencia, duracion, indicaciones)
       VALUES ${values.join(',')}`,
      params
    );
    console.log(`✔️ ${medicamentos.length} medicamentos insertados`);

    await conn.commit();
    console.log('✅ Transacción confirmada');
    console.log('──────────────────────────────────────────────');
    return res.json({ ok: true, formulario_id: formularioId });

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error en crearReceta:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear receta', detalle: err.message });
  } finally {
    conn.release();
  }
}

async function crearJustificante(req, res) {
  console.log('📩 POST /patients/:id/justificantes');
  const pacienteId = Number(req.params.id);
  const userFromToken = req.user?.id ?? null;
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const {
    fechaEmision,       // 'YYYY-MM-DD'
    nombrePaciente,     // snapshot
    procedimiento,
    fechaProcedimiento, // string libre (ej: "10 y 12 de octubre")
    diasReposo          // número
    // SIN firma y sin numero_paciente por ahora
  } = req.body || {};

  if (!fechaEmision || !nombrePaciente || !procedimiento || !fechaProcedimiento || !diasReposo) {
    return res.status(400).json({ error: 'Campos requeridos faltantes' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 TX justificante iniciada');

    // 1) tipo_id
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['justificante_medico']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "justificante_medico"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, 'firmado', NOW())`,
      [pacienteId, tipoId, userFromToken] // estado: firmado o borrador, a tu criterio
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario creado id=', formularioId);

    // 3) resolver medico_id desde users.id
    let medicoId = null;
    if (userFromToken) {
      const [mRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [userFromToken]
      );
      medicoId = mRow[0]?.id ?? null;
    }
    console.log('users.id =', userFromToken, '→ medicos.id =', medicoId);

    // 4) justificante
    await conn.query(
      `INSERT INTO formulario_justificante
        (formulario_id, paciente_id, medico_id, fecha_emision, nombre_paciente,
         procedimiento, fecha_procedimiento, dias_reposo,
         numero_paciente, firma_profesional_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        formularioId,
        pacienteId,
        medicoId,                  // puede ser null
        fechaEmision,
        nombrePaciente,
        procedimiento,
        fechaProcedimiento,
        Number(diasReposo) || 0
      ]
    );
    console.log('✔️ justificante insertado');

    await conn.commit();
    console.log('✅ TX confirmada');
    return res.json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    await conn.rollback();
    console.error('❌ crearJustificante error:', err);
    return res.status(500).json({ error: 'Error al crear justificante' });
  } finally {
    conn.release();
  }
}

async function crearConsentOdont(req, res) {
  console.log('📩 POST /patients/:id/consent-odont');
  const pacienteId = Number(req.params.id);
  const hasAuth = !!req.headers.authorization;
  console.log('Auth header presente:', hasAuth);
  console.log('User (token decodificado):', req.user);
  console.log('Body:', JSON.stringify(req.body));

  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  // Payload esperado desde el front (sin firma)
  const {
    fecha,              // date 'YYYY-MM-DD'  (fechaRegistroInput)
    numero_paciente,    // string (normalmente el mismo id en string)
    tratamiento,        // text
    monto,              // decimal o string numérico
    ausencia_dias,      // int o string numérico
    autorizacion,       // boolean
    economico,          // boolean
    ausencia            // boolean
  } = req.body || {};

  // Validaciones mínimas
  if (!fecha)            return res.status(400).json({ error: 'fecha requerida' });
  if (!tratamiento)      return res.status(400).json({ error: 'tratamiento requerido' });
  if (monto === undefined || monto === null || monto === '')
    return res.status(400).json({ error: 'monto requerido' });
  if (ausencia_dias === undefined || ausencia_dias === null || ausencia_dias === '')
    return res.status(400).json({ error: 'ausencia_dias requerido' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 Transacción iniciada');

    // 1) tipo_id: consentimiento odontológico
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['consentimiento_odontologico']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "consentimiento_odontologico"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario (usa tu ENUM: 'borrador','firmado','cerrado')
    const creadoPor = req.user?.id ?? null; // users.id
    const estado = 'firmado';
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor, estado]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 3) mapear users.id → medicos.id (opcional; si no existe, queda NULL)
    let medicoId = null;
    if (creadoPor) {
      const [medRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [creadoPor]
      );
      medicoId = medRow[0]?.id ?? null;
    }
    console.log('users.id =', creadoPor, '→ medicos.id =', medicoId);

    // 4) consentimiento odontológico (SIN firma; firma_paciente_at queda NULL)
    const montoNum = Number(monto);
    const ausenciaNum = parseInt(ausencia_dias, 10);
    const autChk = autorizacion ? 1 : 0;
    const ecoChk = economico ? 1 : 0;
    const ausChk = ausencia ? 1 : 0;

    await conn.query(
      `INSERT INTO formulario_consent_odont
        (formulario_id, paciente_id, medico_id, fecha, numero_paciente, tratamiento, monto,
         ausencia_dias, autorizacion_check, economico_check, ausencia_check, firma_paciente_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        formularioId,
        pacienteId,
        medicoId,
        fecha,
        numero_paciente ?? String(pacienteId),
        tratamiento,
        isNaN(montoNum) ? 0 : montoNum,
        isNaN(ausenciaNum) ? 0 : ausenciaNum,
        autChk,
        ecoChk,
        ausChk
      ]
    );
    console.log('✔️ consentimiento odontológico insertado (sin firma)');

    await conn.commit();
    console.log('✅ Transacción confirmada');
    return res.json({ ok: true, formulario_id: formularioId });
  } catch (e) {
    await conn.rollback();
    console.error('❌ Error en crearConsentOdont:', e);
    return res.status(500).json({ error: 'Error al crear consentimiento odontológico' });
  } finally {
    conn.release();
  }
}

module.exports = {
  buscar,
  obtenerPorId,
  obtenerFormsSummary,
  obtenerStudies,
  crearJustificante,
  crearConsentOdont,
  crearReceta
};
