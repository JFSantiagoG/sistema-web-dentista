const express = require('express');
const router = express.Router();
const controller = require('../controllers/whatsapp.controller');

router.post('/test', controller.sendTest);

module.exports = router;
