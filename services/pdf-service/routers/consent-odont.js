// PDF CONSENTIMIENTO
const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const router = express.Router();
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma'); // ✅ usamos tu helper de firma

router.post('/generate', (req, res) => {
  // ✅ No saturamos logs con la firma
  const { firmaPaciente, ...dataSinFirma } = req.body;
  console.log('📋 Consentimiento recibido (sin firma):', dataSinFirma);

  if (firmaPaciente) {
    const bytes = Math.round((firmaPaciente.length * 3 / 4) / 1024);
    console.log(`🖊️ Firma recibida (aprox. ${bytes} KB)`);
  } else {
    console.log('⚠️ No se recibió firma del paciente');
  }

  const { paciente, tratamiento, monto, ausencia } = req.body;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const chunks = [];
  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  insertarEncabezado(doc, 'CONSULTORIO DENTAL NIMAFESI', [
    'CONSENTIMIENTO INFORMADO ODONTOLÓGICO'
  ]);

  doc
    .moveDown(1.5)
    .fontSize(10)
    .fillColor('black')
    .text(`Paciente: ${paciente.nombre}`)
    .text(`Fecha: ${paciente.fecha}`)
    .text(`Número de paciente: ${paciente.numeroPaciente}`)
    .moveDown(1);

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
    .moveDown(3);

  insertarFirma(doc, firmaPaciente, { label: `Firma del Paciente: ${paciente.nombre}` });
  insertarPie(doc, false);

  doc.end();
});
module.exports = router;