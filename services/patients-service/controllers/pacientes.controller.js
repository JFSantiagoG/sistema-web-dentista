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
      SELECT 
      id, 
      nombre, 
      apellido, 
      sexo, 
      edad, 
      email, 
      telefono_principal, 
      telefono_secundario,
      domicilio,                    
       DATE_FORMAT(fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,              
      estado_civil,                  
      ocupacion   
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

async function crearConsentQuirurgico(req, res) {
  const pacienteId = Number(req.params.id);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const {
    fecha,                  // 'YYYY-MM-DD'
    numero_paciente,        // string (usualmente mismo id del paciente en UI)
    pronostico,
    condiciones_posop,
    recuperacion_dias,
    historia_aceptada,
    anestesia_consentida,
    pronostico_entendido,
    recuperacion_entendida,
    responsabilidad_aceptada,
    economico_aceptado,
    acuerdo_economico,
  } = req.body || {};

  // ⚠️ Ignoramos cualquier firma que venga en el body:
  // firmaPacienteBase64, firmaMedicoBase64 —> NO se usan (quedan NULL)
  // firma*_* no se guardan NOMBRES ni PATHS

  // Logs
  console.log('📩 POST /patients/:id/consent-quiro');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });
  console.log('Body (sin firmas):', {
    pacienteId,
    fecha,
    numero_paciente,
    pronostico,
    condiciones_posop,
    recuperacion_dias,
    historia_aceptada,
    anestesia_consentida,
    pronostico_entendido,
    recuperacion_entendida,
    responsabilidad_aceptada,
    economico_aceptado,
    acuerdo_economico,
  });

  if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
  if (!pronostico || !condiciones_posop) {
    return res.status(400).json({ error: 'pronostico y condiciones_posop son requeridos' });
  }
  if (recuperacion_dias == null || Number.isNaN(Number(recuperacion_dias))) {
    return res.status(400).json({ error: 'recuperacion_dias inválido' });
  }

  const conn = await db.getConnection();
  try {
    console.log('🔹 Transacción iniciada');
    await conn.beginTransaction();

    // 1) tipo_id para consentimiento_quirurgico
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['consentimiento_quirurgico']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "consentimiento_quirurgico"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario
    const creadoPor = req.user?.id || null;
    const estado = 'firmado'; // o 'borrador' si lo prefieres
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor, estado]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 3) mapear users.id -> medicos.id (puede quedar NULL)
    let medicoId = null;
    if (creadoPor) {
      const [medRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [creadoPor]
      );
      medicoId = medRow[0]?.id ?? null;
    }
    console.log('users.id =', creadoPor, '→ medicos.id =', medicoId);

    // 4) Insertar consentimiento quirúrgico — SIN FIRMAS (en NULL)
    await conn.query(
      `INSERT INTO formulario_consent_quiro
        (formulario_id, paciente_id, medico_id, fecha, numero_paciente,
         pronostico, condiciones_posop, recuperacion_dias,
         historia_aceptada, anestesia_consentida, pronostico_entendido, recuperacion_entendida,
         responsabilidad_aceptada, economico_aceptado, acuerdo_economico,
         firma_paciente_at, firma_medico_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
      [
        formularioId, pacienteId, medicoId, fecha, numero_paciente || String(pacienteId),
        pronostico, condiciones_posop, Number(recuperacion_dias),
        !!historia_aceptada, !!anestesia_consentida, !!pronostico_entendido, !!recuperacion_entendida,
        !!responsabilidad_aceptada, !!economico_aceptado, acuerdo_economico || ''
      ]
    );
    console.log('✔️ consentimiento quirúrgico insertado (sin firmar)');

    await conn.commit();
    console.log('✅ Transacción confirmada');
    console.log('──────────────────────────────────────────────');

    return res.json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    await conn.rollback();
    console.error('❌ Error en crearConsentQuirurgico:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear consentimiento quirúrgico' });
  } finally {
    conn.release();
  }
}

// ====== Crear Evolución Clínica (SIN firma en BD; igual estilo que Receta) ======
async function crearEvolucion(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/evoluciones');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', {
    id: req.user?.id, rol: req.user?.rol, email: req.user?.email
  });

  const pacienteId = Number(req.params.id);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const body = req.body || {};
  const fechaRegistro = body.fecha_registro || null;
  const evoluciones = Array.isArray(body.evoluciones) ? body.evoluciones : [];

  console.log('Body:', JSON.stringify(body));

  if (!evoluciones.length) {
    return res.status(400).json({ error: 'Debe incluir al menos una evolución' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 Transacción iniciada');

    // 1) Obtener tipo_id
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['evolucion_clinica']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "evolucion_clinica"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) Crear formulario (mismo patrón que receta)
    const creadoPor = req.user?.id || null;
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, fecha_creacion)
      VALUES (?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor]
    );

    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 3) Mapear users.id -> medicos.id (puede ser NULL)
    let medicoId = null;
    if (creadoPor) {
      const [medRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [creadoPor]
      );
      medicoId = medRow[0]?.id ?? null;
    }
    console.log('users.id =', creadoPor, '→ medicos.id =', medicoId ?? '—');

    // 4) Cabecera en formulario_evolucion
    const numeroPaciente = String(pacienteId);
    const evolJSON = JSON.stringify(evoluciones);

    await conn.query(
      `INSERT INTO formulario_evolucion
        (formulario_id, paciente_id, medico_id, numero_paciente, fecha_registro, evoluciones_json, firma_paciente_at)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), NULL)`,
      [formularioId, pacienteId, medicoId, numeroPaciente, fechaRegistro, evolJSON]
    );
    console.log('✔️ cabecera de evolución insertada');

    // 5) Detalle (una fila por evolución)
    let count = 0;
    for (const e of evoluciones) {
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
      console.log(`   🧾 [${count}] ${e.fecha || '—'} | ${e.tratamiento || '—'}`);
    }
    console.log(`✔️ ${count} evoluciones insertadas`);

    await conn.commit();
    console.log('✅ Transacción confirmada');
    console.log('──────────────────────────────────────────────');

    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ Error en crearEvolucion:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear evolución' });
  } finally {
    conn.release();
  }
}


function toDec(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function yesNoToBit(v) {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'si' || s === 'sí' || s === 'true' || s === '1') return 1;
  if (s === 'no' || s === 'false' || s === '0') return 0;
  return null;
}

// ===== Crear Ortodoncia (84 columnas 1:1, con verificación de orden) =====
async function crearOrtodoncia(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/ortodoncia');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });
  console.log('Datos recibidos para ORTO:', JSON.stringify(req.body));

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const b = req.body || {};
  const {
    nombrePaciente = '',
    fechaIngreso   = null,
    fechaAlta      = null,
    examenClinico = {},
    analisisFuncional = {},
    analisisModelos = {},
    indicesValorativos = {},
    planTratamiento = {},
    analisisCefalometrico = {},
    factoresComplementarios = {},
    analisisJaraback = [],
    medidasLineales  = [],
    analisisMcNamara = []
  } = b;

  if (!nombrePaciente || !fechaIngreso) {
    return res.status(400).json({ error: 'nombrePaciente y fechaIngreso son requeridos' });
  }

  // helpers seguros
  const num = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const yesNoToTinyint = (v) => {
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === 'si' || s === 'sí' || s === 'true' || s === '1') return 1;
    if (s === 'no' || s === 'false' || s === '0') return 0;
    return null;
  };
  const J = (v) => JSON.stringify(Array.isArray(v) ? v : (v == null ? [] : v));

  // alias para no romper si vienen vacíos
  const ex = examenClinico || {};
  const af = analisisFuncional || {};
  const am = analisisModelos || {};
  const rd = am.relacionesDentarias || {};
  const ad = am.anomaliasDentarias || {};
  const ai = am.arcadasIndividuales || {};
  const iv = indicesValorativos || {};
  const pontMx = iv.pontMaxilar || {};
  const pontMd = iv.pontMandibular || {};
  const pre   = pontMx.premaxila  || {};
  const premo = pontMx.premolares || {};
  const molar = pontMx.molares    || {};
  const mdPr  = pontMd.premolares || {};
  const mdMo  = pontMd.molares    || {};
  const la    = iv.longitudArco   || {};
  const pt    = planTratamiento   || {};

  const acf   = analisisCefalometrico || {};
  const biotipoFacial       = acf.biotipoFacial       || [];
  const claseEsqueletica    = acf.claseEsqueletica    || [];
  const problemasVerticales = acf.problemasVerticales || [];
  const factoresDentales    = acf.factoresDentales    || [];
  const diagCef             = acf.diagnosticoCefalometrico || null;

  const fcomp = factoresComplementarios || {};
  const claseII   = fcomp.claseII    || [];
  const claseIII  = fcomp.claseIII   || [];
  const complVert = fcomp.verticales || [];

  const boltonSup = iv.boltonSuperiores || [];
  const boltonInf = iv.boltonInferiores || [];

  const conn = await db.getConnection();
  try {
    console.log('🔹 TX ortodoncia iniciada');
    await conn.beginTransaction();

    // 1) tipo_id
    const [tipoRows] = await conn.query('SELECT id FROM formulario_tipo WHERE nombre=? LIMIT 1', ['historia_ortodoncia']);
    if (!tipoRows.length) throw new Error('No existe tipo "historia_ortodoncia"');
    const tipoId = tipoRows[0].id;

    // 2) formulario (usa estado válido del ENUM: 'borrador'|'firmado'|'cerrado')
    const creadoPor = req.user?.id || null;
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, 'borrador', NOW())`,
      [pacienteId, tipoId, creadoPor]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id =', formularioId);

    // 3) mapear users.id -> medicos.id
    let medicoId = null;
    if (creadoPor) {
      const [mRow] = await conn.query('SELECT id FROM medicos WHERE user_id=? LIMIT 1', [creadoPor]);
      medicoId = mRow[0]?.id ?? null;
    }

    // 4) INSERT exacto 84 columnas ⇄ 84 valores
    const cols = [
      // 1..6
      'formulario_id','paciente_id','medico_id','nombre_paciente','fecha_ingreso','fecha_alta',
      // 7..10
      'tipo_cuerpo','tipo_cara','tipo_craneo','examen_otros',
      // 11..14
      'fun_respiracion','fun_deglucion','fun_masticacion','fun_fonacion',
      // 15..18
      'atm_problemas_actuales','atm_dolor_si','atm_ruidos_si','atm_dolor_palpacion',
      // 19..22
      'atm_max_apertura_mm','atm_lateralidad_izq_mm','atm_protrusion_mm','atm_lateralidad_der_mm',
      // 23..25
      'dis_ocrc_vertical_mm','dis_ocrc_horizontal_mm','dis_ocrc_otro',
      // 26..29
      'mod_ocl_molares_der_mm','mod_ocl_molares_izq_mm','mod_ocl_caninos_der_mm','mod_ocl_caninos_izq_mm',
      // 30..31
      'mod_resalte_horizontal_mm','mod_resalte_vertical_mm',
      // 32..33
      'mod_linea_media_sup_mm','mod_linea_media_inf_mm',
      // 34..35
      'mod_mordida_cruzada_post_der_mm','mod_mordida_cruzada_post_izq_mm',
      // 36..41
      'mod_anom_ausentes','mod_anom_malformacion','mod_anom_giroversion','mod_anom_infraversion','mod_anom_supraversion','mod_anom_pigmentados',
      // 42..43
      'arcada_sup','arcada_inf',
      // 44..46
      'pont_premaxila_nc','pont_premaxila_pac','pont_premaxila_dif',
      // 47..49
      'pont_premolares_nc','pont_premolares_pac','pont_premolares_dif',
      // 50..52
      'pont_molares_nc','pont_molares_pac','pont_molares_dif',
      // 53..56
      'col_mand_premolares_pac','col_mand_premolares_dif','col_mand_molares_pac','col_mand_molares_dif',
      // 57..60
      'suma_incisivos','bolton_sup_json','bolton_inf_json','bolton_dif_mm',
      // 61..64
      'long_apinamiento_mm','long_protrusion_dental_mm','long_curva_spee_mm','long_total_mm',
      // 65..71
      'plan_ortopedia_maxilar','plan_ortopedia_mandibula','plan_inf_incisivo','plan_inf_molar','plan_sup_molar','plan_sup_incisivo','plan_sup_estetica',
      // 72..73
      'anclaje_max','anclaje_man',
      // 74..78
      'biotipo_facial_json','clase_esqueletica_json','problemas_verticales_json','factores_dentales_json','diagnostico',
      // 79..81
      'clase_ii_json','clase_iii_json','compl_verticales_json',
      // 82..84
      'jaraback_json','medidas_lineales_json','mcnamara_json'
    ];

    // params en el MISMO orden de cols[]
    const params = [
      // 1..6
      formularioId, pacienteId, medicoId, nombrePaciente, fechaIngreso, (fechaAlta || null),
      // 7..10
      ex.tipoCuerpo || null, ex.tipoCara || null, ex.tipoCraneo || null, ex.otros || null,
      // 11..14
      af.respiracion || null, af.deglucion || null, af.masticacion || null, af.fonacion || null,
      // 15..18
      af.problemasATM || null, yesNoToTinyint(af.dolorATM), yesNoToTinyint(af.ruidosATM), af.dolorPalpacion || null,
      // 19..22
      num(af.aperturaMax), num(af.latIzq), num(af.protrusion), num(af.latDer),
      // 23..25
      num(af.verticalOCRC), num(af.horizontalOCRC), af.otrosOCRC || null,
      // 26..29
      num(rd.oclusionMolaresDer), num(rd.oclusionMolaresIzq), num(rd.oclusionCaninosDer), num(rd.oclusionCaninosIzq),
      // 30..31
      num(rd.resalteHorizontal), num(rd.resalteVertical),
      // 32..33
      num(rd.lineaMediaSup), num(rd.lineaMediaInf),
      // 34..35
      num(rd.mordidaCruzadaDer), num(rd.mordidaCruzadaIzq),
      // 36..41
      ad.dientesAusentes || null, ad.dientesMalformados || null, ad.dientesGiroversion || null,
      ad.dientesInfraversion || null, ad.dientesSupraversion || null, ad.dientesPigmentados || null,
      // 42..43
      ai.arcadaSuperior || null, ai.arcadaInferior || null,
      // 44..46
      num(pre.nc), num(pre.pac), num(pre.dif),
      // 47..49
      num(premo.nc), num(premo.pac), num(premo.dif),
      // 50..52
      num(molar.nc), num(molar.pac), num(molar.dif),
      // 53..56
      num(mdPr.pac), num(mdPr.dif), num(mdMo.pac), num(mdMo.dif),
      // 57..60 (AQUÍ VAN BOLTON!)
      num(iv.sumaIncisivos), J(boltonSup), J(boltonInf), num(iv.diferenciaBolton),
      // 61..64
      num(la.apinamiento), num(la.protrusionDental), num(la.curvaSpee), num(la.totalLongitud),
      // 65..71
      pt.ortopediaMaxilar || null, pt.ortopediaMandibula || null, pt.dientesInfIncisivo || null,
      pt.dientesInfMolar || null, pt.dientesSupMolar || null, pt.dientesSupIncisivo || null, pt.dientesSupEstetica || null,
      // 72..73
      (pt.anclaje?.maxilar || null), (pt.anclaje?.mandibular || null),
      // 74..78
      J(biotipoFacial), J(claseEsqueletica), J(problemasVerticales), J(factoresDentales), (diagCef || null),
      // 79..81
      J(claseII), J(claseIII), J(complVert),
      // 82..84
      J(analisisJaraback), J(medidasLineales), J(analisisMcNamara)
    ];

    // 🔎 Verificación dura
    if (params.length !== cols.length) {
      console.error(`❌ Mismatch cols(${cols.length}) vs params(${params.length})`);
      return res.status(500).json({ error: 'Desface interno de columnas/valores (contacta dev).' });
    }

    // Log de depuración columna → valor (primeros 90, aquí son 84)
    console.log('🧩 Mapeo columna → valor:');
    cols.forEach((c, i) => {
      const v = params[i];
      const show = (v === null) ? 'NULL'
                 : (typeof v === 'string' && v.length > 80) ? (v.slice(0,77) + '...') 
                 : (typeof v === 'string') ? `'${v}'`
                 : (typeof v === 'number') ? v
                 : (typeof v === 'object') ? JSON.stringify(v).slice(0,80)+'...'
                 : String(v);
      console.log(String(i+1).padStart(2,' '), c.padEnd(30), '→', show);
    });

    // SQL con placeholders
    const sql = `
      INSERT INTO formulario_ortodoncia (
        ${cols.join(',')}
      ) VALUES (
        ${cols.map((c) => {
          // Campos JSON deben ir como CAST(? AS JSON)
          return /_json$/.test(c) ? 'CAST(? AS JSON)' : '?';
        }).join(',')}
      )
    `;

    await conn.query(sql, params);

    await conn.commit();
    console.log('✅ TX confirmada (ortodoncia)');
    console.log('──────────────────────────────────────────────');

    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ crearOrtodoncia error:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear ortodoncia', detalle: err.message });
  } finally {
    conn.release();
  }
}




