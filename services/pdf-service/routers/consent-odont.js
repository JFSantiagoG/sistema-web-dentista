//PDF CONSENTIMIENTO
const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const router = express.Router();
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');

router.post('/generate', (req, res) => {
  console.log('📋 Consentimiento recibida:', req.body)
  const { paciente, tratamiento, monto, ausencia } = req.body;
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // Encabezado
  insertarEncabezado(doc, 'CONSULTORIO DENTAL NIMAFESI', [
    'CONSENTIMIENTO INFORMADO ODONTOLÓGICO']);

  // Datos del paciente
  doc
    .moveDown(1.5)
    .fontSize(10)
    .fillColor('black')
    .text(`Paciente: ${paciente.nombre}`)
    .text(`Fecha: ${paciente.fecha}`)
    .text(`Número de paciente: ${paciente.numeroPaciente}`)
    .moveDown(1);

  // Tratamiento
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#00457C')
    .text('Tratamiento Autorizado')
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('black')
    .text(tratamiento)
    .moveDown(1);

  // Acuerdo económico
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#00457C')
    .text('Acuerdo Económico')
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('black')
    .text(`Monto acordado: $${monto} MXN`)
    .moveDown(1);

  // Ausencia a citas
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#00457C')
    .text('Ausencia a Citas')
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('black')
    .text(`Se informa que en caso de ausencia por más de ${ausencia} días, el tratamiento será suspendido.`)
    .moveDown(4);

  // Firma
  insertarPie(doc, true);
  doc.end();
});// Endpoint para generar PDF de consentimiento informado
module.exports = router;