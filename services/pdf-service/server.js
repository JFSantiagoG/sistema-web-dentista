//Servidor PDF Service con todas las rutas de PDF
const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const app = express();
app.use(express.json());
// Rutas para los diferentes tipos de PDF
app.use('/receta', require('./routers/receta'));
app.use('/quirurgico', require('./routers/consent-quiro'));
app.use('/consentimiento', require('./routers/consent-odont'));
app.use('/presupuesto', require('./routers/presupuesto'));
app.use('/evolucion', require('./routers/evolucion'));
app.listen(3006, () =>// Puerto 3006 para evitar conflicto con otros servicios
  console.log('📄 PDF Evolución corriendo en puerto 3006')
);