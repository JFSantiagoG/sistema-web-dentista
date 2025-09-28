// PDF EVOLUCION
const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const router = express.Router();
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma'); // 👈 importamos helper de firma

router.post('/generate', (req, res) => {
  console.log('📋 Evolución recibida (sin firma):', {
    nombrePaciente: req.body.nombrePaciente,
    numeroPaciente: req.body.numeroPaciente,
    fechaRegistro: req.body.fechaRegistro,
    evoluciones: req.body.evoluciones?.length || 0
  });

  const {
    nombrePaciente,
    numeroPaciente,
    fechaRegistro,
    evoluciones = [],
    firmaPaciente // 👈 ahora recibimos la firma
  } = req.body;

  const doc = new PDFDocument({
    size: [612, 776], // formato vertical carta
    margin: 40
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // Encabezado
  insertarEncabezado(doc, 'CONSULTORIO DENTAL NIMAFESI', [
    'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR',
    'CED. 4808022 | CED. ESP. 7873133'
  ]);

  // Datos del paciente
  doc
    .fontSize(12)
    .fillColor('gray')
    .text(`PACIENTE: ${nombrePaciente}`, 50, doc.y, { continued: true })
    .text(`N°: ${numeroPaciente}`, { align: 'center', continued: true })
    .text(`FECHA: ${fechaRegistro}`, { align: 'right' })
    .moveDown(1);

  // Tabla de evolución
  const headers = ['Fecha', 'Tratamiento', 'Costo ($)', 'A/C', 'Próxima cita y TX'];
  const widths  = [80, 100, 70, 80, 140];
  const startX  = 40;
  const headerY = doc.y;

  headers.forEach((h, i) => {
    const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor('black')
      .text(h, x, headerY, { width: widths[i], align: 'center' });
  });
  doc.moveDown(1);

  evoluciones.forEach(evo => {
    const valores = [evo.fecha, evo.tratamiento, evo.costo, evo.ac, evo.proxima];
    const rowY = doc.y;

    valores.forEach((v, i) => {
      const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(v || '-', x, rowY, { width: widths[i], align: 'center' });
    });

    doc.moveDown(0.5);
  });

  doc.moveDown(2);

  // 👇 Firma del paciente centrada
  insertarFirma(doc, firmaPaciente, { label: `${nombrePaciente}` });

  // Pie de página
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
