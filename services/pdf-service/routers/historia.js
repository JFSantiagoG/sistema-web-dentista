const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie, verificarEspacioYAgregarPagina } = require('../utils/pdfHelpers');
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

  // 🔒 Log limpio (sin base64 de la firma)
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

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // ========= Encabezado / Pie en página 1 =========
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ', [
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);
  insertarPie(doc, false);

  // ========= Reserva contra el pie y estilos consistentes =========
  const FOOTER_RESERVE = 80; // ajusta si tu pie mide distinto
  const HEADER_TITLE = 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ';
  const HEADER_SUBS = ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'];

  const setTitleStyle = () => {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111'); // siempre el mismo color
  };
  const setBodyStyle = () => {
    doc.font('Helvetica').fontSize(10).fillColor('#111'); // siempre el mismo color
  };

  // wrapper de tu helper que considera el pie
  const vspace = (needed) => {
    // suma reserva para no bajar hasta el pie
    verificarEspacioYAgregarPagina(doc, needed + FOOTER_RESERVE, HEADER_TITLE, HEADER_SUBS);
  };

  // ========= Sección 1 =========
  setTitleStyle();
  doc.text('1. Datos Generales del Paciente', { underline: true }).moveDown(0.5);

  setBodyStyle();
  doc
    .text(`Nombre: ${nombrePaciente || '-'}`)
    .text(`Domicilio: ${domicilioPaciente || '-'}`)
    .text(`Teléfono: ${telefonoPaciente || '-'}`)
    .text(`Sexo: ${sexoPaciente || '-'}`)
    .text(`Fecha de nacimiento: ${fechaNacimiento || '-'}`)
    .text(`Edad: ${edadPaciente || '-'}`)
    .text(`Estado civil: ${estadoCivil || '-'}`)
    .text(`Ocupación: ${ocupacionPaciente || '-'}`)
    .moveDown(0.5);

  setTitleStyle();
  doc.text('Motivo de la consulta:', { underline: true });
  setBodyStyle();
  doc.text(motivoConsulta || '-', { align: 'justify' });

  // ========= Sección 2 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('2. Antecedentes Personales Patológicos', { underline: true });

  antecedentesPatologicos.forEach(p => {
    vspace(20);
    setBodyStyle();
    doc.text(`• ${p.patologia}: ${p.si ? 'Sí' : p.no ? 'No' : 'Sin respuesta'}${p.fecha ? ` (Fecha: ${p.fecha})` : ''}`);
  });

  // ========= Sección 3 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('3. Tratamiento Médico', { underline: true }).moveDown(0.5);

  setBodyStyle();
  doc
    .text(`¿Está bajo tratamiento médico?: ${tratamientoMedico ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${tratamientoMedicoCual || 'No especificado'}`)
    .text(`¿Toma medicamentos?: ${medicamento ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${medicamentoCual || 'No especificado'}`)
    .text(`¿Problema dental previo?: ${problemaDental ? 'Sí' : 'No'}`)
    .text(`¿Cuál?: ${problemaDentalCual || 'No especificado'}`);

  // ========= Sección 4 (Solo Mujeres) =========
  if (sexoPaciente === 'Femenino') {
    vspace(100);
    setTitleStyle();
    doc.moveDown(1).text('4. Condiciones (Solo Mujeres)', { underline: true });
    antecedentesMujeres.forEach(c => {
      vspace(20);
      setBodyStyle();
      doc.text(`• ${c.condicion}: ${c.si ? 'Sí' : c.no ? 'No' : 'Sin respuesta'}${c.fecha ? ` (Fecha: ${c.fecha})` : ''}`);
    });
  }

  // ========= Sección 5 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('5. Antecedentes Personales No Patológicos', { underline: true });

  antecedentesNoPatologicos.forEach(h => {
    vspace(20);
    setBodyStyle();
    doc.text(`• ${h.habito}: ${h.si ? 'Sí' : h.no ? 'No' : 'Sin respuesta'}${h.cantidad ? ` (Cantidad: ${h.cantidad})` : ''}`);
  });

  // ========= Sección 6 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('6. Antecedentes Heredofamiliares', { underline: true });

  const miembros = ['Madre', 'Abuela Materna', 'Abuelo Materno', 'Padre', 'Abuela Paterna', 'Abuelo Paterna', 'Hermano', 'Otros'];
  antecedentesFamiliares.forEach(f => {
    vspace(20);
    const presentes = (f.miembros || []).map((v, idx) => v ? miembros[idx] : null).filter(Boolean).join(', ');
    setBodyStyle();
    doc.text(`• ${f.patologia}: ${presentes || 'Sin antecedentes reportados'}`);
  });

  // ========= Sección 7 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('7. Interrogatorio por Aparatos y Sistemas', { underline: true });

  Object.entries(interrogatorioSistemas).forEach(([sistema, respuesta]) => {
    vspace(20);
    setBodyStyle();
    doc.text(`• ${sistema}: ${respuesta || 'Sin observaciones'}`);
  });

  // ========= Sección 8 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('8. Exploración Clínica (Patologías observadas)', { underline: true });

  Object.entries(exploracionClinica).forEach(([zona, observacion]) => {
    vspace(20);
    setBodyStyle();
    doc.text(`• ${zona}: ${observacion || 'Sin hallazgos'}`);
  });

  // ========= Sección 9 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('9. Observaciones Generales', { underline: true }).moveDown(0.5);
  setBodyStyle();
  doc.text(observacionesGenerales || 'Sin observaciones registradas.', { align: 'justify' });

  // ========= Sección 10 =========
  vspace(100);
  setTitleStyle();
  doc.moveDown(1).text('10. Hallazgos Radiográficos y de Laboratorio', { underline: true }).moveDown(0.5);
  setBodyStyle();
  doc.text(hallazgosRadiograficos || 'Sin hallazgos registrados.', { align: 'justify' });

  // ========= Sección 11: Firma =========
  vspace(120);
  insertarFirma(doc, firmaPaciente, {
    label: `${nombrePaciente || ''}`
  });

  // ⚠️ No dibujar pie aquí: ya se dibuja al crear/avanzar de página mediante insertarPie(...)
  doc.end();
});

module.exports = router;
