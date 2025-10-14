const express = require('express');
const router = express.Router();
const { buscar } = require('../controllers/pacientes.controller');
const { obtenerPorId } = require('../controllers/pacientes.controller');
const { verificarToken } = require('../middlewares/auth');

router.get('/search', verificarToken, buscar);
router.get('/:id', verificarToken, obtenerPorId);


module.exports = router;
