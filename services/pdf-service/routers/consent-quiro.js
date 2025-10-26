const express     = require('express');
const PDFDocument = require('pdfkit');

const router = express.Router();
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');

// 📄 Generar PDF Consentimiento Quirúrgico
router.post('/generate', (req, res) => {
  const {
    paciente,
    historiaClinica,
    anestesia,
    pronostico,
    condiciones,
    pronosticoAceptado,
    recuperacion,
    recuperacionAceptada,
    responsabilidad,
    acuerdo,
    acuerdoAceptado,
    firmaPaciente,   // ✅ Firmas en base64
    firmaMedico
  } = req.body;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks = [];

  doc.on('data', chunk => chunks.push(chunk));
  doc.on('end', () => {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // === Encabezado ===
  insertarEncabezado(doc, 'CONSULTORIO DENTAL NIMAFESI', [
    'CONSENTIMIENTO INFORMADO: PROCEDIMIENTO QUIRÚRGICO'
  ]);

  // === Datos del Paciente ===
  doc.moveDown(1.5)
    .fontSize(10)
    .fillColor('black')
    .text(`Paciente: ${paciente.nombre}`)
    .text(`Fecha: ${paciente.fecha}`)
    .text(`Número de paciente: ${paciente.numeroPaciente}`)
    .moveDown(1);

  // === Historia Clínica ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#FFA500')
    .text('Historia Clínica y Responsabilidad')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text('El paciente declara que no ha omitido ni alterado datos al responder la historia clínica, incluyendo alergias, automedicación, consumo de estimulantes o drogas, embarazo, trastornos previos o reacciones adversas a medicamentos o anestesia.')
    .moveDown(0.5)
    .text(historiaClinica
      ? 'Confirmado: el paciente respondió sinceramente.'
      : 'No confirmado: el paciente no validó la historia clínica.')
    .moveDown(1);

  // === Anestesia ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#17A2B8')
    .text('Consentimiento para Anestesia')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text('El paciente da consentimiento para la administración de anestésicos necesarios. Se le ha explicado que el tipo de anestesia, la técnica empleada y las molestias resultantes son temporales. Comprende que cualquier forma de anestesia entraña riesgos, complicaciones, lesiones y, muy raramente, la muerte.')
    .moveDown(0.5)
    .text(anestesia
      ? 'El paciente acepta los riesgos asociados a la anestesia.'
      : 'El paciente no confirmó consentimiento para anestesia.')
    .moveDown(1);

  // === Pronóstico y Condiciones ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#28A745')
    .text('Pronóstico y Condiciones Posoperatorias')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text(`Pronóstico: ${pronostico}`)
    .text(`Condiciones posoperatorias: ${condiciones}`)
    .moveDown(0.5)
    .text(pronosticoAceptado
      ? 'El paciente acepta y comprende el pronóstico y condiciones posoperatorias.'
      : 'El paciente no confirmó comprensión del pronóstico.')
    .moveDown(1);

  // === Recuperación ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#007BFF')
    .text('Tiempo de Recuperación y Cicatrices')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text(`Tiempo de recuperación aproximado: ${recuperacion} días. En procedimientos quirúrgicos puede existir la presencia de cicatrices posoperatorias.`)
    .moveDown(0.5)
    .text(recuperacionAceptada
      ? 'El paciente acepta los riesgos de recuperación y cicatrices.'
      : 'El paciente no confirmó aceptación de recuperación.')
    .moveDown(1);

  // === Responsabilidad Personal ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#6C757D')
    .text('Responsabilidad Personal del Paciente')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text('El paciente se compromete a cuidar su boca mediante higiene adecuada, control de dieta y seguimiento de las indicaciones del profesional tratante.')
    .moveDown(0.5)
    .text(responsabilidad
      ? 'Confirmado: el paciente acepta la responsabilidad personal.'
      : 'No confirmado: el paciente no confirmó responsabilidad personal.')
    .moveDown(1);

  // === Acuerdo Económico ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#343A40')
    .text('Acuerdo Económico')
    .moveDown(0.5)
    .font('Helvetica').fontSize(10).fillColor('black')
    .text(`Acuerdo económico establecido: ${acuerdo}`)
    .moveDown(0.5)
    .text(acuerdoAceptado
      ? 'El paciente acepta las condiciones económicas.'
      : 'El paciente no confirmó aceptación del acuerdo económico.')
    .moveDown(2);

  // === Firmas ===
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text("Firmas:");
  const startY = doc.y + 15;

  if (firmaPaciente) {
    const pacienteImg = Buffer.from(firmaPaciente.split(",")[1], "base64");
    doc.image(pacienteImg, 80, startY+20, { width: 150 });
    doc.text("_______________________", 80, startY + 60);
    doc.text(`${paciente.nombre}`, 120, startY + 75);
  }

  if (firmaMedico) {
    const medicoImg = Buffer.from(firmaMedico.split(",")[1], "base64");
    doc.image(medicoImg, 350, startY+20, { width: 150 });
    doc.text("_______________________", 350, startY + 60);
    doc.text("Doctor", 400, startY + 75);
  }

  // === Pie institucional ===
  insertarPie(doc, true);

  doc.end();
});

module.exports = router;
