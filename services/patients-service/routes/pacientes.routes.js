const express = require('express');
const router = express.Router();
const { crearPaciente } = require('../controllers/pacientes.controller');
const { buscar } = require('../controllers/pacientes.controller');
const { obtenerPorId } = require('../controllers/pacientes.controller');
const { obtenerFormsSummary } = require('../controllers/pacientes.controller');
const { obtenerStudies } = require('../controllers/pacientes.controller');
const { crearReceta } = require('../controllers/pacientes.controller');
const { crearJustificante } = require('../controllers/pacientes.controller');
const { crearConsentOdont } = require('../controllers/pacientes.controller');
const { crearConsentQuirurgico } = require('../controllers/pacientes.controller');
const { crearEvolucion } = require('../controllers/pacientes.controller');
const { crearOrtodoncia } = require('../controllers/pacientes.controller');
const { crearHistoriaClinica } = require('../controllers/pacientes.controller');
const { crearOdontogramaFinal } = require('../controllers/pacientes.controller');
const { crearPresupuestoDental } = require('../controllers/pacientes.controller');
const { crearDiagInfantil } = require('../controllers/pacientes.controller');
const { uploadStudy } = require('../controllers/pacientes.controller');
const { verificarToken } = require('../middlewares/auth');

router.post('/', crearPaciente);
router.get('/search', verificarToken, buscar);
router.get('/:id', verificarToken, obtenerPorId);
router.get('/:id/forms', verificarToken, obtenerFormsSummary);
router.get('/:id/studies', verificarToken, obtenerStudies);
router.post('/:id/recetas', verificarToken, crearReceta);
router.post('/:id/justificantes', verificarToken, crearJustificante);
router.post('/:id/consent-odont', verificarToken, crearConsentOdont);
router.post('/:id/consent-quiro', verificarToken, crearConsentQuirurgico);
router.post('/:id/evoluciones', verificarToken, crearEvolucion);
router.post('/:id/ortodoncia', verificarToken, crearOrtodoncia);
router.post('/:id/historia', verificarToken, crearHistoriaClinica);
router.post('/:id/odontograma', verificarToken, crearOdontogramaFinal);
router.post('/:id/diag-infantil', verificarToken, crearDiagInfantil);
router.post('/:id/presupuesto', verificarToken, crearPresupuestoDental);

router.post('/:id/studies/upload', verificarToken, uploadStudy);


module.exports = router;