// ============== Formularios: Historia Clínica ==================
async function crearHistoriaClinica(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/historia');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  // Body esperado (coincide con tu front)
  const b = req.body || {};
  const isis = b.interrogatorioSistemas || {};
  const expl = b.exploracionClinica || {};

  // JSONs completos
  const antecedentesPatologicosJson = Array.isArray(b.antecedentesPatologicos) ? b.antecedentesPatologicos : [];
  const soloMujeresJson             = Array.isArray(b.antecedentesMujeres) ? b.antecedentesMujeres : [];
  const noPatologicosJson           = Array.isArray(b.antecedentesNoPatologicos) ? b.antecedentesNoPatologicos : [];
  const antecedentesFamiliaresJson  = Array.isArray(b.antecedentesFamiliares) ? b.antecedentesFamiliares : [];

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 TX historia clínica iniciada');

    // 1) tipo_id para historia_clinica
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['historia_clinica']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "historia_clinica"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario (mismo patrón)
    const creadoPor = req.user?.id || null; // users.id
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, fecha_creacion)
       VALUES (?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 3) mapear users.id → medicos.id (puede quedar NULL)
    let medicoId = null;
    if (creadoPor) {
      const [mRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [creadoPor]
      );
      medicoId = mRow[0]?.id ?? null;
    }
    console.log('users.id =', creadoPor, '→ medicos.id =', medicoId);

    // 4) Insert en formulario_historia_clinica — SIN firmas
    const sql = `
      INSERT INTO formulario_historia_clinica (
        formulario_id, paciente_id, medico_id,
        nombre_paciente, domicilio, telefono, sexo, fecha_nacimiento, edad, estado_civil, ocupacion, motivo_consulta,
        antecedentes_patologicos, antecedentes_patologicos_json,
        tratamiento_medico_si, tratamiento_medico_cual,
        medicamento_si, medicamento_cual,
        problema_dental_si, problema_dental_cual,
        solo_mujeres_json, no_patologicos_json, antecedentes_familiares_json,
        sis_cardiovascular, sis_circulatorio, sis_respiratorio, sis_digestivo, sis_urinario, sis_genital, sis_musculoesqueletico, sis_snc,
        expl_cabeza_cuello_cara_perfil, expl_atm, expl_labios_frenillos_lengua_paladar_orofaringe_yugal,
        expl_piso_boca_glandulas_salivales_carrillos, expl_encias_procesos_alveolares,
        observaciones, hallazgos, firma_paciente_at
      )
      VALUES (
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, CAST(? AS JSON),
        ?, ?, ?, ?,
        ?, ?,
        CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON),
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, NULL
      )
    `;

    const params = [
      formularioId, pacienteId, medicoId,
      b.nombrePaciente || null,
      b.domicilioPaciente || null,
      b.telefonoPaciente || null,
      b.sexoPaciente || null,
      b.fechaNacimiento || null,
      b.edadPaciente ? parseInt(b.edadPaciente, 10) : null,
      b.estadoCivil || null,
      b.ocupacionPaciente || null,
      b.motivoConsulta || null,

      null, // antecedentes_patologicos (texto libre opcional) → por ahora null
      JSON.stringify(antecedentesPatologicosJson),

      (b.tratamientoMedico ? 1 : 0),
      b.tratamientoMedicoCual || null,
      (b.medicamento ? 1 : 0),
      b.medicamentoCual || null,
      (b.problemaDental ? 1 : 0),
      b.problemaDentalCual || null,

      JSON.stringify(soloMujeresJson),
      JSON.stringify(noPatologicosJson),
      JSON.stringify(antecedentesFamiliaresJson),

      isis.Cardiovascular || '',
      isis.Circulatorio || '',
      isis.Respiratorio || '',
      isis.Digestivo || '',
      isis.Urinario || '',
      isis.Genital || '',
      isis['Musculoesquelético'] || '',
      isis.SNC || '',

      expl['Cabeza, Cuello, Cara, Perfil'] || '',
      expl['ATM (Articulación Temporomandibular)'] || '',
      expl['Labios, Frenillos, Lengua, Paladar Duro, Blando, Orofaringe, Región Yugal'] || '',
      expl['Piso de Boca, Glándulas Salivales, Carrillos'] || '',
      expl['Encías, Procesos Alveolares'] || '',

      b.observacionesGenerales || '',
      b.hallazgosRadiograficos || ''
      // firma_paciente_at = NULL (no guardamos firmas)
    ];

    await conn.query(sql, params);
    console.log('✔️ historia clínica insertada (sin firma)');

    await conn.commit();
    console.log('✅ TX confirmada (historia clínica)');
    console.log('──────────────────────────────────────────────');

    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ Error en crearHistoriaClinica:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear historia clínica' });
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
  crearConsentQuirurgico,
  crearEvolucion,
  crearOrtodoncia,
  crearHistoriaClinica,
  crearReceta
};
