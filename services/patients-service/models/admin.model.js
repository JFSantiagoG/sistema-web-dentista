const db = require('../db/connection');
const bcrypt = require('bcryptjs');

const ALLOWED_ROLES = new Set(['admin', 'doctor', 'asistente']);

function genTempPassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeRoleNames(roleNames) {
  if (!Array.isArray(roleNames)) return [];
  return [...new Set(roleNames.map(s => String(s).trim().toLowerCase()))]
    .filter(r => ALLOWED_ROLES.has(r));
}

async function getRoleIdsByName(conn, roleNames) {
  if (!roleNames.length) return [];

  const placeholders = roleNames.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id, name FROM roles WHERE name IN (${placeholders})`,
    roleNames
  );

  if (rows.length !== roleNames.length) {
    throw new Error('Uno o más roles no existen en tabla roles');
  }

  const map = new Map(rows.map(r => [r.name, r.id]));
  return roleNames.map(name => map.get(name));
}

async function listUsersWithRoles(search = '') {
  const like = `%${search}%`;

  const [rows] = await db.query(`
    SELECT u.id, u.email, u.is_active,
           GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ',') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE (? = '' OR u.email LIKE ?)
    GROUP BY u.id
    ORDER BY u.id DESC
    LIMIT 200
  `, [search, like]);

  return rows.map(r => ({
    id: r.id,
    email: r.email,
    is_active: !!r.is_active,
    roles: r.roles ? r.roles.split(',') : []
  }));
}

/**
 * POST /admin/users
 * payload:
 * {
 *   email,
 *   tempPassword? (optional),
 *   roleNames: ['doctor'|'admin'|'asistente'],
 *   medico?: { ...campos medicos... } // si role incluye doctor
 * }
 */
async function createUser(payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  const roles = normalizeRoleNames(payload?.roleNames);
  const tempPassword = String(payload?.tempPassword || '').trim(); // opcional
  const medico = payload?.medico || null;

  if (!email || !email.includes('@')) throw new Error('email es obligatorio');
  if (!roles.length) throw new Error('roleNames debe incluir al menos: admin, doctor o asistente');

  const [exists] = await db.query('SELECT 1 FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1', [email]);
  if (exists.length) throw new Error('Ya existe un usuario con ese email');

  const finalPass = tempPassword || genTempPassword(12);
  const passHash = await bcrypt.hash(finalPass, 10);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) users
    const [uRes] = await conn.query(
      `INSERT INTO users (email, password_hash, is_active) VALUES (?, ?, 1)`,
      [email, passHash]
    );
    const userId = uRes.insertId;

    // 2) user_roles
    const roleIds = await getRoleIdsByName(conn, roles);
    const values = roleIds.map(roleId => [userId, roleId]);
    await conn.query(`INSERT INTO user_roles (user_id, role_id) VALUES ?`, [values]);

    // 3) si doctor -> medicos
    if (roles.includes('doctor')) {
      if (!medico) throw new Error('Para rol doctor, medico es obligatorio');

      const nombre = String(medico?.nombre || '').trim();
      const apellido = String(medico?.apellido || '').trim();
      if (!nombre || !apellido) throw new Error('Para doctor: medico.nombre y medico.apellido son obligatorios');

      await conn.query(`
        INSERT INTO medicos
        (nombre, apellido, cedula, especialidad, genero, email, rfc,
         telefono_principal, telefono_secundario, direccion, firma_url, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        nombre,
        apellido,
        medico.cedula || null,
        medico.especialidad || null,
        medico.genero || null,
        email,
        medico.rfc || null,
        medico.telefono_principal || null,
        medico.telefono_secundario || null,
        medico.direccion || null,
        medico.firma_url || null,
        userId
      ]);
    }

    await conn.commit();

    return {
      ok: true,
      userId,
      email,
      roles,
      tempPassword: finalPass
    };
  } catch (e) {
    await conn.rollback();
    if (String(e.message || '').includes('Duplicate')) {
      throw new Error('Ya existe un usuario con ese email');
    }
    throw e;
  } finally {
    conn.release();
  }
}

async function setUserActive(userId, isActive) {
  const [res] = await db.query(`UPDATE users SET is_active = ? WHERE id = ?`, [isActive, userId]);
  if (res.affectedRows === 0) throw new Error('Usuario no encontrado');
}

async function resetUserPassword(userId, tempPassword) {
  const password = (tempPassword && String(tempPassword).trim()) || genTempPassword(12);
  const hash = await bcrypt.hash(password, 10);

  const [res] = await db.query(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, userId]);
  if (res.affectedRows === 0) throw new Error('Usuario no encontrado');

  return { tempPassword: password };
}

