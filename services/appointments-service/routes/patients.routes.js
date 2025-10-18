const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/patients.controller');
const verificarToken = require('../middleware/auth');

router.use(verificarToken);
router.get('/search', ctrl.search);




module.exports = router;
