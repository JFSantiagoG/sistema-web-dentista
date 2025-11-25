// services/patients-service/controllers/pacientes.controller.js
const db = require('../db/connection');
const { buscarPacientes, 
  getFormsSummary, 
  getPatientStudies,
  insertPatientFile,
  getJustificanteByFormId, 
  getConsentQuiroById, 
  getHistoriaByFormId,
  getOdontogramaFinalByFormularioId,
  getPresupuestoByFormIdModel,
  getDiagInfantilByFormularioId,
  getEvolucionDetalleByFormId,   
  getEvolucionCabeceraByFormId,
  appendEvolucionesDetalle,
  getEvolucionSummaryForPatient,
  getRecetaByFormId,
  FIRMAS_DIR,
  guardarFirma
 } = require('../models/pacientes.model');

const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');
const fs = require('fs');

const ALLOWED_EXT = ['.png','.jpg','.jpeg','.webp','.bmp','.tif','.tiff','.gif','.dcm'];
const IMAGE_MIME_PREFIX = 'image/';
const upload = multer({ storage: multer.memoryStorage() });


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
    if (!data || !data.paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    // helper seguro para fechas
    const d = (v) => {
      if (!v) return null;
      // acepta 'YYYY-MM-DD' o Date/ISO
      const s = String(v).slice(0, 10); // YYYY-MM-DD
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    };

    // 1) Intentar summary de modelo (si existe y responde)
    let evolucionFilaUnica = null;
    try {
      if (typeof getEvolucionSummaryForPatient === 'function') {
        const evo = await getEvolucionSummaryForPatient(id); // {formulario_id, primera_fecha, ultima_fecha, entradas, fecha_registro?}
        if (evo && evo.formulario_id) {
          evolucionFilaUnica = {
            formulario_id : evo.formulario_id,
            fecha         : evo.ultima_fecha || evo.fecha_registro || evo.primera_fecha || null,
            descripcion   : `${evo.entradas || 0} evolución(es)`,
            doctor        : '', // si no lo tienes en la cabecera
            primera_fecha : evo.primera_fecha || null,
            ultima_fecha  : evo.ultima_fecha  || null,
            entradas      : evo.entradas      || 0
          };
        }
      }
    } catch (e) {
      console.error('getEvolucionSummaryForPatient error:', e?.message || e);
    }

    // 2) Fallback: condensar data.evoluciones en UNA sola fila
    if (!evolucionFilaUnica) {
      const evoList = Array.isArray(data.evoluciones) ? data.evoluciones : [];
      if (evoList.length) {
        // escoger el más reciente por fecha (o por formulario_id si falta fecha)
        const sorted = [...evoList].sort((a, b) => {
          const da = d(a.fecha) || d(a.ultima_fecha) || d(a.fecha_registro);
          const db = d(b.fecha) || d(b.ultima_fecha) || d(b.fecha_registro);
          if (da && db) return db - da;
          // fallback a formulario_id descendente
          return (b.formulario_id || 0) - (a.formulario_id || 0);
        });
        const top = sorted[0] || {};
        evolucionFilaUnica = {
          formulario_id : top.formulario_id || top.id || null,
          fecha         : top.fecha || top.ultima_fecha || top.fecha_registro || null,
          descripcion   : `${evoList.length} evolución(es)`,
          doctor        : top.doctor || '',
          primera_fecha : null,
          ultima_fecha  : top.fecha || null,
          entradas      : evoList.length
        };
      }
    }

    return res.json({
      paciente: data.paciente,
      evoluciones: evolucionFilaUnica ? [evolucionFilaUnica] : [], // ← siempre 0 ó 1 fila
      recetas: data.recetas || [],
      presupuestos: data.presupuestos || [],
      consentimiento_odontologico: data.consentimiento_odontologico || [],
      consentimiento_quirurgico: data.consentimiento_quirurgico || [],
      historia_clinica: data.historia_clinica || [],
      justificantes: data.justificantes || [],
      odontograma_final: data.odontograma_final || [],
      ortodoncia: data.ortodoncia || [],
      diag_infantil: data.diag_infantil || []
    });
  } catch (err) {
    console.error('obtenerFormsSummary error:', err);
    return res.status(500).json({ error: 'Error al consultar formularios' });
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
  console.log('📩 POST /patients/:id/recetas');

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) {
    return res.status(400).json({ error: 'paciente_id inválido' });
  }

  const body = req.body || {};
  const userId = req.user?.id || null;  // users.id

  const {
    nombrePaciente,  // (no se guarda en esta tabla, pero viene del front)
    fecha,
    edad,
    nombreMedico,
    cedula,
    medicamentos = [],
    firmaBase64,     // 👈 viene del frontend
  } = body;

  if (!Array.isArray(medicamentos) || !medicamentos.length) {
    return res.status(400).json({ error: 'Debe incluir al menos un medicamento.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) tipo_id para receta
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['receta_medica']
    );
    if (!tipoRows.length) {
      throw new Error('No existe tipo "receta_medica"');
    }
    const tipoId = tipoRows[0].id;

    // 2) Insert en formulario
    const [fRes] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, 'borrador', NOW())`,
      [pacienteId, tipoId, userId]
    );
    const formularioId = fRes.insertId;

    // 3) Mapear user → medico
    let medicoId = null;
    if (userId) {
      const [mRows] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [userId]
      );
      medicoId = mRows[0]?.id ?? null;
    }

    // 4) Guardar firma en /uploads (helper del MODEL)
    let firmaPath = null;
    let firmaHash = null;

    if (firmaBase64) {
      try {
        const { firmaPath: fp, firmaHash: fh } =
          await guardarFirma(firmaBase64);  // 👈 VIENE DEL MODEL
        firmaPath = fp;   // nombre de archivo, ej. "abcd1234ef5678.png"
        firmaHash = fh;   // Buffer de 32 bytes → VARBINARY(32)
        console.log('✔️ Firma guardada:', firmaPath);
      } catch (e) {
        console.error('⚠️ No se pudo guardar la firma, se sigue sin firma:', e);
      }
    } else {
      console.log('ℹ️ Sin firmaBase64 (se guarda receta sin firma)');
    }

    // 5) Insert en formulario_receta
    const edadNum = Number.parseInt((edad || '').replace(/\D/g, ''), 10);

    await conn.query(
      `INSERT INTO formulario_receta
         (formulario_id, paciente_id, medico_id, fecha,
          edad_texto, edad_anios, nombre_medico, cedula,
          firma_path, firma_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formularioId,
        pacienteId,
        medicoId,
        fecha || new Date().toISOString().slice(0, 10),
        edad || null,
        Number.isFinite(edadNum) ? edadNum : null,
        nombreMedico || null,
        cedula || null,
        firmaPath,      // varchar(255) -> nombre del archivo
        firmaHash,      // VARBINARY(32) -> Buffer
      ]
    );

    // 6) Insert medicamentos (usa columna "medicamento", NO nombre_medicamento)
    if (medicamentos.length) {
      const values = [];
      const params = [];

      for (const m of medicamentos) {
        values.push('(?, ?, ?, ?, ?, ?)');
        params.push(
          formularioId,
          m.nombre || m.medicamento || '',  // 👉 va a la columna "medicamento"
          m.dosis || '',
          m.frecuencia || '',
          m.duracion || '',
          m.indicaciones || ''
        );
      }

      await conn.query(
        `INSERT INTO formulario_receta_medicamentos
           (formulario_id, medicamento, dosis, frecuencia, duracion, indicaciones)
         VALUES ${values.join(',')}`,
        params
      );
    }

    await conn.commit();
    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ Error al crear receta:', err);
    return res.status(500).json({ error: 'Error al crear receta', detalle: err.message });
  } finally {
    conn.release();
  }
}


