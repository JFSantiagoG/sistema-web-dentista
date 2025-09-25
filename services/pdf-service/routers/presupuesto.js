//PDF PRESUPUESTO
const express     = require('express');
const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const router = express.Router();
router.post('/generate', (req, res) => {
  const { odontogramaVisual, ...datosSinImagen } = req.body;
  console.log('📄 Presupuesto recibido:', datosSinImagen);

  const {
    paciente,
    odontograma = [],
    tratamientosGenerales = [],
    presupuesto
  } = req.body;

  const doc = new PDFDocument({
    size: [612, 776],
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
    'Presupuesto de Tratamiento Odontológico']);

  

  doc
    .fontSize(10)
    .fillColor('gray')
    .text(`PACIENTE: ${paciente.nombre}`, 50, doc.y, { continued: true })
    .text(`N°: ${paciente.numeroPaciente}`, { align: 'center', continued: true })
    .text(`FECHA: ${paciente.fechaRegistro}`, { align: 'right' })
    .moveDown(1.5);

  if (odontogramaVisual) {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#00457C')
      .text('Odontograma Visual', { align: 'center' })
      .moveDown(0.5)
      .image(odontogramaVisual, {
        fit: [580, 380],
        align: 'center'
      })
      .moveDown(1.5);
  }

  doc
  .font('Helvetica-Bold')
  .fontSize(11)
  .fillColor('#00457C')
  .text('Tratamientos por Diente', { align: 'left' })
  .moveDown(0.5);

if (odontograma.length > 40) {
  // Dividir en dos columnas si hay más de 35 tratamientos
  const mitad = 35;
  const izquierda = odontograma.slice(0, mitad);
  const derecha = odontograma.slice(mitad);

  const startY = doc.y;
  izquierda.forEach((item, i) => {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('black')
      .text(`Diente ${item.diente}: ${item.tratamiento}`, 50, startY + i * 12, { continued: true })
      .fillColor('#008000')
      .text(` - $${item.costo.toFixed(2)}`);
  });

  derecha.forEach((item, i) => {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('black')
      .text(`Diente ${item.diente}: ${item.tratamiento}`, 300, startY + i * 12, { continued: true })
      .fillColor('#008000')
      .text(` - $${item.costo.toFixed(2)}`);
  });
  doc.moveDown(1);
} else {
  // Columna única si hay 40 o menos
  odontograma.forEach(item => {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('black')
      .text(`Diente ${item.diente}: ${item.tratamiento}`, { continued: true })
      .fillColor('#008000')
      .text(` - $${item.costo.toFixed(2)}`, { align: 'left' });
  });
  doc.moveDown(1);
}
  if (doc.y > 650) {
    doc.addPage();
    insertarEncabezado(doc);
  }
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#00457C')
    .text('Tratamientos Generales', { align: 'left' })
    .moveDown(0.5);

  tratamientosGenerales.forEach(tx => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('black')
      .text(`${tx.nombre}`, { continued: true })
      .fillColor('#008000')
      .text(`: $${tx.costo.toFixed(2)}`, { align: 'left' })
      .moveDown(0.3);
  });
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#00457C')
    .text('Costo Total', { align: 'left' })
    .moveDown(0.3);
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('black')
    .text(`Total estimado: `, { continued: true })
    .fillColor('#B22222')
    .text(`$${presupuesto.total.toFixed(2)}`, { align: 'left' })
    .fillColor('black')
    .text(`Duración: ${presupuesto.meses} meses`, { align: 'left' })
    .text(`Mensualidad estimada: `, { continued: true })
    .fillColor('#B22222')
    .text(`$${presupuesto.mensualidad.toFixed(2)}`, { align: 'left' })
    .moveDown(2);
  // Firma
  insertarPie(doc, true);
  doc.end();
});//END PDF PRESUPUESTO
module.exports = router;