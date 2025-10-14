const model = require('../models/appointments.model');
const db = require('../db/connection');
const { puedeModificarCita, puedeVerCita } = require('../middleware/roles');
const { filtrarHorasDisponibles } = require('../utils/horarios');

// GET /api/appointments/today
exports.getToday = async (req, res) => {
  try {
    const citas = await model.getTodayAppointments();
    const visibles = citas.filter(cita => puedeVerCita(req.user, cita));
    res.json(visibles);
  } catch (err) {
    console.error('Error en getToday:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/appointments/by-date/:fecha
exports.getByDate = async (req, res) => {
  try {
    const fecha = req.params.fecha;
    const citas = await model.getAppointmentsByDate(fecha);
    const visibles = citas.filter(cita => puedeVerCita(req.user, cita));
    res.json(visibles);
  } catch (err) {
    console.error('Error en getByDate:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/appointments/cancel/:id
exports.cancel = async (req, res) => {
  try {
    const id = req.params.id;
    const cita = await model.getAppointmentById(id);
    if (!puedeModificarCita(req.user, cita)) {
      return res.status(403).json({ error: 'No autorizado para cancelar esta cita' });
    }
    await model.cancelAppointment(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al cancelar cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/appointments/postpone/:id
exports.postpone = async (req, res) => {
  try {
    const id = req.params.id;
    const { nuevaFecha } = req.body;
    const cita = await model.getAppointmentById(id);
    if (!puedeModificarCita(req.user, cita)) {
      return res.status(403).json({ error: 'No autorizado para posponer esta cita' });
    }
    await model.postponeAppointment(id, nuevaFecha);
    res.json({ success: true });
  } catch (err) {
    console.error('Error al posponer cita:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/appointments/resend/:id
exports.resend = async (req, res) => {
  try {
    const id = req.params.id;
    const cita = await model.getAppointmentById(id);
    console.log('🔁 Usuario:', req.user);
    console.log('🔁 Cita:', cita);
    console.log('🔁 ¿Puede modificar?', puedeModificarCita(req.user, cita));

    if (!puedeModificarCita(req.user, cita)) {
      return res.status(403).json({ error: 'No autorizado para reenviar esta cita' });
    }
    const result = await model.resendInfo(id);
    res.json(result);
  } catch (err) {
    console.error('Error al reenviar información:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/appointments/available-dates
exports.getAvailableDates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(fecha) AS dia, COUNT(*) AS total
      FROM appointments
      GROUP BY DATE(fecha)
      HAVING total < 10
    `);
    const disponibles = rows.map(r => r.dia);
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableDates:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/appointments/available-hours/:fecha
exports.getAvailableHours = async (req, res) => {
  try {
    const fecha = req.params.fecha;
    const [rows] = await db.query(`
      SELECT hora FROM appointments WHERE DATE(fecha) = ?
    `, [fecha]);

    const ocupadas = rows.map(r => r.hora);
    const disponibles = filtrarHorasDisponibles(ocupadas);
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableHours:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
