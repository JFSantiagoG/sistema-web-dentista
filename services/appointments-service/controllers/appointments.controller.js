// controllers/appointments.controller.js
const model = require('../models/appointments.model');
const db = require('../db/connection');
const { filtrarHorasDisponibles, HORAS_CLINICA } = require('../utils/horarios');

// =================== ACCESOS (ajústalo a tu auth real) ===================
function puedeModificarCita() {
  return true;
}

// =================== HELPERS ===================
const toMin = s => { const [H, M] = String(s).split(':').map(Number); return H * 60 + M; };
const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const buildSlots = (ini, fin) => {
  const out = [];
  let m = toMin(ini);
  const end = toMin(fin);
  while (m < end) { out.push(toStr(m)); m += 30; }
  return out; // ['10:00','10:30','11:00', ...] (bloques de inicio)
};

/**
 * Traduce un valor que puede ser medicos.id o users.id a medicos.id real.
 *  - null/'' -> null
 *  - medicos.id válido -> ese id
 *  - users.id -> busca medicos.user_id = users.id y devuelve medicos.id
 *  - valor inválido -> undefined
 */
async function resolveMedicoId(medicoIdOrUserId) {
  if (medicoIdOrUserId == null || medicoIdOrUserId === '') return null;

  // ¿existe como medicos.id?
  let [rows] = await db.query('SELECT id FROM medicos WHERE id = ?', [medicoIdOrUserId]);
  if (rows.length) return rows[0].id;

  // ¿vino un users.id? (tradúcelo a medicos.id)
  [rows] = await db.query('SELECT id FROM medicos WHERE user_id = ?', [medicoIdOrUserId]);
  if (rows.length) return rows[0].id;

  return undefined;
}

// =================== LISTADO ===================

