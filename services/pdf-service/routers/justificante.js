const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma');

const router = express.Router();

router.post('/generate', (req, res) => {
  const { firmaMedico, ...dataSinFirma } = req.body;
  console.log('📄 Justificante recibido (sin firma):', dataSinFirma);
  if (firmaMedico) {
    const bytes = Math.round((firmaMedico.length * 3 / 4) / 1024);
    console.log(`🖊️ Firma recibida (aprox. ${bytes} KB)`);
  }

  const {
    fechaEmision,
    nombrePaciente,
    procedimiento,
    fechaProcedimiento,
    diasReposo
  } = req.body;

  const doc = new PDFDocument({
    size: "A4",
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

  // Cuerpo del justificante
doc
  .font('Helvetica')
  .fontSize(11)
  .fillColor('black')
  .text(`México D.F. a ${fechaEmision}`, { align: 'right' })
  .moveDown(1.5)
  .text('A quien corresponda:')
  .moveDown(1)
  .text(`Por medio de la presente le informo que el paciente ${nombrePaciente} fue sometido a un procedimiento odontológico quirúrgico denominado "${procedimiento}" los días ${fechaProcedimiento} del año en curso.`, { align: 'justify' })
  .moveDown(1)
  .text(`Por lo anterior, requiere guardar reposo por ${diasReposo} día(s), lo cual implicará un mayor número de citas clínicas.`)
  .moveDown(2)
  .text('Se extiende la presente para los fines del interesado. Por su atención, gracias.')
  .moveDown(2)
  .text('Atentamente', { align: 'left' })
  .moveDown(1);

  // Firma
  insertarFirma(doc, firmaMedico, {
    label: 'C.D. Esp. Nancy Alejandra Hernández López'
  });

  // Pie de página
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