async function setUserRolesByName(userId, roleNames) {
  const roles = normalizeRoleNames(roleNames);
  if (!roles.length) throw new Error('Roles inválidos. Usa: admin, doctor, asistente');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const roleIds = await getRoleIdsByName(conn, roles);

    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    const values = roleIds.map(roleId => [userId, roleId]);
    await conn.query(`INSERT INTO user_roles (user_id, role_id) VALUES ?`, [values]);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listMedicos(search = '') {
  const like = `%${search}%`;
  const [rows] = await db.query(`
    SELECT id, nombre, apellido, cedula, especialidad, genero, email,
           rfc, telefono_principal, telefono_secundario, direccion, firma_url,
           creado_en, actualizado_en, user_id
    FROM medicos
    WHERE (? = '' OR email LIKE ? OR nombre LIKE ? OR apellido LIKE ?)
    ORDER BY id DESC
    LIMIT 200
  `, [search, like, like, like]);

  return rows;
}

async function createDoctorFull(payload) {
  const {
    email,
    password, // opcional
    nombre,
    apellido,
    cedula = null,
    especialidad = null,
    genero = null,
    rfc = null,
    telefono_principal = null,
    telefono_secundario = null,
    direccion = null,
    firma_url = null,
  } = payload;

  if (!email || !nombre || !apellido) {
    throw new Error('Faltan campos obligatorios: email, nombre, apellido');
  }

  const plainPassword = (password && String(password).trim()) || genTempPassword(12);

  const [doctorRole] = await db.query(`SELECT id FROM roles WHERE name = 'doctor' LIMIT 1`);
  if (!doctorRole.length) throw new Error("No existe rol 'doctor' en tabla roles");

  const passHash = await bcrypt.hash(String(plainPassword), 10);

  await db.query('START TRANSACTION');
  try {
    const [uRes] = await db.query(
      `INSERT INTO users (email, password_hash, is_active) VALUES (?, ?, 1)`,
      [email, passHash]
    );
    const userId = uRes.insertId;

    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [userId, doctorRole[0].id]
    );

    const [mRes] = await db.query(`
      INSERT INTO medicos
      (nombre, apellido, cedula, especialidad, genero, email, rfc,
       telefono_principal, telefono_secundario, direccion, firma_url, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      nombre, apellido, cedula, especialidad, genero, email, rfc,
      telefono_principal, telefono_secundario, direccion, firma_url, userId
    ]);

    await db.query('COMMIT');

    const [rows] = await db.query(`SELECT * FROM medicos WHERE id = ?`, [mRes.insertId]);
    return { medico: rows[0], tempPassword: plainPassword };
  } catch (e) {
    await db.query('ROLLBACK');
    if (String(e.message || '').includes('Duplicate')) {
      throw new Error('Ya existe un doctor/usuario con ese email');
    }
    throw e;
  }
}

async function updateMedico(medicoId, payload) {
  const allowed = [
    'nombre', 'apellido', 'cedula', 'especialidad', 'genero',
    'email',
    'rfc', 'telefono_principal', 'telefono_secundario',
    'direccion', 'firma_url'
  ];

  const sets = [];
  const vals = [];

  for (const f of allowed) {
    if (payload[f] !== undefined) {
      sets.push(`${f} = ?`);
      vals.push(payload[f]);
    }
  }

  if (!sets.length) throw new Error('No hay campos para actualizar');

  await db.query('START TRANSACTION');
  try {
    const [curRows] = await db.query(
      `SELECT id, email, user_id FROM medicos WHERE id = ? LIMIT 1`,
      [medicoId]
    );
    if (!curRows.length) throw new Error('Médico no encontrado');

    const current = curRows[0];
    const newEmail = (payload.email !== undefined) ? String(payload.email).trim() : null;

    if (newEmail && newEmail.toLowerCase() !== String(current.email || '').toLowerCase()) {
      const [mDup] = await db.query(
        `SELECT 1 FROM medicos WHERE LOWER(email)=LOWER(?) AND id <> ? LIMIT 1`,
        [newEmail, medicoId]
      );
      if (mDup.length) throw new Error('Ya existe un médico con ese email');

      const [uDup] = await db.query(
        `SELECT 1 FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`,
        [newEmail]
      );

      if (uDup.length && !current.user_id) throw new Error('Ya existe un usuario con ese email');

      if (uDup.length && current.user_id) {
        const [sameUser] = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email)=LOWER(?) AND id = ? LIMIT 1`,
          [newEmail, current.user_id]
        );
        if (!sameUser.length) throw new Error('Ya existe un usuario con ese email');
      }
    }

    vals.push(medicoId);
    const [res] = await db.query(
      `UPDATE medicos SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );
    if (res.affectedRows === 0) throw new Error('Médico no encontrado');

    if (current.user_id && newEmail) {
      await db.query(`UPDATE users SET email = ? WHERE id = ?`, [newEmail, current.user_id]);
    }

    await db.query('COMMIT');

    const [rows] = await db.query(`SELECT * FROM medicos WHERE id = ?`, [medicoId]);
    return rows[0];
  } catch (e) {
    await db.query('ROLLBACK');
    if (String(e.message || '').includes('Duplicate')) {
      throw new Error('Ya existe un doctor/usuario con ese email');
    }
    throw e;
  }
}

async function getStats() {
  const [[u]] = await db.query(`SELECT COUNT(*) AS usersActive FROM users WHERE is_active = 1`);
  const [[d]] = await db.query(`SELECT COUNT(*) AS doctors FROM medicos`);
  const [[f]] = await db.query(`SELECT COUNT(*) AS formsTotal FROM formulario WHERE eliminado_logico = 0`);

  return {
    usersActive: u.usersActive,
    doctors: d.doctors,
    formsTotal: f.formsTotal
  };
}

async function userEmailExists(email) {
  const [rows] = await db.query(
    'SELECT 1 AS ok FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1',
    [email]
  );
  return rows.length > 0;
}

async function getMedicoById(medicoId) {
  const [rows] = await db.query(`
    SELECT id, nombre, apellido, cedula, especialidad, genero, email,
           rfc, telefono_principal, telefono_secundario, direccion, firma_url,
           creado_en, actualizado_en, user_id
    FROM medicos
    WHERE id = ?
    LIMIT 1
  `, [medicoId]);

  if (!rows.length) throw new Error('Médico no encontrado');
  return rows[0];
}

// =========================
// AUDITORÍA: Logs formularios
// =========================
async function getFormsLog({
  search = '',
  tipo = '',
  eliminado = '', // '', '0', '1'
  limit = 50,
  offset = 0
}) {
  limit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  offset = Math.max(Number(offset) || 0, 0);

  const where = [];
  const params = [];

  if (tipo) {
    where.push(`ft.nombre = ?`);
    params.push(tipo);
  }

  if (eliminado === '0' || eliminado === '1') {
    where.push(`f.eliminado_logico = ?`);
    params.push(Number(eliminado));
  }

  if (search) {
    where.push(`
      (
        CONCAT(IFNULL(p.nombre,''),' ',IFNULL(p.apellido,'')) LIKE ?
        OR p.email LIKE ?
        OR u1.email LIKE ?
        OR u2.email LIKE ?
        OR ft.nombre LIKE ?
        OR CAST(f.id AS CHAR) LIKE ?
      )
    `);
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sql = `
    SELECT
      f.id AS formulario_id,
      f.paciente_id,
      CONCAT(IFNULL(p.nombre,''),' ',IFNULL(p.apellido,'')) AS paciente_nombre,
      p.email AS paciente_email,

      ft.nombre AS tipo_formulario,
      f.estado,
      f.eliminado_logico,

      f.fecha_creacion,
      f.fecha_actualizacion,

      u1.email AS creado_por_email,
      u2.email AS actualizado_por_email,

      CASE WHEN f.eliminado_logico = 1 THEN u2.email ELSE NULL END AS eliminado_por_email,
      CASE WHEN f.eliminado_logico = 1 THEN f.fecha_actualizacion ELSE NULL END AS fecha_eliminacion

    FROM formulario f
    JOIN formulario_tipo ft ON ft.id = f.tipo_id
    JOIN pacientes p ON p.id = f.paciente_id
    LEFT JOIN users u1 ON u1.id = f.creado_por
    LEFT JOIN users u2 ON u2.id = f.actualizado_por
    ${whereSql}
    ORDER BY f.fecha_creacion DESC
    LIMIT ? OFFSET ?;
  `;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM formulario f
    JOIN formulario_tipo ft ON ft.id = f.tipo_id
    JOIN pacientes p ON p.id = f.paciente_id
    LEFT JOIN users u1 ON u1.id = f.creado_por
    LEFT JOIN users u2 ON u2.id = f.actualizado_por
    ${whereSql};
  `;

  const [rows] = await db.query(sql, [...params, limit, offset]);
  const [[countRow]] = await db.query(countSql, params);

  return { rows, total: Number(countRow?.total || 0), limit, offset };
}

async function softDeleteForm(formId, userId) {
  const sql = `
    UPDATE formulario
    SET eliminado_logico = 1,
        actualizado_por = ?,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = ?;
  `;
  const [r] = await db.query(sql, [userId || null, formId]);
  return r.affectedRows;
}

async function restoreForm(formId, userId) {
  const sql = `
    UPDATE formulario
    SET eliminado_logico = 0,
        actualizado_por = ?,
        fecha_actualizacion = CURRENT_TIMESTAMP
    WHERE id = ?;
  `;
  const [r] = await db.query(sql, [userId || null, formId]);
  return r.affectedRows;
}

module.exports = {
  // users
  listUsersWithRoles,
  createUser,
  setUserActive,
  resetUserPassword,
  setUserRolesByName,
  userEmailExists,

  // medicos
  listMedicos,
  createDoctorFull,
  updateMedico,
  getMedicoById,

  // stats
  getStats,

  // auditoría
  getFormsLog,
  softDeleteForm,
  restoreForm
};
