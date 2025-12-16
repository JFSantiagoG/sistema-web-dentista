const express = require('express');
const router = express.Router();

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

module.exports = router;
