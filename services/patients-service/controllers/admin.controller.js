const adminModel = require('../models/admin.model');

// =========================
// USERS
// =========================
async function listUsers(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const users = await adminModel.listUsersWithRoles(search);
    res.json({ users });
  } catch (err) {
    console.error('admin.listUsers:', err);
    res.status(500).json({ msg: 'Error listando usuarios' });
  }
}

async function checkUserEmailExists(req, res) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const exists = await adminModel.userEmailExists(email);
    return res.json({ exists });
  } catch (err) {
    console.error('admin.checkUserEmailExists:', err);
    return res.status(500).json({ error: 'Error verificando email' });
  }
}

async function createUser(req, res) {
  try {
    const payload = req.body || {};
    const result = await adminModel.createUser(payload);

    // result trae tempPassword para que el admin la copie una sola vez
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    console.error('admin.createUser:', err);
    res.status(400).json({ msg: err.message || 'Error creando usuario' });
  }
}

async function setUserActive(req, res) {
  try {
    const userId = Number(req.params.id);
    const is_active = Number(req.body.is_active);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'ID de usuario inválido' });
    }
    if (![0, 1].includes(is_active)) {
      return res.status(400).json({ msg: 'is_active debe ser 0 o 1' });
    }

    await adminModel.setUserActive(userId, is_active);
    res.json({ ok: true });
  } catch (err) {
    console.error('admin.setUserActive:', err);
    res.status(400).json({ msg: err.message || 'Error actualizando usuario' });
  }
}

async function resetUserPassword(req, res) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'ID de usuario inválido' });
    }

    const tempPassword = req.body?.tempPassword; // opcional
    const result = await adminModel.resetUserPassword(userId, tempPassword);

    res.json({ ok: true, tempPassword: result.tempPassword });
  } catch (err) {
    console.error('admin.resetUserPassword:', err);
    res.status(400).json({ msg: err.message || 'Error reseteando contraseña' });
  }
}

async function setUserRolesByName(req, res) {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ msg: 'ID de usuario inválido' });
    }

    const roleNames = req.body?.roleNames;
    await adminModel.setUserRolesByName(userId, roleNames);

    res.json({ ok: true });
  } catch (err) {
    console.error('admin.setUserRolesByName:', err);
    res.status(400).json({ msg: err.message || 'Error asignando roles' });
  }
}

// =========================
// MEDICOS
// =========================
async function listMedicos(req, res) {
  try {
    const search = (req.query.search || '').trim();
    const medicos = await adminModel.listMedicos(search);
    res.json({ medicos });
  } catch (err) {
    console.error('admin.listMedicos:', err);
    res.status(500).json({ msg: 'Error listando médicos' });
  }
}

async function createDoctorFull(req, res) {
  try {
    const payload = req.body || {};
    const result = await adminModel.createDoctorFull(payload);
    // result = { medico, tempPassword }
    res.status(201).json({ ok: true, medico: result.medico, tempPassword: result.tempPassword });
  } catch (err) {
    console.error('admin.createDoctorFull:', err);
    res.status(400).json({ msg: err.message || 'Error creando doctor' });
  }
}


async function updateMedico(req, res) {
  try {
    const medicoId = Number(req.params.id);
    if (!Number.isInteger(medicoId) || medicoId <= 0) {
      return res.status(400).json({ msg: 'ID de médico inválido' });
    }

    const medico = await adminModel.updateMedico(medicoId, req.body || {});
    res.json({ ok: true, medico });
  } catch (err) {
    console.error('admin.updateMedico:', err);
    res.status(400).json({ msg: err.message || 'Error actualizando médico' });
  }
}

// =========================
// STATS
// =========================
async function getStats(req, res) {
  try {
    const stats = await adminModel.getStats();
    res.json(stats);
  } catch (err) {
    console.error('admin.getStats:', err);
    res.status(500).json({ msg: 'Error obteniendo estadísticas' });
  }
}

async function getMedicoById(req, res) {
  try {
    const medicoId = Number(req.params.id);
    if (!Number.isInteger(medicoId) || medicoId <= 0) {
      return res.status(400).json({ msg: 'ID de médico inválido' });
    }

    const medico = await adminModel.getMedicoById(medicoId);
    return res.json({ medico });
  } catch (err) {
    console.error('admin.getMedicoById:', err);
    return res.status(400).json({ msg: err.message || 'Error obteniendo médico' });
  }
}

module.exports = {
  listUsers,
  checkUserEmailExists,
  createUser,
  setUserActive,
  resetUserPassword,
  setUserRolesByName,
  listMedicos,
  createDoctorFull,
  updateMedico,
  getStats,
  getMedicoById,
};
