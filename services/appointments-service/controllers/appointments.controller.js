const model = require('../models/appointments.model');
const db = require('../db/connection');


exports.getToday = async (req, res) => {
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
    const fecha = req.params.fecha;
    const citas = await model.getAppointmentsByDate(fecha);
    res.json(citas);
  } catch (err) {
    console.error('Error en getByDate:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

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
    const { nuevaFecha } = req.body;
    await model.postponeAppointment(id, nuevaFecha);
    res.json({ success: true });
  } catch (err) {
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
// GET /api/appointments/available-dates
exports.getAvailableDates = async (req, res) => {
  const [rows] = await db.query(`
    SELECT DATE(fecha) AS dia, COUNT(*) AS total
    FROM appointments
    GROUP BY DATE(fecha)
    HAVING total < 10
  `);
  const disponibles = rows.map(r => r.dia);
  res.json(disponibles);
};

// GET /api/appointments/available-hours/:fecha
exports.getAvailableDates = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE_FORMAT(fecha, '%Y-%m-%d') AS dia
      FROM appointments
      GROUP BY dia
      HAVING COUNT(*) < 10
    `);

    console.log('Fechas disponibles:', rows); // ✅ prueba directa
    const disponibles = rows.map(r => r.dia); // ya son strings 'YYYY-MM-DD'
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableDates:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


exports.getAvailableHours = async (req, res) => {
  try {
    const fecha = req.params.fecha;
    const [rows] = await db.query(`
      SELECT hora FROM appointments WHERE DATE(fecha) = ?
    `, [fecha]);

    const ocupadas = rows.map(r => r.hora);
    const todas = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30'
    ];

    const disponibles = todas.filter(h => !ocupadas.includes(h));
    res.json(disponibles);
  } catch (err) {
    console.error('Error en getAvailableHours:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  } 
};

