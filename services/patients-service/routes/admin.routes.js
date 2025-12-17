const express = require('express');
const router = express.Router();

const { verificarToken } = require('../middlewares/auth');
const requireAdmin  = require('../middlewares/requireAdmin');   // tu requireAdmin.js

const {
  listUsers,
  createUser,
  checkUserEmailExists,
  setUserActive,
  resetUserPassword,
  setUserRolesByName,

  listMedicos,
  getMedicoById,
  createDoctorFull,
  updateMedico,
  getStats,

  // ✅ IMPORTA ESTAS (ya existen en tu controller)
  formsLog,
  deleteFormSoft,
  restoreForm,
} = require('../controllers/admin.controller');

// ===== USERS =====
router.get('/users', listUsers);
router.get('/users/exists', checkUserEmailExists);
router.post('/users', createUser);
router.put('/users/:id/active', setUserActive);
router.post('/users/:id/reset-password', resetUserPassword);
router.put('/users/:id/roles', setUserRolesByName);

// ===== MEDICOS =====
router.get('/medicos', listMedicos);
router.get('/medicos/:id', getMedicoById);
router.post('/medicos', createDoctorFull);
router.put('/medicos/:id', updateMedico);

// ===== STATS =====
router.get('/stats', getStats);

// ✅ Auditoría / Logs de formularios (SIN duplicar /admin)
router.get('/forms/logs', verificarToken, requireAdmin, formsLog);

// ✅ Eliminar lógico / recuperar
router.put('/forms/:id/delete', verificarToken, requireAdmin, deleteFormSoft);
router.put('/forms/:id/restore', verificarToken, requireAdmin, restoreForm);

module.exports = router;
