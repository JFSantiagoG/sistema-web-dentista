const db = require('../db/connection');

async function getTodayAppointments() {
  const [rows] = await db.query(`
    SELECT a.id, p.id AS pacienteId, CONCAT(p.nombre, ' ', p.apellido) AS nombre,
           a.fecha, a.hora, a.motivo
    FROM appointments a
    JOIN pacientes p ON a.paciente_id = p.id
    WHERE DATE(a.fecha) = CURDATE()
  `);
  return rows;
}

async function getAppointmentsByDate(fecha) {
  const [rows] = await db.query(`
    SELECT a.id, p.id AS pacienteId, CONCAT(p.nombre, ' ', p.apellido) AS nombre,
           a.fecha, a.hora, a.motivo
    FROM appointments a
    JOIN pacientes p ON a.paciente_id = p.id
    WHERE DATE(a.fecha) = ?
  `, [fecha]);
  return rows;
}

async function cancelAppointment(id) {
  await db.query(`DELETE FROM appointments WHERE id = ?`, [id]);
}

async function postponeAppointment(id, nuevaFecha) {
  await db.query(`UPDATE appointments SET fecha = ? WHERE id = ?`, [nuevaFecha, id]);
}

async function resendInfo(id) {
  // Simulación: aquí podrías integrar correo o SMS
  return { success: true, message: `Información reenviada para cita #${id}` };
}

module.exports = {
  getTodayAppointments,
  getAppointmentsByDate,
  cancelAppointment,
  postponeAppointment,
  resendInfo
};
