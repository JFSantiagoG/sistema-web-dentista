const express = require('express');
const router = express.Router();
const { buscar } = require('../controllers/pacientes.controller');
const { obtenerPorId } = require('../controllers/pacientes.controller');
const { obtenerFormsSummary } = require('../controllers/pacientes.controller');
const { obtenerStudies } = require('../controllers/pacientes.controller');
const { crearReceta } = require('../controllers/pacientes.controller');
const { verificarToken } = require('../middlewares/auth');

router.get('/search', verificarToken, buscar);
router.get('/:id', verificarToken, obtenerPorId);
router.get('/:id/forms', verificarToken, obtenerFormsSummary);
router.get('/:id/studies', verificarToken, obtenerStudies);
router.post('/:id/recetas', verificarToken, crearReceta);


module.exports = router;
