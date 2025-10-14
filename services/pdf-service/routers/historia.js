const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma');

const router = express.Router();

router.post('/generate', (req, res) => {
  const {
    nombrePaciente,
    domicilioPaciente,
    telefonoPaciente,
    sexoPaciente,
    fechaNacimiento,
    edadPaciente,
    estadoCivil,
    ocupacionPaciente,
    motivoConsulta,
    tratamientoMedico,
    tratamientoMedicoCual,
    medicamento,
    medicamentoCual,
    problemaDental,
    problemaDentalCual,
    antecedentesPatologicos = [],
    antecedentesMujeres = [],
    antecedentesNoPatologicos = [],
    antecedentesFamiliares = [],
    interrogatorioSistemas = {},
    exploracionClinica = {},
    observacionesGenerales,
    hallazgosRadiograficos,
    firmaPaciente
  } = req.body;

  console.log('📋 Historia clínica recibida:');
console.log({
  nombrePaciente,
  domicilioPaciente,
  telefonoPaciente,
  sexoPaciente,
  fechaNacimiento,
  edadPaciente,
  estadoCivil,
  ocupacionPaciente,
  motivoConsulta,
  tratamientoMedico,
  tratamientoMedicoCual,
  medicamento,
  medicamentoCual,
  problemaDental,
  problemaDentalCual,
  antecedentesPatologicos,
  antecedentesMujeres,
  antecedentesNoPatologicos,
  antecedentesFamiliares,
  interrogatorioSistemas,
  exploracionClinica,
  observacionesGenerales,
  hallazgosRadiograficos,
  firmaPaciente: firmaPaciente ? `🖊️ Firma recibida (${Math.round(firmaPaciente.length * 3 / 4 / 1024)} KB)` : '❌ Sin firma'
});

  const doc = new PDFDocument({
    size: 'A4',
    margin: 40
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // Página 1
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ', [
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);



  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('1. Datos Generales del Paciente', { underline: true })
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .text(`Nombre: ${nombrePaciente}`)
    .text(`Domicilio: ${domicilioPaciente}`)
    .text(`Teléfono: ${telefonoPaciente}`)
    .text(`Sexo: ${sexoPaciente}`)
    .text(`Fecha de nacimiento: ${fechaNacimiento}`)
    .text(`Edad: ${edadPaciente}`)
    .text(`Estado civil: ${estadoCivil}`)
    .text(`Ocupación: ${ocupacionPaciente}`)
    .moveDown(0.5)
    .text(`Motivo de la consulta:`, { underline: true })
    .text(motivoConsulta, { align: 'justify' })
    .moveDown(1);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('2. Antecedentes Personales Patológicos', { underline: true })
    .moveDown(0.5);

  antecedentesPatologicos.forEach(p => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`• ${p.patologia}: ${p.si ? 'Sí' : p.no ? 'No' : 'Sin respuesta'}${p.fecha ? ` (Fecha: ${p.fecha})` : ''}`);
  });

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('3. Tratamiento Médico', { underline: true })
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .text(`¿Está bajo tratamiento médico?: ${tratamientoMedico ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${tratamientoMedicoCual || 'No especificado'}`)
    .text(`¿Toma medicamentos?: ${medicamento ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${medicamentoCual || 'No especificado'}`)
    .text(`¿Problema dental previo?: ${problemaDental ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${problemaDentalCual || 'No especificado'}`);

  if (sexoPaciente === 'Femenino') {
    doc
      .moveDown(1)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('4. Condiciones (Solo Mujeres)', { underline: true })
      .moveDown(0.5);

    antecedentesMujeres.forEach(c => {
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`• ${c.condicion}: ${c.si ? 'Sí' : c.no ? 'No' : 'Sin respuesta'}${c.fecha ? ` (Fecha: ${c.fecha})` : ''}`);
    });
  }

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('5. Antecedentes Personales No Patológicos', { underline: true })
    .moveDown(0.5);

  antecedentesNoPatologicos.forEach(h => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`• ${h.habito}: ${h.si ? 'Sí' : h.no ? 'No' : 'Sin respuesta'}${h.cantidad ? ` (Cantidad: ${h.cantidad})` : ''}`);
  });
  insertarPie(doc, false);
  // Página 2
  doc.addPage();
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ', [
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('6. Antecedentes Heredofamiliares', { underline: true })
    .moveDown(0.5);

  const miembros = ['Madre', 'Abuela Materna', 'Abuelo Materno', 'Padre', 'Abuela Paterna', 'Abuelo Paterna', 'Hermano', 'Otros'];

  antecedentesFamiliares.forEach(f => {
    const presentes = f.miembros
      .map((v, idx) => v ? miembros[idx] : null)
      .filter(Boolean)
      .join(', ');
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`• ${f.patologia}: ${presentes || 'Sin antecedentes reportados'}`);
  });

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('7. Interrogatorio por Aparatos y Sistemas', { underline: true })
    .moveDown(0.5);

  Object.entries(interrogatorioSistemas).forEach(([sistema, respuesta]) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`• ${sistema}: ${respuesta || 'Sin observaciones'}`);
  });

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('8. Exploración Clínica (Patologías observadas)', { underline: true })
    .moveDown(0.5);

  Object.entries(exploracionClinica).forEach(([zona, observacion]) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .text(`• ${zona}: ${observacion || 'Sin hallazgos'}`);
  });

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('9. Observaciones Generales', { underline: true })
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .text(observacionesGenerales || 'Sin observaciones registradas.', { align: 'justify' });

  doc
    .moveDown(1)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('10. Hallazgos Radiográficos y de Laboratorio', { underline: true })
    .moveDown(0.5)
    .font('Helvetica')
    .fontSize(10)
    .text(hallazgosRadiograficos || 'Sin hallazgos registrados.', { align: 'justify' });

  doc.moveDown(2);
  insertarFirma(doc, firmaPaciente, {
    label: 'Firma del Paciente'
  });

  insertarPie(doc, false);
  doc.end();
});

module.exports = router;