async function crearJustificante(req, res) {
  console.log('📩 POST /patients/:id/justificantes');
  const pacienteId = Number(req.params.id);
  const userFromToken = req.user?.id ?? null;

  if (!pacienteId) {
    return res.status(400).json({ error: 'paciente_id inválido' });
  }

  const {
    fechaEmision,       // 'YYYY-MM-DD'
    nombrePaciente,     // snapshot
    procedimiento,
    fechaProcedimiento, // string libre (ej: "10 y 12 de octubre")
    diasReposo,         // número
    firmaBase64         // 🔴 OPCIONAL: firma del profesional en base64
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
      [pacienteId, tipoId, userFromToken]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario creado id =', formularioId);

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

    // 4) guardar firma (si viene en el body)
    let firmaPath = null;
    let firmaHash = null;
    let firmaProfesionalAt = null;

    if (firmaBase64) {
      try {
        const { firmaPath: p, firmaHash: h } = await guardarFirma(firmaBase64);
        firmaPath = p;                 // ej: "a1b2c3d4e5f6.png"
        firmaHash = h;                 // Buffer VARBINARY(32)
        firmaProfesionalAt = new Date();
        console.log('✔️ Firma guardada en:', firmaPath);
      } catch (errFirma) {
        console.error('⚠️ Error guardando firma del profesional:', errFirma);
        // Si falla la firma, NO tumbamos el justificante. Se guarda sin firma.
      }
    }

    // 5) justificante
    await conn.query(
      `INSERT INTO formulario_justificante
        (formulario_id,
         paciente_id,
         medico_id,
         fecha_emision,
         nombre_paciente,
         procedimiento,
         fecha_procedimiento,
         dias_reposo,
         numero_paciente,
         firma_path,
         firma_hash,
         firma_profesional_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
      [
        formularioId,
        pacienteId,
        medicoId,
        fechaEmision,
        nombrePaciente,
        procedimiento,
        fechaProcedimiento,
        Number(diasReposo) || 0,
        firmaPath,           // puede ser null
        firmaHash,           // puede ser null
        firmaProfesionalAt   // puede ser null
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

  if (!pacienteId) {
    return res.status(400).json({ error: 'paciente_id inválido' });
  }

  const {
    fecha,              // 'YYYY-MM-DD'
    numero_paciente,    // string
    tratamiento,        // text
    monto,              // decimal o string numérico
    ausencia_dias,      // int o string numérico
    autorizacion,       // boolean
    economico,          // boolean
    ausencia,           // boolean
    firmaBase64         // string base64 de la firma del paciente
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
    if (!tipoRows.length) {
      throw new Error('No existe tipo "consentimiento_odontologico"');
    }
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario
    const creadoPor = req.user?.id ?? null; // users.id
    const estado = 'firmado';
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [pacienteId, tipoId, creadoPor, estado]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id=', formularioId);

    // 3) mapear users.id → medicos.id
    let medicoId = null;
    if (creadoPor) {
      const [medRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [creadoPor]
      );
      medicoId = medRow[0]?.id ?? null;
    }
    console.log('users.id =', creadoPor, '→ medicos.id =', medicoId);

    // 4) Guardar firma usando el HELPER del MODEL
    let firmaPath = null;
    let firmaHash = null;
    let firmaPacienteAt = null;

    if (firmaBase64) {
      try {
        const { firmaPath: fp, firmaHash: fh } = await guardarFirma(firmaBase64);
        firmaPath = fp;      // string, ej "a1b2c3d4e5f6.png"
        firmaHash = fh;      // Buffer (VARBINARY(32) en BD)
        firmaPacienteAt = new Date();
        console.log('✔️ Firma de consentimiento guardada:', firmaPath);
      } catch (errFirma) {
        console.warn('⚠️ Error al guardar firma de consentimiento (se continúa sin firma):', errFirma);
        firmaPath = null;
        firmaHash = null;
        firmaPacienteAt = null;
      }
    }

    // 5) Insert en formulario_consent_odont
    const montoNum    = Number(monto);
    const ausenciaNum = parseInt(ausencia_dias, 10);
    const autChk      = autorizacion ? 1 : 0;
    const ecoChk      = economico ? 1 : 0;
    const ausChk      = ausencia ? 1 : 0;

    await conn.query(
      `INSERT INTO formulario_consent_odont
        (formulario_id, paciente_id, medico_id, fecha, numero_paciente, tratamiento, monto,
         ausencia_dias, autorizacion_check, economico_check, ausencia_check,
         firma_path, firma_hash, firma_paciente_at)
       VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        ausChk,
        firmaPath,
        firmaHash,
        firmaPacienteAt
      ]
    );
    console.log('✔️ consentimiento odontológico insertado');

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
  console.log('📩 POST /patients/:id/historia');
  const pacienteId = Number(req.params.id);
  const userFromToken = req.user?.id ?? null;

  if (!pacienteId) {
    return res.status(400).json({ error: 'paciente_id inválido' });
  }

  const {
    nombrePaciente,
    domicilioPaciente,
    telefonoPaciente,
    sexoPaciente,
    fechaNacimiento,
    edadPaciente,
    estadoCivil,
    ocupacionPaciente,
    motivoConsulta,

    tratamientoMedico,
    tratamientoMedicoCual,
    medicamento,
    medicamentoCual,
    problemaDental,
    problemaDentalCual,

    antecedentesPatologicos,
    antecedentesMujeres,
    antecedentesNoPatologicos,
    antecedentesFamiliares,

    interrogatorioSistemas,
    exploracionClinica,
    observacionesGenerales,
    hallazgosRadiograficos,

    firmaBase64,   // 🔴 firma del paciente desde el front
  } = req.body || {};

  if (!motivoConsulta) {
    return res.status(400).json({ error: 'motivoConsulta es requerido' });
  }

  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();
    console.log('🔹 TX historia iniciada');

    // 1) tipo_id de historia_clinica
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['historia_clinica']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "historia_clinica"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) Insert en formulario
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, 'firmado', NOW())`,
      [pacienteId, tipoId, userFromToken]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario creado id =', formularioId);

    // 3) Resolver medico_id desde users.id
    let medicoId = null;
    if (userFromToken) {
      const [mRow] = await conn.query(
        'SELECT id FROM medicos WHERE user_id = ? LIMIT 1',
        [userFromToken]
      );
      medicoId = mRow[0]?.id ?? null;
    }
    console.log('users.id =', userFromToken, '→ medicos.id =', medicoId);

    // 4) Preparar datos "normales"
    const edadNum = (edadPaciente != null && edadPaciente !== '')
      ? Number(edadPaciente)
      : null;

    const tMedicoSi = !!tratamientoMedico ? 1 : 0;
    const medSi     = !!medicamento ? 1 : 0;
    const probSi    = !!problemaDental ? 1 : 0;

    const patArr = Array.isArray(antecedentesPatologicos) ? antecedentesPatologicos : [];
    const mujArr = Array.isArray(antecedentesMujeres) ? antecedentesMujeres : [];
    const nopArr = Array.isArray(antecedentesNoPatologicos) ? antecedentesNoPatologicos : [];
    const famArr = Array.isArray(antecedentesFamiliares) ? antecedentesFamiliares : [];

    const patJson = JSON.stringify(patArr);
    const mujJson = JSON.stringify(mujArr);
    const nopJson = JSON.stringify(nopArr);
    const famJson = JSON.stringify(famArr);

    const sis  = interrogatorioSistemas || {};
    const expl = exploracionClinica || {};

    // 5) Guardar firma del paciente (si viene)
    let firmaPath = null;
    let firmaHash = null;
    let firmaPacienteAt = null;

    if (firmaBase64) {
      try {
        const { firmaPath: p, firmaHash: h } = await guardarFirma(firmaBase64);
        firmaPath = p;
        firmaHash = h;
        firmaPacienteAt = new Date();
        console.log('✔️ Firma de paciente guardada en:', firmaPath);
      } catch (errFirma) {
        console.error('⚠️ Error guardando firma de paciente:', errFirma);
        // No tumbamos la historia, se guarda sin firma
      }
    }

    // 6) Insert en formulario_historia_clinica
    await conn.query(
      `
      INSERT INTO formulario_historia_clinica (
        formulario_id,
        paciente_id,
        medico_id,
        nombre_paciente,
        domicilio,
        telefono,
        sexo,
        fecha_nacimiento,
        edad,
        estado_civil,
        ocupacion,
        motivo_consulta,
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
        sis_cardiovascular,
        sis_circulatorio,
        sis_respiratorio,
        sis_digestivo,
        sis_urinario,
        sis_genital,
        sis_musculoesqueletico,
        sis_snc,
        expl_cabeza_cuello_cara_perfil,
        expl_atm,
        expl_labios_frenillos_lengua_paladar_orofaringe_yugal,
        expl_piso_boca_glandulas_salivales_carrillos,
        expl_encias_procesos_alveolares,
        observaciones,
        hallazgos,
        firma_path,
        firma_hash,
        firma_paciente_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, CAST(? AS JSON),
        ?, ?, ?, ?, ?, ?,
        CAST(? AS JSON),
        CAST(? AS JSON),
        CAST(? AS JSON),
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      `,
      [
        // 1–3
        formularioId,
        pacienteId,
        medicoId,
        // 4–11 datos paciente
        nombrePaciente || null,
        domicilioPaciente || null,
        telefonoPaciente || null,
        sexoPaciente || null,
        fechaNacimiento || null,
        edadNum,
        estadoCivil || null,
        ocupacionPaciente || null,
        // 12 motivo
        motivoConsulta || null,
        // 13 texto libre de antecedentes (si quieres algo, por ahora NULL)
        null,
        // 14 JSON patologicos
        patJson,
        // 15–20 flags y "¿cuál?"
        tMedicoSi,
        tratamientoMedicoCual || null,
        medSi,
        medicamentoCual || null,
        probSi,
        problemaDentalCual || null,
        // 21–23 JSON varias tablas
        mujJson,
        nopJson,
        famJson,
        // 24–31 SIS
        sis.Cardiovascular || null,
        sis.Circulatorio  || null,
        sis.Respiratorio  || null,
        sis.Digestivo     || null,
        sis.Urinario      || null,
        sis.Genital       || null,
        sis['Musculoesquelético'] || null,
        sis.SNC || null,
        // 32–36 Exploración
        expl['Cabeza, Cuello, Cara, Perfil'] || null,
        expl['ATM (Articulación Temporomandibular)'] || null,
        expl['Labios, Frenillos, Lengua, Paladar Duro, Blando, Orofaringe, Región Yugal'] || null,
        expl['Piso de Boca, Glándulas Salivales, Carrillos'] || null,
        expl['Encías, Procesos Alveolares'] || null,
        // 37–38 Otros
        observacionesGenerales  || null,
        hallazgosRadiograficos || null,
        // 39–41 Firma
        firmaPath,
        firmaHash,
        firmaPacienteAt
      ]
    );

    console.log('✔️ historia clínica insertada');
    await conn.commit();
    console.log('✅ TX historia confirmada');

    return res.json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    await conn.rollback();
    console.error('❌ crearHistoriaClinica error:', err);
    return res.status(500).json({ error: 'Error al crear historia clínica' });
  } finally {
    conn.release();
  }
}


async function crearOdontogramaFinal(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/odontograma-final');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });
  console.log('Body:', JSON.stringify(req.body));

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const {
    nombre_paciente,
    fecha_termino,
    tratamientos_por_diente = {},
    estado_encia = {}
  } = req.body || {};

  if (!nombre_paciente || !fecha_termino) {
    return res.status(400).json({ error: 'nombre_paciente y fecha_termino son obligatorios' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_termino)) {
    return res.status(400).json({ error: 'fecha_termino debe ser YYYY-MM-DD' });
  }

  // Map a columnas individuales (además de guardar JSON en cabecera)
  const encia       = estado_encia['Encía'] ?? null;
  const inflamacion = estado_encia['Inflamación'] ?? null;
  const migracion   = estado_encia['Migración'] ?? null;
  const secrecion   = estado_encia['Secreción'] ?? null;
  const calculo     = estado_encia['Cálculo'] ?? null;
  const bolsa       = estado_encia['Bolsa*'] ?? estado_encia['Bolsa'] ?? null;

  const tratamientosJson = JSON.stringify(tratamientos_por_diente || {});
  const odontogramaJson  = null; // si luego persistes imagen base64, haz un update aparte

  const conn = await db.getConnection();
  try {
    console.log('🔹 TX odontograma_final iniciada');
    await conn.beginTransaction();

    // 1) tipo_id
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['odontograma_final']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "odontograma_final"');
    const tipoId = tipoRows[0].id;
    console.log('✔️ tipo_id:', tipoId);

    // 2) formulario (mismo patrón: creado_por = users.id del token)
    const creadoPor = req.user?.id || null;
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

    // 4) Cabecera odontograma_final
    await conn.query(
      `INSERT INTO formulario_odontograma_final
       (formulario_id, paciente_id, medico_id, nombre_paciente, fecha_termino,
        odontograma_json, tratamientos_json,
        encia, inflamacion, migracion, secrecion, calculo, bolsa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        formularioId, pacienteId, medicoId, nombre_paciente, fecha_termino,
        odontogramaJson, tratamientosJson,
        encia, inflamacion, migracion, secrecion, calculo, bolsa
      ]
    );
    console.log('✔️ cabecera odontograma_final insertada');

    // 5) Detalle tratamientos (normalizado)
    const detBulk = [];
    for (const [dienteStr, lista] of Object.entries(tratamientos_por_diente || {})) {
      const diente = parseInt(dienteStr, 10);
      if (!Number.isFinite(diente)) continue;
      (lista || []).forEach(trat => {
        if (trat) detBulk.push([formularioId, diente, String(trat).slice(0, 60)]);
      });
    }
    if (detBulk.length) {
      await conn.query(
        `INSERT INTO formulario_odontograma_final_detalle (formulario_id, diente, tratamiento)
         VALUES ?`,
        [detBulk]
      );
      console.log(`✔️ ${detBulk.length} filas detalle insertadas`);
    } else {
      console.log('ℹ️ Sin tratamientos marcados en detalle');
    }

    // 6) Detalle encía (normalizado)
    const encias = Object.entries(estado_encia || {}).map(([cond, val]) => [
      formularioId, String(cond).slice(0,40), String(val ?? '').slice(0,120)
    ]);
    if (encias.length) {
      await conn.query(
        `INSERT INTO formulario_odontograma_final_encia (formulario_id, condicion, valoracion)
         VALUES ?`,
        [encias]
      );
      console.log(`✔️ ${encias.length} filas encía insertadas`);
    }

    await conn.commit();
    console.log('✅ TX confirmada (odontograma_final)');
    console.log('──────────────────────────────────────────────');
    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ crearOdontogramaFinal error:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear odontograma final' });
  } finally {
    conn.release();
  }
}