exports.getToday = async (_req, res) => {
  try {
    const citas = await model.getTodayAppointments();
    res.json(citas);
  } catch (err) {
    console.error('Error en getToday:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getByDate = async (req, res) => {
  try {
    const fecha = req.params.fecha; // 'YYYY-MM-DD'
    const citas = await model.getAppointmentsByDate(fecha);
    res.json(citas);
  } catch (err) {
    console.error('Error en getByDate:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================== DISPONIBILIDAD ===================

exports.getAvailableDates = async (_req, res) => {
  try {
    // días con menos de 10 citas (ajusta el umbral si quieres)
    const [rows] = await db.query(`
      SELECT fecha AS dia, COUNT(*) AS total
      FROM appointments
      GROUP BY fecha
      HAVING total < 10
      ORDER BY dia
    `);
    const disponibles = rows.map(r => r.dia);
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableDates:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getAvailableHours = async (req, res) => {
  try {
    const fecha = req.params.fecha; // 'YYYY-MM-DD'
    const ocupadas = await model.getHoursByDate(fecha); // array de 'HH:MM' ocupadas (bloques de inicio)
    const disponibles = filtrarHorasDisponibles(ocupadas);
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableHours:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================== ACCIONES ===================

exports.cancel = async (req, res) => {
  try {
    const id = req.params.id;
    await model.cancelAppointment(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al cancelar cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.postpone = async (req, res) => {
  try {
    const id = req.params.id;
    const cita = await model.getAppointmentById(id);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    if (!puedeModificarCita(req.user, cita)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    // Permite dos modos:
    // - viejo: body.nuevaFecha = 'YYYY-MM-DD HH:MM'
    // - nuevo: { fecha, horaInicio, horaFin }
    let { nuevaFecha, fecha, horaInicio, horaFin } = req.body || {};

    if (nuevaFecha && (!fecha || !horaInicio)) {
      // modo viejo: separa
      const [f, h] = String(nuevaFecha).split(' ');
      fecha = f;
      horaInicio = h?.slice(0, 5);
      // si no mandan fin, conserva duración original o 30min
      const durMin = (cita.hora_inicio && cita.hora_fin)
        ? (toMin(cita.hora_fin) - toMin(cita.hora_inicio))
        : 30;
      horaFin = toStr(toMin(horaInicio) + durMin);
    }

    // Validaciones básicas
    if (!fecha || !horaInicio || !horaFin) {
      return res.status(400).json({ error: 'fecha, horaInicio y horaFin son requeridos' });
    }
    if (!HORAS_CLINICA.includes(horaInicio)) {
      return res.status(400).json({ error: 'horaInicio fuera de horario de clínica' });
    }
    if (toMin(horaFin) <= toMin(horaInicio)) {
      return res.status(400).json({ error: 'horaFin debe ser mayor a horaInicio' });
    }

    // Construye los bloques de 30m que ocupará la cita
    const bloquesSolicitados = buildSlots(horaInicio, horaFin);

    // Ocupadas en ese día (como 'HH:MM'), excluyendo la misma cita
    const ocupadas = await model.getBusyHalfHoursByDate(fecha, id);
    const conflictos = bloquesSolicitados.filter(b => ocupadas.includes(b));
    if (conflictos.length) {
      return res.status(409).json({ error: 'Conflicto de horario', conflictos });
    }

    // Determinar médico a guardar:
    // prioridad:
    //   - si viene en el body (medicoId/medico_id como medicos.id o users.id) => traducir
    //   - si no viene, mantener el de la cita
    //   - si no existe, dejar NULL
    let medicoIdInput = req.body?.medicoId ?? req.body?.medico_id ?? req.user?.medicoId ?? req.user?.id ?? null;
    let medicoId = await resolveMedicoId(medicoIdInput);
    if (medicoId === undefined) {
      return res.status(400).json({ error: `Médico inválido: ${medicoIdInput}` });
    }
    if (medicoId === null) {
      medicoId = cita.medico_id ?? null; // conserva si ya tenía, o deja null
    }

    // Actualiza (modo rango)
    await model.updateAppointmentRange({
      id,
      fecha,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      medico_id: medicoId
    });

    res.json({ success: true, id, fecha, horaInicio, horaFin, medico_id: medicoId });
  } catch (err) {
    if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'El médico indicado no existe. Usa un medicos.id válido o deja el campo vacío.' });
    }
    console.error('Error al posponer cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.resend = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await model.resendInfo(id);
    res.json(result);
  } catch (err) {
    console.error('Error al reenviar información:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// =================== CREACIÓN ===================

exports.createRange = async (req, res) => {
  try {
    const { pacienteId, paciente_id, fecha, horaInicio, hora_inicio, horaFin, hora_fin, motivo } = req.body || {};
    const _pacienteId = pacienteId ?? paciente_id;

    if (!_pacienteId || !fecha || !(horaInicio ?? hora_inicio) || !(horaFin ?? hora_fin)) {
      return res.status(400).json({ error: 'Faltan campos obligatorios (pacienteId, fecha, horaInicio, horaFin)' });
    }

    const _horaInicio = horaInicio ?? hora_inicio;
    const _horaFin = horaFin ?? hora_fin;

    const idxIni = HORAS_CLINICA.indexOf(_horaInicio);
    const idxFin = HORAS_CLINICA.indexOf(_horaFin);
    if (idxIni === -1 || idxFin === -1 || idxFin <= idxIni) {
      return res.status(400).json({ error: 'Rango inválido o fuera de horario' });
    }

    // Validar solape
    const ocupadas = await model.getHoursByDate(fecha);
    const rango = HORAS_CLINICA.slice(idxIni, idxFin); // [inicio, fin)
    const conflicto = rango.some(h => ocupadas.includes(h));
    if (conflicto) {
      return res.status(409).json({ error: 'Horario ocupado' });
    }

    // Resolver médico
    let medicoIdInput = req.body?.medicoId ?? req.body?.medico_id ?? req.user?.medicoId ?? req.user?.id ?? null;
    let medicoId = await resolveMedicoId(medicoIdInput);
    if (medicoId === undefined) {
      return res.status(400).json({ error: `Médico inválido: ${medicoIdInput}` });
    }

    await model.insertRangeSingle({
      paciente_id: _pacienteId,
      medico_id: medicoId,     // puede ser null (FK SET NULL)
      fecha,
      hora_inicio: _horaInicio,
      hora_fin: _horaFin,
      motivo: motivo ?? null
    });

    res.json({ success: true, message: 'Cita creada correctamente' });
  } catch (err) {
    if (err?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'El médico indicado no existe. Usa un medicos.id válido o deja el campo vacío.' });
    }
    console.error('Error en createRange:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
