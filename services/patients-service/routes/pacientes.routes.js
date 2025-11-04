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

//Para obtener información de formularios específicos
const { getRecetaByFormularioId } = require('../controllers/pacientes.controller');
const { obtenerJustificante } = require('../controllers/pacientes.controller');
const { obtenerConsentOdont } = require('../controllers/pacientes.controller');
const { obtenerConsentQuiro } = require('../controllers/pacientes.controller');
const { obtenerOrtodonciaDetalle } = require('../controllers/pacientes.controller');
const { obtenerHistoriaDetalle } = require('../controllers/pacientes.controller');
const { obtenerOdontogramaFinal } = require('../controllers/pacientes.controller');
const { getPresupuestoByFormId } = require('../controllers/pacientes.controller');
const { getDiagInfantilByFormId } = require('../controllers/pacientes.controller');
const { getEvolucionByFormId } = require('../controllers/pacientes.controller');

//Para actualizar evoluciones
const { appendEvoluciones } = require('../controllers/pacientes.controller');

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

//Rutas para realizar el visualizador de los formularios
router.get('/forms/receta/:formularioId', verificarToken, getRecetaByFormularioId);
router.get('/forms/justificante/:formularioId', verificarToken, obtenerJustificante);
router.get('/forms/consent-odont/:formId', verificarToken, obtenerConsentOdont);
router.get('/forms/consent-quiro/:formId', verificarToken, obtenerConsentQuiro);
router.get('/forms/ortodoncia/:formularioId', verificarToken, obtenerOrtodonciaDetalle);
router.get('/forms/historia/:formularioId', verificarToken, obtenerHistoriaDetalle);
router.get('/forms/odontograma/:formularioId', verificarToken, obtenerOdontogramaFinal);
router.get('/forms/presupuesto/:formularioId', verificarToken, getPresupuestoByFormId);
router.get('/forms/diag-infantil/:formularioId', verificarToken, getDiagInfantilByFormId);
router.get('/forms/evolucion/:formularioId', verificarToken, getEvolucionByFormId);

//Rutas para realizar una actualizacion
router.put('/evoluciones/:formularioId', verificarToken, appendEvoluciones);


module.exports = router;