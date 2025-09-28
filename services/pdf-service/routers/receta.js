const express     = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma');

const router = express.Router();

router.post('/generate', (req, res) => {
  // ✅ Log sin saturar con la firma
  const { firmaMedico, ...dataSinFirma } = req.body;
  console.log('📄 Receta recibida (sin firma):', dataSinFirma);
  if (firmaMedico) {
    const bytes = Math.round((firmaMedico.length * 3 / 4) / 1024);
    console.log(`🖊️ Firma recibida (aprox. ${bytes} KB)`);
  }

  const {
    nombrePaciente, fecha, edad,
    nombreMedico, cedula,
    medicamentos = []
  } = req.body;

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

  // Encabezado
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ', [
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);

  // Datos paciente
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('gray')
    .text(`FECHA: ${fecha}`, 50)
    .moveDown(0.3)
    .text(`NOMBRE DEL PACIENTE: ${nombrePaciente}`, 50, doc.y, { continued: true })
    .text(`EDAD: ${edad}`, { align: 'right' })
    .moveDown(1);

  // Tabla medicamentos
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

  doc.moveDown(2);

  // 👇 Insertar firma del médico
  insertarFirma(doc, firmaMedico, { label: `${nombreMedico} · Cédula: ${cedula}` });

  // Pie de página
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
