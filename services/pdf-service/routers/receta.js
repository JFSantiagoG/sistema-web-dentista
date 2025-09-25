const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');// Importar funciones de encabezado y pie de página
const router = express.Router();

router.post('/generate', (req, res) => {
  console.log('📄 Receta recibida:', req.body);
  const {
    nombrePaciente, fecha, edad,
    nombreMedico, cedula,
    medicamentos = []
  } = req.body;

  const baseHeight   = 420;
  const rowHeight    = 22;
  const extraSpace   = 120;
  const totalHeight  = baseHeight + (medicamentos.length * rowHeight) + extraSpace;

  const doc = new PDFDocument({
    size: [595.28, 420],
    margin: 40
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',[
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('gray')
    .text(`FECHA: ${fecha}`, 50)
    .moveDown(0.3)
    .text(`NOMBRE DEL PACIENTE: ${nombrePaciente}`, 50, doc.y, { continued: true })
    .text(`EDAD: ${edad}`, { align: 'right' })
    .moveDown(1);

  const headers = ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Indicaciones'];
  const widths  = [110, 80, 80, 80, 150];
  const startX  = 50;
  const headerY = doc.y;

  headers.forEach((h, i) => {
    const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0);
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('black')
      .text(h, x, headerY, { width: widths[i], align: 'center' });
  });
  doc.moveDown(0.5);

  medicamentos.forEach(m => {
    const valores = [m.nombre, m.dosis, m.frecuencia, m.duracion, m.indicaciones];
    const rowY = doc.y;

    valores.forEach((v, i) => {
      const x = startX + widths.slice(0, i).reduce((a, b) => a + b, 0);
      doc
        .font('Helvetica')
        .fontSize(11)
        .text(v || '-', x, rowY, { width: widths[i], align: 'center' });
    });

    doc.moveDown(0.5);
  });

  doc.moveDown(1.5);

  const centerX = (doc.page.width / 4) - 100;

  doc
    .moveDown(1)
    .font('Helvetica')
    .fontSize(10)
    .fillColor('black')
    .text(`Médico/Dentista: ${nombreMedico}`, centerX, doc.y, { align: 'center' })
    .text(`Cédula Profesional: ${cedula}`, centerX, doc.y, { align: 'center' })
    .moveDown(1)
    .text('____________________________', centerX, doc.y, { align: 'center' })
    .text('Firma del Médico', centerX, doc.y, { align: 'center' })
    .moveDown(1);

  doc.moveDown(1.5);
  insertarPie(doc, false);
  doc.end();
});

module.exports = router;