// === Crear Presupuesto Dental ===
// Crea: formulario → formulario_presupuesto_dental → (dientes y generales)
async function crearPresupuestoDental(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/presupuesto');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token decodificado):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const b = req.body || {};

  // Payload tolerante (acepta tu front tal cual)
  // Front te manda:
  // {
  //   paciente:{ nombre, numeroPaciente, fechaRegistro },
  //   odontograma:[{diente,tratamiento,costo}],
  //   tratamientosGenerales:[{nombre,costo}],
  //   presupuesto:{ total, mensualidad, meses },
  //   odontogramaVisual: "data:image/png;base64,... (OPCIONAL, NO SE GUARDA)"
  // }
  const pacienteNombre   = b?.paciente?.nombre ?? null;
  const numeroPaciente   = b?.paciente?.numeroPaciente ?? null;
  const fechaRegistro    = b?.paciente?.fechaRegistro ?? null; // 'YYYY-MM-DD'
  const meses            = Number(b?.presupuesto?.meses ?? 1) || 1;
  const total            = Number(b?.presupuesto?.total ?? 0) || 0;
  const totalMensual     = Number(b?.presupuesto?.mensualidad ?? 0) || 0;

  const odontoDientes    = Array.isArray(b?.odontograma) ? b.odontograma : [];
  const txGenerales      = Array.isArray(b?.tratamientosGenerales) ? b.tratamientosGenerales : [];

  if (!fechaRegistro) return res.status(400).json({ error: 'fecha requerida' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 TX presupuesto iniciada');

    // 1) tipo_id = presupuesto_dental
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre = ? LIMIT 1',
      ['presupuesto_dental']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "presupuesto_dental"');
    const tipoId = tipoRows[0].id;

    // 2) formulario (estado a elección: borrador/firmado/cerrado). Dejamos 'borrador'
    const creadoPor = req.user?.id || null;
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

    // 4) Cabecera formulario_presupuesto_dental
    //    Guardamos un JSON compacto con dientes + generales (para consulta rápida)
    const odontoJson = JSON.stringify({
      dientes: odontoDientes,       // [{diente,tratamiento,costo}]
      generales: txGenerales        // [{nombre,costo}]
    });

    await conn.query(
      `INSERT INTO formulario_presupuesto_dental
        (formulario_id, paciente_id, medico_id, fecha, numero_paciente, meses, total, total_mensual, odontograma_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
      [
        formularioId, pacienteId, medicoId,
        fechaRegistro, (numeroPaciente ?? String(pacienteId)),
        meses, total, totalMensual, odontoJson
      ]
    );
    console.log('✔️ cabecera presupuesto insertada');

    // 5) Detalle: dientes
    if (odontoDientes.length) {
      const values = [];
      const params = [];
      odontoDientes.forEach((it) => {
        values.push('(?, ?, ?, ?)');
        params.push(
          formularioId,
          String(it?.diente ?? ''),
          String(it?.tratamiento ?? ''),
          Number(it?.costo ?? 0) || 0
        );
      });

      await conn.query(
        `INSERT INTO formulario_presupuesto_dental_dientes
          (formulario_id, diente, tratamiento, costo)
         VALUES ${values.join(',')}`,
        params
      );
      console.log(`✔️ ${odontoDientes.length} renglones de dientes insertados`);
    }

    // 6) Detalle: generales
    if (txGenerales.length) {
      const values = [];
      const params = [];
      txGenerales.forEach((g) => {
        values.push('(?, ?, ?)');
        params.push(
          formularioId,
          String(g?.nombre ?? ''),
          Number(g?.costo ?? 0) || 0
        );
      });

      await conn.query(
        `INSERT INTO formulario_presupuesto_dental_generales
          (formulario_id, tratamiento, costo)
         VALUES ${values.join(',')}`,
        params
      );
      console.log(`✔️ ${txGenerales.length} renglones de generales insertados`);
    }

    await conn.commit();
    console.log('✅ TX confirmada (presupuesto dental)');
    console.log('──────────────────────────────────────────────');

    return res.status(201).json({ ok: true, formulario_id: formularioId });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('❌ crearPresupuestoDental error:', err);
    console.log('──────────────────────────────────────────────');
    return res.status(500).json({ error: 'Error al crear presupuesto dental', detalle: err.message });
  } finally {
    conn.release();
  }
}

// === Crear Diagnóstico Infantil ===
// Crea: formulario → formulario_diag_infantil → (detalle dientes y generales)
async function crearDiagInfantil(req, res) {
  console.log('──────────────────────────────────────────────');
  console.log('📩 POST /patients/:id/diag-infantil');
  console.log('Auth header presente:', !!req.headers.authorization);
  console.log('User (token):', { id: req.user?.id, rol: req.user?.rol, email: req.user?.email });

  const pacienteId = Number(req.params.id || 0);
  if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

  const b = req.body || {};
  // Esperado desde el front (como presupuesto)
  // {
  //   paciente:{ nombre, numeroPaciente, fechaRegistro },
  //   odontograma:[{diente,tratamiento,costo}],
  //   tratamientosGenerales:[{nombre,costo}],
  //   presupuesto:{ total, mensualidad, meses },
  //   odontogramaVisual: "data:image/png;base64,..." (NO se guarda aquí)
  // }

  const fecha = b?.paciente?.fechaRegistro ?? null;       // 'YYYY-MM-DD'
  if (!fecha) return res.status(400).json({ error: 'fecha requerida' });

  const numeroPaciente   = b?.paciente?.numeroPaciente ?? String(pacienteId);
  const odontoDientes    = Array.isArray(b?.odontograma) ? b.odontograma : [];
  const txGenerales      = Array.isArray(b?.tratamientosGenerales) ? b.tratamientosGenerales : [];

  const meses            = Number(b?.presupuesto?.meses ?? 1) || 1;
  const totalCosto       = Number(b?.presupuesto?.total ?? 0) || 0;        // ← total_costo
  const totalMensual     = Number(b?.presupuesto?.mensualidad ?? 0) || 0;  // ← total_mensual

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('🔹 TX diag-infantil iniciada');

    // 1) tipo_id
    const [tipoRows] = await conn.query(
      'SELECT id FROM formulario_tipo WHERE nombre=? LIMIT 1',
      ['diag_infantil']
    );
    if (!tipoRows.length) throw new Error('No existe tipo "diag_infantil"');
    const tipoId = tipoRows[0].id;

    // 2) formulario (estado a tu gusto; dejo 'borrador')
    const creadoPor = req.user?.id || null;
    const [formIns] = await conn.query(
      `INSERT INTO formulario (paciente_id, tipo_id, creado_por, estado, fecha_creacion)
       VALUES (?, ?, ?, 'borrador', NOW())`,
      [pacienteId, tipoId, creadoPor]
    );
    const formularioId = formIns.insertId;
    console.log('✔️ formulario insertado id =', formularioId);

    // 3) mapear users.id → medicos.id (puede quedar NULL)
    let medicoId = null;
    if (creadoPor) {
      const [mRow] = await conn.query('SELECT id FROM medicos WHERE user_id=? LIMIT 1', [creadoPor]);
      medicoId = mRow[0]?.id ?? null;
    }

    // 4) Cabecera (usa TUS columnas)
    //    Guardamos todos los jsons que pide tu tabla
    const odontogramaJson            = JSON.stringify({ dientes: odontoDientes, generales: txGenerales });
    const tratamientosPorDienteJson  = JSON.stringify(odontoDientes);
    const tratamientosGeneralesJson  = JSON.stringify(txGenerales);

    await conn.query(
      `INSERT INTO formulario_diag_infantil
        (formulario_id, paciente_id, medico_id, fecha, numero_paciente,
         odontograma_json, tratamientos_por_diente_json, tratamientos_generales_json,
         meses, total_costo, total_mensual)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), ?, ?, ?)`,
      [
        formularioId, pacienteId, medicoId, fecha, numeroPaciente,
        odontogramaJson, tratamientosPorDienteJson, tratamientosGeneralesJson,
        meses, totalCosto, totalMensual
      ]
    );
    console.log('✔️ cabecera diag-infantil insertada');

    // 5) Detalle: dientes (en tu tabla smallint diente)
    if (odontoDientes.length) {
      const values = [];
      const params = [];
      odontoDientes.forEach(it => {
        values.push('(?, ?, ?, ?)');
        params.push(
          formularioId,
          Number.parseInt(it?.diente, 10) || 0,
          String(it?.tratamiento ?? ''),
          (it?.costo == null ? null : Number(it.costo))
        );
      });

      await conn.query(
        `INSERT INTO formulario_diag_infantil_detalle (formulario_id, diente, tratamiento, costo)
         VALUES ${values.join(',')}`,
        params
      );
      console.log(`✔️ ${odontoDientes.length} filas detalle (dientes) insertadas`);
    }

    // 6) Detalle: generales
    if (txGenerales.length) {
      const values = [];
      const params = [];
      txGenerales.forEach(g => {
        values.push('(?, ?, ?)');
        params.push(
          formularioId,
          String(g?.nombre ?? ''),
          (g?.costo == null ? null : Number(g.costo))
        );
      });

      await conn.query(
        `INSERT INTO formulario_diag_infantil_generales (formulario_id, tratamiento, costo)
         VALUES ${values.join(',')}`,
        params
      );
      console.log(`✔️ ${txGenerales.length} filas detalle (generales) insertadas`);
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

const { insertPaciente } = require('../models/pacientes.model');

async function crearPaciente(req, res) {
  try {
    const b = req.body || {};
    if (!b?.nombre || !b?.apellido || !b?.sexo || !b?.telefono_principal) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const nuevoId = await insertPaciente({
      nombre:              b.nombre?.trim(),
      apellido:            b.apellido?.trim(),
      sexo:                b.sexo,
      fecha_nacimiento:    b.fecha_nacimiento || null,
      edad:                Number.isFinite(b.edad) ? b.edad : null,
      email:               b.email || null,
      estado_civil:        b.estado_civil || null,
      telefono_principal:  b.telefono_principal?.trim(),
      telefono_secundario: b.telefono_secundario || null,
      domicilio:           b.domicilio || null,
      ocupacion:           b.ocupacion || null
    });

    // 🔴 IMPORTANTE: cerrar la respuesta
    return res.status(201).json({ id: nuevoId });

  } catch (err) {
    console.error('❌ crearPaciente error:', err);
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Registro duplicado' });
    }
    return res.status(500).json({ error: 'Error al crear paciente' });
  }
}

const uploadStudy = [
  upload.single('file'),
  async (req, res) => {
    try {
      const pacienteId = Number(req.params.id);
      if (!pacienteId) {
        return res.status(400).json({ error: 'paciente_id inválido' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'Archivo no proporcionado (campo: file)' });
      }

      const originalName = req.file.originalname || 'archivo';
      const ext = (path.extname(originalName) || '').toLowerCase();

      if (!ALLOWED_EXT.includes(ext)) {
        return res.status(400).json({ 
          error: `Extensión no permitida. Usar: ${ALLOWED_EXT.join(', ')}`
        });
      }

      // Detectar MIME (si no viene, inferir por extensión)
      const detectedMime = req.file.mimetype || mime.lookup(ext) || 'application/octet-stream';

      // Validar "imagen" vs "DICOM"
      const isDicom = (ext === '.dcm') || detectedMime === 'application/dicom' || detectedMime === 'application/dicom+json';
      const isImage = (!isDicom && detectedMime.startsWith(IMAGE_MIME_PREFIX));

      if (!isDicom && !isImage) {
        return res.status(400).json({ 
          error: 'Sólo se aceptan imágenes (image/*) o archivos .dcm (DICOM)'
        });
      }

      // Hash de nombre (evita colisiones) + conservar extensión
      const hash = crypto
        .createHash('sha256')
        .update(originalName + Date.now().toString() + crypto.randomBytes(16))
        .digest('hex')
        .slice(0, 24); // compacto
      const hashedName = `${hash}${ext}`;

      // Enviar al Visualizador Flask (/upload) con el nombre hasheado
      // IMPORTANTE: Flask espera el campo 'imagen'
      const form = new FormData();
      form.append('imagen', req.file.buffer, { filename: hashedName, contentType: detectedMime });

      const VISUALIZADOR_BASE = process.env.VISUALIZADOR_BASE || 'http://localhost:3010';
      const flaskUrl = `${VISUALIZADOR_BASE}/upload`;

      // Nota: Flask devolverá el HTML; no necesitamos parsear
      // Lo importante es que guardará el archivo exactamente con 'hashedName'
      await axios.post(flaskUrl, form, { headers: form.getHeaders() });

      // Construir storage_path ruteable por tu gateway
      // (Asegúrate que el proxy del gateway no reescriba el path)
      const storage_path = `/visualizador/uploads/${hashedName}`;

      // Tipo: usar el provisto o inferir
      let tipo = (req.body.tipo || '').toLowerCase();
      const ALLOWED_TIPOS = ['rx','panoramica','tac','cbct','foto','otro'];
      if (!ALLOWED_TIPOS.includes(tipo)) {
        // Inferencia básica: imagen => 'foto', DICOM => 'otro' (o lo que prefieras)
        tipo = isDicom ? 'otro' : 'foto';
      }

      const notas = (req.body.notas || '').toString().slice(0, 500) || null;

      // 👇 AQUÍ LEEMOS EL group_id QUE VIENE DEL FRONT
      const rawGroupId = (req.body.group_id || req.body.groupId || '').toString().trim();
      const group_id = rawGroupId || null;

      // Insertar en BD
      const record = await insertPatientFile({
        paciente_id: pacienteId,
        tipo,
        nombre_archivo: hashedName,            // ✅ solo el nombre hasheado
        storage_path,                          // ✅ ruta pública ruteable via gateway
        size_bytes: req.file.size || null,
        mime_type: detectedMime || null,
        notas,
        group_id                               // ✅ AHORA SÍ SE GUARDA
      });

      return res.status(201).json({
        ok: true,
        file: {
          id: record.id,
          paciente_id: pacienteId,
          tipo,
          nombre_archivo: hashedName,
          storage_path,
          size_bytes: req.file.size || null,
          mime_type: detectedMime || null,
          fecha_subida: record.fecha_subida,
          notas
        }
      });

    } catch (err) {
      console.error('❌ uploadStudy error:', err);
      return res.status(500).json({ error: 'Error al subir estudio' });
    }
  }
];


// === Funciones para obtener información de formularios específicos ===

// === Obtener RECETA por formulario_id (cabecera + medicamentos) ===
async function getRecetaByFormularioId(req, res) {
  const formularioId = Number(req.params.formularioId || 0);
  if (!formularioId) return res.status(400).json({ error: 'formulario_id inválido' });

  try {
    const [hdrRows] = await db.query(
      `SELECT r.formulario_id, r.paciente_id, r.medico_id, r.fecha,
              r.edad_texto, r.edad_anios, r.nombre_medico, r.cedula,
              r.firma_path               -- 👈 AÑADIMOS ESTO
       FROM formulario_receta r
       WHERE r.formulario_id = ? LIMIT 1`,
      [formularioId]
    );
    if (!hdrRows.length) return res.status(404).json({ error: 'Receta no encontrada' });

    const hdr = hdrRows[0];

    const [pacRows] = await db.query(
      `SELECT id, nombre, apellido, edad FROM pacientes WHERE id = ? LIMIT 1`,
      [hdr.paciente_id]
    );
    const paciente = pacRows[0] || null;

    const [meds] = await db.query(
      `SELECT medicamento AS nombre, dosis, frecuencia, duracion, indicaciones
       FROM formulario_receta_medicamentos
       WHERE formulario_id = ?
       ORDER BY id ASC`,
      [formularioId]
    );

    let doctor = null;
    if (hdr.medico_id) {
      const [dRows] = await db.query(
        `SELECT id, CONCAT_WS(' ', COALESCE(nombre,''), COALESCE(apellido,'')) AS nombre
         FROM medicos WHERE id = ? LIMIT 1`,
        [hdr.medico_id]
      );
      doctor = dRows[0] || null;
    }

    return res.json({
      formulario_id : hdr.formulario_id,
      paciente_id   : hdr.paciente_id,
      fecha         : hdr.fecha,                 // YYYY-MM-DD
      edad_texto    : hdr.edad_texto,
      edad_anios    : hdr.edad_anios,
      nombre_medico : hdr.nombre_medico,
      cedula        : hdr.cedula,
      firma_path    : hdr.firma_path || null,    // 👈 AQUÍ SALE AL FRONT
      paciente,
      doctor,
      medicamentos  : meds
    });
  } catch (err) {
    console.error('❌ getRecetaByFormularioId error:', err);
    return res.status(500).json({ error: 'Error al consultar receta' });
  }
}


async function getRecetaDetalle(req, res) {
  const { formularioId } = req.params;

  const [cabRows] = await db.query(
    `SELECT f.id AS formulario_id, f.tipo_id, f.estado,
            fr.fecha, fr.paciente_id, fr.edad_anios, fr.edad_texto,
            fr.nombre_medico, fr.cedula, fr.firma_path,
            p.nombre, p.apellido, p.edad
     FROM formulario f
     JOIN formulario_receta fr ON fr.formulario_id = f.id
     JOIN pacientes p          ON p.id = fr.paciente_id
     WHERE f.id = ?`, [formularioId]
  );
  if (!cabRows.length) return res.status(404).json({ error: 'No existe la receta' });

  const cab = cabRows[0];
  const [meds] = await db.query(
    `SELECT medicamento, dosis, frecuencia, duracion, indicaciones
     FROM formulario_receta_medicamentos
     WHERE formulario_id = ?
     ORDER BY id`, [formularioId]
  );

  res.json({
    formulario_id: cab.formulario_id,
    tipo_id: cab.tipo_id,
    estado: cab.estado,
    fecha: cab.fecha, // YYYY-MM-DD en tu BD
    paciente_id: cab.paciente_id,
    paciente: { nombre: cab.nombre, apellido: cab.apellido, edad: cab.edad },
    edad_anios: cab.edad_anios,
    edad_texto: cab.edad_texto,
    nombre_medico: cab.nombre_medico,
    cedula: cab.cedula,
    firma_path: cab.firma_path, // null si no hay
    medicamentos: meds
  });
}

async function getFirmaByFile(req, res) {
  try {
    const fileName = req.params.fileName;

    // Evitar path traversal tipo "../../etc/passwd"
    if (!fileName || /[\/\\]/.test(fileName)) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    const fullPath = path.join(FIRMAS_DIR, fileName);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Archivo de firma no encontrado' });
    }

    // Si luego guardas JPG/WEBP, podrías inferir el MIME según la extensión
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('❌ getFirmaByFile error:', err);
    return res.status(500).json({ error: 'Error al obtener archivo de firma' });
  }
}

async function obtenerJustificante(req, res) {
  try {
    // Acepta /:formularioId o /:formId
    const formularioId = Number(
      req.params.formularioId || req.params.formId || req.params.id || 0
    );
    if (!formularioId) {
      return res.status(400).json({ error: 'formulario_id inválido' });
    }

    const j = await getJustificanteByFormId(formularioId);

    if (!j) {
      return res.status(404).json({ error: 'Justificante no encontrado' });
    }

    // 👇 Asegúrate de incluir firma_path aquí
    return res.json({
      formulario_id:        j.formulario_id,
      paciente_id:          j.paciente_id,
      nombre_paciente:      j.nombre_paciente,
      fecha_emision:        j.fecha_emision,
      procedimiento:        j.procedimiento,
      fecha_procedimiento:  j.fecha_procedimiento,
      dias_reposo:          j.dias_reposo,
      numero_paciente:      j.numero_paciente,
      firma_path:           j.firma_path,
      // si quieres no mandar el hash al front, puedes omitirlo:
      // firma_hash:           j.firma_hash,
      firma_profesional_at: j.firma_profesional_at
    });
  } catch (err) {
    console.error("❌ Error obtenerJustificante:", err);
    res.status(500).json({ error: 'Error obteniendo justificante' });
  }
}



// === Obtener CONSENTIMIENTO ODONTOLÓGICO por formulario_id ===
async function obtenerConsentOdont(req, res) {
  try {
    const formularioId = Number(req.params.formId || req.params.formularioId || 0);
    if (!formularioId) {
      return res.status(400).json({ error: 'formulario_id inválido' });
    }

    const [rows] = await db.query(`
      SELECT
        f.id AS formulario_id,
        f.estado AS estado_formulario,
        f.eliminado_logico,

        co.paciente_id,
        co.medico_id,
        co.fecha,
        co.numero_paciente,
        co.tratamiento,
        co.monto,
        co.ausencia_dias,
        co.autorizacion_check,
        co.economico_check,
        co.ausencia_check,

        -- 🔥 CAMPOS DE FIRMA
        co.firma_path,
        co.firma_hash,
        co.firma_paciente_at,

        -- Paciente
        p.id AS paciente_id_real,
        p.nombre AS paciente_nombre,
        p.apellido AS paciente_apellido,
        CONCAT_WS(' ', COALESCE(p.nombre,''), COALESCE(p.apellido,'')) AS paciente_nombre_completo

      FROM formulario f
      JOIN formulario_consent_odont co ON co.formulario_id = f.id
      JOIN pacientes p ON p.id = co.paciente_id
      WHERE f.id = ?
        AND f.eliminado_logico = 0
      LIMIT 1
    `, [formularioId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Consentimiento odontológico no encontrado' });
    }

    const r = rows[0];

    return res.json({
      formulario_id: r.formulario_id,
      estado: r.estado_formulario,

      fecha: r.fecha,
      numero_paciente: r.numero_paciente,
      tratamiento: r.tratamiento,

      monto: r.monto != null ? Number(r.monto) : null,
      ausencia_dias: r.ausencia_dias != null ? Number(r.ausencia_dias) : null,

      autorizacion_check: !!r.autorizacion_check,
      economico_check: !!r.economico_check,
      ausencia_check: !!r.ausencia_check,

      // 🔥 FIRMA
      firma_path: r.firma_path || null,
      firma_hash: r.firma_hash || null,
      firma_paciente_at: r.firma_paciente_at,
      firmado: r.firma_paciente_at != null,

      paciente: {
        id: r.paciente_id_real,
        nombre: r.paciente_nombre,
        apellido: r.paciente_apellido,
        nombre_completo: r.paciente_nombre_completo
      },

      medico_id: r.medico_id
    });

  } catch (err) {
    console.error('❌ obtenerConsentOdont error:', err);
    return res.status(500).json({ error: 'Error al consultar consentimiento odontológico' });
  }
}


async function obtenerConsentQuiro(req, res) {
  try {
    const formId = Number(req.params.formId);
    if (!formId) return res.status(400).json({ error: 'formId inválido' });

    const row = await getConsentQuiroById(formId);
    if (!row) return res.status(404).json({ error: 'No encontrado' });

    const out = {
      formulario_id: row.formulario_id,
      fecha: row.fecha,
      numero_paciente: row.numero_paciente,

      pronostico: row.pronostico,
      condiciones_posop: row.condiciones_posop,
      recuperacion_dias: row.recuperacion_dias,

      historia_aceptada:        !!row.historia_aceptada,
      anestesia_consentida:     !!row.anestesia_consentida,
      pronostico_entendido:     !!row.pronostico_entendido,
      recuperacion_entendida:   !!row.recuperacion_entendida,
      responsabilidad_aceptada: !!row.responsabilidad_aceptada,
      economico_aceptado:       !!row.economico_aceptado,

      acuerdo_economico: row.acuerdo_economico,

      firma_paciente_at: row.firma_paciente_at,
      firma_medico_at:   row.firma_medico_at,

      paciente: {
        id: row.paciente_id,
        nombre_completo: row.paciente_nombre
      }
    };

    return res.json(out);
  } catch (err) {
    console.error('obtenerConsentQuiro error:', err?.sqlMessage || err?.message, err);
    return res.status(500).json({ error: 'Error interno' });
  }
}

// 📌 obtener detalle ORTODONCIA
async function obtenerOrtodonciaDetalle(req, res) {
  const { formularioId } = req.params;
  console.log(`🔍 Buscando ortodoncia folio ${formularioId}`);

  const conn = await db.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT fo.*, f.paciente_id
      FROM formulario_ortodoncia fo
      JOIN formulario f ON f.id = fo.formulario_id
      WHERE fo.formulario_id = ? AND f.eliminado_logico = 0
      LIMIT 1
      `,
      [formularioId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "No existe ortodoncia" });
    }

    const r = rows[0];
    const J = (v) => {
      if (v == null) return [];
      if (Array.isArray(v)) return v;           // ya es arreglo
      if (typeof v === 'object') return v;      // ya es objeto (MySQL JSON)
      try { return JSON.parse(v); } catch { return []; }
    };
    const num = v => (v !== null && v !== undefined && v !== '' ? Number(v) : null);

    // 🧩 #2 Examen clínico
    const examenClinico = {
      tipoCuerpo: r.tipo_cuerpo,
      tipoCara: r.tipo_cara,
      tipoCraneo: r.tipo_craneo,
      otros: r.examen_otros
    };

    // 🧠 #3 Funcional
    const analisisFuncional = {
      respiracion: r.fun_respiracion,
      deglucion: r.fun_deglucion,
      masticacion: r.fun_masticacion,
      fonacion: r.fun_fonacion,
      problemasATM: r.atm_problemas_actuales,
      dolorATM: r.atm_dolor_si ? "si" : "no",
      ruidosATM: r.atm_ruidos_si ? "si" : "no",
      dolorPalpacion: r.atm_dolor_palpacion,
      aperturaMax: num(r.atm_max_apertura_mm),
      latIzq: num(r.atm_lateralidad_izq_mm),
      protrusion: num(r.atm_protrusion_mm),
      latDer: num(r.atm_lateralidad_der_mm),
      verticalOCRC: num(r.dis_ocrc_vertical_mm),
      horizontalOCRC: num(r.dis_ocrc_horizontal_mm),
      otrosOCRC: r.dis_ocrc_otro
    };

    // 🦷 #4 Modelos
    const analisisModelos = {
      relacionesDentarias: {
        oclusionMolaresDer: num(r.mod_ocl_molares_der_mm),
        oclusionMolaresIzq: num(r.mod_ocl_molares_izq_mm),
        oclusionCaninosDer: num(r.mod_ocl_caninos_der_mm),
        oclusionCaninosIzq: num(r.mod_ocl_caninos_izq_mm),
        resalteHorizontal: num(r.mod_resalte_horizontal_mm),
        resalteVertical: num(r.mod_resalte_vertical_mm),
        lineaMediaSup: num(r.mod_linea_media_sup_mm),
        lineaMediaInf: num(r.mod_linea_media_inf_mm),
        mordidaCruzadaDer: num(r.mod_mordida_cruzada_post_der_mm),
        mordidaCruzadaIzq: num(r.mod_mordida_cruzada_post_izq_mm)
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
    };

    // 📏 #5 Índices
    const indicesValorativos = {
      pontMaxilar: {
        premaxila: { nc: num(r.pont_premaxila_nc), pac: num(r.pont_premaxila_pac), dif: num(r.pont_premaxila_dif) },
        premolares: { nc: num(r.pont_premolares_nc), pac: num(r.pont_premolares_pac), dif: num(r.pont_premolares_dif) },
        molares: { nc: num(r.pont_molares_nc), pac: num(r.pont_molares_pac), dif: num(r.pont_molares_dif) }
      },
      pontMandibular: {
        premolares: { pac: num(r.col_mand_premolares_pac), dif: num(r.col_mand_premolares_dif) },
        molares: { pac: num(r.col_mand_molares_pac), dif: num(r.col_mand_molares_dif) }
      },
      sumaIncisivos: num(r.suma_incisivos),
      boltonSuperiores: J(r.bolton_sup_json),
      boltonInferiores: J(r.bolton_inf_json),
      diferenciaBolton: num(r.bolton_dif_mm),
      longitudArco: {
        apinamiento: num(r.long_apinamiento_mm),
        protrusionDental: num(r.long_protrusion_dental_mm),
        curvaSpee: num(r.long_curva_spee_mm),
        totalLongitud: num(r.long_total_mm)
      }
    };

    // ⚙️ #6 Plan
    const planTratamiento = {
      ortopediaMaxilar: r.plan_ortopedia_maxilar,
      ortopediaMandibula: r.plan_ortopedia_mandibula,
      dientesInfIncisivo: r.plan_inf_incisivo,
      dientesInfMolar: r.plan_inf_molar,
      dientesSupMolar: r.plan_sup_molar,
      dientesSupIncisivo: r.plan_sup_incisivo,
      dientesSupEstetica: r.plan_sup_estetica,
      anclaje: { maxilar: r.anclaje_max, mandibular: r.anclaje_man }
    };

    // 🧠 #7 Cefalometría
    const analisisCefalometrico = {
      biotipoFacial: J(r.biotipo_facial_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), diferencia: num(it.diferencia), dc: num(it.dc), resultado: num(it.resultado)
      })),
      claseEsqueletica: J(r.clase_esqueletica_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      })),
      problemasVerticales: J(r.problemas_verticales_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      })),
      factoresDentales: J(r.factores_dentales_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      })),
      diagnosticoCefalometrico: r.diagnostico
    };

    // ➕ #8 Factores complementarios
    const factoresComplementarios = {
      claseII: J(r.clase_ii_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      })),
      claseIII: J(r.clase_iii_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      })),
      verticales: J(r.compl_verticales_json).map(it => ({
        factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc)
      }))
    };

    // 📊 #9–11 Tablas finales
    const analisisJaraback = J(r.jaraback_json).map(it => ({ factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc) }));
    const medidasLineales = J(r.medidas_lineales_json).map(it => ({ factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc) }));
    const analisisMcNamara = J(r.mcnamara_json).map(it => ({ factor: it.factor, nc: num(it.nc), paciente: num(it.paciente), dc: num(it.dc) }));

    // ✅ Salida lista para FE
    const out = {
      formularioId: r.formulario_id,
      pacienteId: r.paciente_id,
      nombrePaciente: r.nombre_paciente,
      fechaIngreso: r.fecha_ingreso,
      fechaAlta: r.fecha_alta,
      examenClinico,
      analisisFuncional,
      analisisModelos,
      indicesValorativos,
      planTratamiento,
      analisisCefalometrico,
      factoresComplementarios,
      analisisJaraback,
      medidasLineales,
      analisisMcNamara
    };

    return res.json(out);
    
  } catch (err) {
    console.error("❌ Error ORTO detalle:", err);
    return res.status(500).json({ error: "Error al consultar ortodoncia" });
  } finally {
    conn.release();
  }
}

