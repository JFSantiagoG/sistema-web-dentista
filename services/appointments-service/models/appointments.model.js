// models/appointments.model.js
const db = require('../db/connection');

// ======== QUERIES BÁSICAS ========

exports.getTodayAppointments = async () => {
  const [rows] = await db.query(
    `SELECT a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo
     FROM appointments a
     WHERE a.fecha = CURDATE()
     ORDER BY a.hora_inicio ASC`
  );
  return rows;
};

exports.getAppointmentsByDate = async (fecha) => {
  const [rows] = await db.query(
    `SELECT a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo
     FROM appointments a
     WHERE a.fecha = ?
     ORDER BY a.hora_inicio ASC`,
    [fecha]
  );
  return rows;
};

exports.getAppointmentById = async (id) => {
  const [rows] = await db.query(
    `SELECT a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo
     FROM appointments a
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
};

exports.cancelAppointment = async (id) => {
  await db.query('DELETE FROM appointments WHERE id = ?', [id]);
  return true;
};

// Devuelve bloques ocupados ('HH:MM') en una fecha (cada inicio de bloque)
exports.getHoursByDate = async (fecha) => {
  const [rows] = await db.query(
    `SELECT hora_inicio, hora_fin
     FROM appointments
     WHERE fecha = ?
     ORDER BY hora_inicio ASC`,
    [fecha]
  );

  // convertir cada rango a bloques de 30
  const toMin = s => { const [H, M] = String(s).split(':').map(Number); return H * 60 + M; };
  const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const ocupadas = [];
  for (const r of rows) {
    if (!r.hora_inicio || !r.hora_fin) continue;
    let m = toMin(r.hora_inicio);
    const end = toMin(r.hora_fin);
    while (m < end) {
      ocupadas.push(toStr(m));
      m += 30;
    }
  }
  // solo el inicio de cada bloque
  return Array.from(new Set(ocupadas));
};

// Igual que arriba pero excluyendo una cita (para reprogramación)
exports.getBusyHalfHoursByDate = async (fecha, excludeId) => {
  const params = [fecha];
  let sql = `
    SELECT hora_inicio, hora_fin
    FROM appointments
    WHERE fecha = ?`;
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' ORDER BY hora_inicio ASC';

  const [rows] = await db.query(sql, params);

  const toMin = s => { const [H, M] = String(s).split(':').map(Number); return H * 60 + M; };
  const toStr = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const ocupadas = [];
  for (const r of rows) {
    if (!r.hora_inicio || !r.hora_fin) continue;
    let m = toMin(r.hora_inicio);
    const end = toMin(r.hora_fin);
    while (m < end) {
      ocupadas.push(toStr(m));
      m += 30;
    }
  }
  return Array.from(new Set(ocupadas));
};

// ======== ESCRITURAS ========

// Actualiza solo los campos enviados (undefined = no tocar; null = set null)
exports.updateAppointmentRange = async ({ id, fecha, hora_inicio, hora_fin, medico_id }) => {
  const sets = [];
  const params = [];
  if (fecha != null)       { sets.push('fecha = ?');       params.push(fecha); }
  if (hora_inicio != null) { sets.push('hora_inicio = ?'); params.push(hora_inicio); }
  if (hora_fin != null)    { sets.push('hora_fin = ?');    params.push(hora_fin); }
  if (medico_id !== undefined) { sets.push('medico_id = ?'); params.push(medico_id); }

  if (!sets.length) return;
  params.push(id);

  const sql = `UPDATE appointments SET ${sets.join(', ')} WHERE id = ?`;
  await db.query(sql, params);
  return true;
};

exports.insertRangeSingle = async ({ paciente_id, medico_id, fecha, hora_inicio, hora_fin, motivo }) => {
  await db.query(
    `INSERT INTO appointments (paciente_id, medico_id, fecha, hora_inicio, hora_fin, motivo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [paciente_id, (medico_id ?? null), fecha, hora_inicio, hora_fin, (motivo ?? null)]
  );
  return true;
};

// ======== NOTIFICACIONES (placeholder, ajusta a tu lógica real) ========
exports.resendInfo = async (id) => {
  const [rows] = await db.query(
    `SELECT a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo
     FROM appointments a
     WHERE a.id = ?`,
    [id]
  );
  const cita = rows[0] || null;
  if (!cita) return { ok: false, message: 'Cita no encontrada' };

  // Aquí pondrías tu integración de email/SMS/whatsapp, etc.
  return { ok: true, message: 'Información reenviada (simulado)', cita };
};

// models/appointments.model.js (reemplaza estas funciones)

// Citas de hoy con nombres
// Citas de hoy con nombres
exports.getTodayAppointments = async () => {
  const [rows] = await db.query(
    `SELECT
       a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo,
       CONCAT_WS(' ', COALESCE(p.nombre,''), COALESCE(p.apellido,'')) AS paciente,
       CONCAT_WS(' ', COALESCE(m.nombre,''), COALESCE(m.apellido,'')) AS medico
     FROM appointments a
     LEFT JOIN pacientes p ON p.id = a.paciente_id
     LEFT JOIN medicos   m ON m.id = a.medico_id
     WHERE a.fecha = CURDATE()
     ORDER BY a.hora_inicio ASC`
  );
  return rows;
};

// Citas por fecha con nombres
exports.getAppointmentsByDate = async (fecha) => {
  const [rows] = await db.query(
    `SELECT
       a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo,
       CONCAT_WS(' ', COALESCE(p.nombre,''), COALESCE(p.apellido,'')) AS paciente,
       CONCAT_WS(' ', COALESCE(m.nombre,''), COALESCE(m.apellido,'')) AS medico
     FROM appointments a
     LEFT JOIN pacientes p ON p.id = a.paciente_id
     LEFT JOIN medicos   m ON m.id = a.medico_id
     WHERE a.fecha = ?
     ORDER BY a.hora_inicio ASC`,
    [fecha]
  );
  return rows;
};

// Cita por id con nombres
exports.getAppointmentById = async (id) => {
  const [rows] = await db.query(
    `SELECT
       a.id, a.paciente_id, a.medico_id, a.fecha, a.hora_inicio, a.hora_fin, a.motivo,
       CONCAT_WS(' ', COALESCE(p.nombre,''), COALESCE(p.apellido,'')) AS paciente,
       CONCAT_WS(' ', COALESCE(m.nombre,''), COALESCE(m.apellido,'')) AS medico
     FROM appointments a
     LEFT JOIN pacientes p ON p.id = a.paciente_id
     LEFT JOIN medicos   m ON m.id = a.medico_id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
};
