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

// =========================
// AUDITORÍA (formularios)
// =========================
async function formsLog(req, res) {
  try {
    const {
      search = '',
      tipo = '',
      eliminado = '',
      limit = 50,
      offset = 0
    } = req.query;

    const data = await adminModel.getFormsLog({ search, tipo, eliminado, limit, offset });
    res.json(data);
  } catch (err) {
    console.error('admin.formsLog:', err);
    res.status(500).json({ message: 'Error obteniendo logs de formularios' });
  }
}

async function deleteFormSoft(req, res) {
  try {
    const formId = Number(req.params.id);
    if (!formId) return res.status(400).json({ message: 'ID inválido' });

    const userId = req.user?.id || null; // viene del verificarToken
    const affected = await adminModel.softDeleteForm(formId, userId);

    if (!affected) return res.status(404).json({ message: 'Formulario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin.deleteFormSoft:', err);
    res.status(500).json({ message: 'Error eliminando formulario' });
  }
}

async function restoreForm(req, res) {
  try {
    const formId = Number(req.params.id);
    if (!formId) return res.status(400).json({ message: 'ID inválido' });

    const userId = req.user?.id || null;
    const affected = await adminModel.restoreForm(formId, userId);

    if (!affected) return res.status(404).json({ message: 'Formulario no encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin.restoreForm:', err);
    res.status(500).json({ message: 'Error recuperando formulario' });
  }
}

module.exports = {
  // users
  listUsers,
  checkUserEmailExists,
  createUser,
  setUserActive,
  resetUserPassword,
  setUserRolesByName,

  // medicos
  listMedicos,
  getMedicoById,
  createDoctorFull,
  updateMedico,

  // stats
  getStats,

  // auditoría
  formsLog,
  deleteFormSoft,
  restoreForm,
};