async function obtenerHistoriaDetalle(req, res) {
  try {
    const { formularioId } = req.params;
    const folio = Number(formularioId);
    if (!folio) {
      return res.status(400).json({ error: 'formularioId inválido' });
    }

    const data = await getHistoriaByFormId(folio);
    if (!data) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    // Normaliza columnas JSON (si vienen como string)
    const jsonFields = [
      'antecedentes_patologicos_json',
      'solo_mujeres_json',
      'no_patologicos_json',
      'antecedentes_familiares_json'
    ];
    jsonFields.forEach((k) => {
      if (typeof data[k] === 'string') {
        try { data[k] = JSON.parse(data[k]); } catch {}
      }
    });

    // 🔥 Normalizamos los campos de firma para que el frontend siempre los reciba
    data.firma_path        = data.firma_path || null;
    data.firma_hash        = data.firma_hash || null;
    data.firma_paciente_at = data.firma_paciente_at || null;

    return res.json(data);

  } catch (err) {
    console.error('❌ Error obtenerHistoriaDetalle:', err);
    return res.status(500).json({ error: 'Error al consultar historia' });
  }
}


async function obtenerOdontogramaFinal(req, res) {
  try {
    const formularioId = Number(req.params.formularioId);
    if (!formularioId) {
      return res.status(400).json({ ok: false, error: 'formularioId inválido' });
    }

    const data = await getOdontogramaFinalByFormularioId(formularioId);
    if (!data) return res.status(404).json({ ok: false, error: 'No encontrado' });

    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error('obtenerOdontogramaFinal error:', err);
    return res.status(500).json({ ok: false, error: 'Error al obtener odontograma final' });
  }
}

