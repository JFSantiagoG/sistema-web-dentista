const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/appointments.controller');
const verificarToken = require('../middleware/auth');

router.use(verificarToken); // ← protege todas las rutas

router.get('/today', ctrl.getToday);
router.get('/by-date/:fecha', ctrl.getByDate);
router.delete('/:id', ctrl.cancel);
router.put('/:id/postpone', ctrl.postpone);
router.post('/:id/resend', ctrl.resend);
router.get('/available-dates', ctrl.getAvailableDates);
router.get('/available-hours/:fecha', ctrl.getAvailableHours);

module.exports = router;
