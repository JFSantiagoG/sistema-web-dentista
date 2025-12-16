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

  // email duplicado
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

    // ✅ importante: devolver pass una sola vez para copiarlo
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

  // ✅ password opcional -> si no viene, generar
  const plainPassword = (password && String(password).trim()) || genTempPassword(12);

  // obtener role doctor
  const [doctorRole] = await db.query(`SELECT id FROM roles WHERE name = 'doctor' LIMIT 1`);
  if (!doctorRole.length) throw new Error("No existe rol 'doctor' en tabla roles");

  const passHash = await bcrypt.hash(String(plainPassword), 10);

  await db.query('START TRANSACTION');
  try {
    // 1) users
    const [uRes] = await db.query(
      `INSERT INTO users (email, password_hash, is_active) VALUES (?, ?, 1)`,
      [email, passHash]
    );
    const userId = uRes.insertId;

    // 2) user_roles -> doctor
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
      [userId, doctorRole[0].id]
    );

    // 3) medicos
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
    return { medico: rows[0], tempPassword: plainPassword }; // ✅ devolvemos pass
  } catch (e) {
    await db.query('ROLLBACK');
    if (String(e.message || '').includes('Duplicate')) {
      throw new Error('Ya existe un doctor/usuario con ese email');
    }
    throw e;
  }
}


async function updateMedico(medicoId, payload) {
  // ✅ Ahora SÍ permitimos email
  const allowed = [
    'nombre', 'apellido', 'cedula', 'especialidad', 'genero',
    'email', // ✅
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
    // Traer medico actual para saber user_id y email anterior
    const [curRows] = await db.query(
      `SELECT id, email, user_id FROM medicos WHERE id = ? LIMIT 1`,
      [medicoId]
    );
    if (!curRows.length) throw new Error('Médico no encontrado');

    const current = curRows[0];
    const newEmail = (payload.email !== undefined) ? String(payload.email).trim() : null;

    // Si cambió email, validar duplicados en medicos y users
    if (newEmail && newEmail.toLowerCase() !== String(current.email || '').toLowerCase()) {
      // medicos.email es UNIQUE, pero validamos para dar error amigable
      const [mDup] = await db.query(
        `SELECT 1 FROM medicos WHERE LOWER(email)=LOWER(?) AND id <> ? LIMIT 1`,
        [newEmail, medicoId]
      );
      if (mDup.length) throw new Error('Ya existe un médico con ese email');

      const [uDup] = await db.query(
        `SELECT 1 FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1`,
        [newEmail]
      );
      // Si existe en users, podría ser él mismo si tiene user_id,
      // por eso validamos: si tiene user_id, permitimos que sea el mismo user.
      if (uDup.length && !current.user_id) {
        throw new Error('Ya existe un usuario con ese email');
      }
      if (uDup.length && current.user_id) {
        const [sameUser] = await db.query(
          `SELECT 1 FROM users WHERE LOWER(email)=LOWER(?) AND id = ? LIMIT 1`,
          [newEmail, current.user_id]
        );
        if (!sameUser.length) throw new Error('Ya existe un usuario con ese email');
      }
    }

    // Update medicos
    vals.push(medicoId);
    const [res] = await db.query(
      `UPDATE medicos SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );
    if (res.affectedRows === 0) throw new Error('Médico no encontrado');

    // ✅ Si el medico tiene user_id y cambió email -> sincronizar users.email
    if (current.user_id && newEmail) {
      await db.query(
        `UPDATE users SET email = ? WHERE id = ?`,
        [newEmail, current.user_id]
      );
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


module.exports = {
  listUsersWithRoles,
  createUser,
  setUserActive,
  resetUserPassword,
  setUserRolesByName,
  listMedicos,
  createDoctorFull,
  updateMedico,
  getStats,
  userEmailExists,
  getMedicoById,
};