async function getPresupuestoByFormId(req, res) {
  try {
    const formularioId = Number(req.params.formularioId);
    if (!formularioId) {
      return res.status(400).json({ ok: false, error: 'formularioId inválido' });
    }

    const data = await getPresupuestoByFormIdModel(formularioId);
    if (!data) return res.status(404).json({ ok: false, error: 'No encontrado' });

    return res.json({ ok: true, ...data });

  } catch (err) {
    console.error('getPresupuestoByFormId error:', err);
    return res.status(500).json({ ok: false, error: 'Error al obtener presupuesto dental' });
  }
}

// =================== GET POR FORMULARIO_ID ===================
async function getDiagInfantilByFormId(req, res) {
  try {
    const formularioId = Number(req.params.formularioId);
    if (!formularioId) {
      return res.status(400).json({ ok: false, error: 'formularioId inválido' });
    }

    const data = await getDiagInfantilByFormularioId(formularioId);
    if (!data) return res.status(404).json({ ok: false, error: 'No encontrado' });

    return res.json({ ok: true, ...data });
  } catch (err) {
    console.error('getDiagInfantilByFormId error:', err);
    return res.status(500).json({ ok: false, error: 'Error al obtener diag-infantil' });
  }
}

async function getEvolucionByFormId(req, res) {
  try {
    const formularioId = Number(req.params.formularioId);
    if (!formularioId) {
      return res.status(400).json({ ok: false, error: 'formularioId inválido' });
    }

    const conn = await db.getConnection();
    try {
      // ----- Cabecera -----
      const [cabRows] = await conn.query(
        `
        SELECT fe.formulario_id, fe.paciente_id, fe.numero_paciente, fe.fecha_registro,
               fe.evoluciones_json,
               p.nombre, p.apellido
        FROM formulario_evolucion fe
        JOIN pacientes p ON p.id = fe.paciente_id
        WHERE fe.formulario_id = ?
        LIMIT 1
        `,
        [formularioId]
      );

      if (!cabRows.length) {
        return res.status(404).json({ ok: false, error: 'No encontrado' });
      }

      const cab = cabRows[0];
      const nombrePaciente = [cab.nombre, cab.apellido].filter(Boolean).join(' ').trim();

      // ----- Detalle de evoluciones -----
      const [detRows] = await conn.query(
        `
        SELECT
          id,
          fecha,
          tratamiento,
          costo,
          ac,
          proxima_cita_tx AS proxima
        FROM formulario_evolucion_detalle
        WHERE formulario_id = ?
        ORDER BY fecha ASC, id ASC
        `,
        [formularioId]
      );

      return res.json({
        ok: true,
        formulario_id: cab.formulario_id,
        paciente_id: cab.paciente_id,
        numero_paciente: cab.numero_paciente,
        paciente: nombrePaciente,
        fecha_registro: cab.fecha_registro,
        evoluciones: detRows.map(r => ({
          id: r.id,
          fecha: r.fecha,
          tratamiento: r.tratamiento,
          costo: r.costo,
          ac: r.ac,
          proxima: r.proxima || ''
        }))
      });

    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('getEvolucionByFormId error:', err);
    return res.status(500).json({ ok: false, error: 'Error al obtener evolución' });
  }
}

async function appendEvoluciones(req, res) {
  try {
    const { formularioId } = req.params;
    const { evoluciones } = req.body || {};
    const userId = req.user?.id || null;

    if (!formularioId) return res.status(400).json({ error: 'Falta formularioId' });
    if (!Array.isArray(evoluciones) || evoluciones.length === 0) {
      return res.status(400).json({ error: 'No hay evoluciones para anexar' });
    }

    const header = await getEvolucionCabeceraByFormId(formularioId);
    if (!header) return res.status(404).json({ error: 'Formulario de evolución no encontrado' });

    await appendEvolucionesDetalle(formularioId, evoluciones, userId);

    return res.json({
      ok: true,
      formulario_id: Number(formularioId),
      appended: evoluciones.length,
      message: 'Evolución agregada al mismo formulario (folio) correctamente.',
    });
  } catch (err) {
    console.error('appendEvoluciones error:', err);
    return res.status(500).json({ error: 'Error al anexar evoluciones' });
  }
}



module.exports = {
  crearPaciente,
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
  crearOdontogramaFinal,
  crearPresupuestoDental,
  crearDiagInfantil,
  crearReceta,
  uploadStudy,
  // Obtener info específica de formularios
  getRecetaByFormularioId,
  getRecetaDetalle,
  // getRecetaFirma,  // 👈 ESTA YA NO
  obtenerJustificante,
  obtenerConsentOdont,
  obtenerConsentQuiro,
  obtenerOrtodonciaDetalle,
  obtenerHistoriaDetalle,
  obtenerOdontogramaFinal,
  getPresupuestoByFormId,
  getDiagInfantilByFormId,
  getEvolucionByFormId,
  appendEvoluciones,

  // 👇 NUEVO
  getFirmaByFile
};
