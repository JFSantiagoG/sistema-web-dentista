const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdfFirma');

const router = express.Router();

router.post('/generate', (req, res) => {
  const data = req.body || {};

  const {
    nombrePaciente = '',
    domicilioPaciente = '',
    telefonoPaciente = '',
    sexoPaciente = '',
    fechaNacimiento = '',
    edadPaciente = '',
    estadoCivil = '',
    ocupacionPaciente = '',
    motivoConsulta = '',
    tratamientoMedico = false,
    tratamientoMedicoCual = '',
    medicamento = false,
    medicamentoCual = '',
    problemaDental = false,
    problemaDentalCual = '',
    antecedentesPatologicos = [],  // [{patologia, si, no, fecha}]
    antecedentesMujeres = [],      // [{condicion, si, no, fecha}]
    antecedentesNoPatologicos = [],// [{habito, si, no, cantidad}]
    antecedentesFamiliares = [],   // [{patologia, miembros:[bool x 8]}]
    interrogatorioSistemas = {},   // {Cardiovascular: '...', ...}
    exploracionClinica = {},       // { 'Cabeza...': '...', ...}
    observacionesGenerales = '',
    hallazgosRadiograficos = '',
    firmaPaciente = null           // dataURL opcional (base64)
  } = data;

  console.log('Datos recibidos para generar PDF de historia:', {
    nombrePaciente, sexoPaciente, fechaNacimiento, edadPaciente,
    tratamientoMedico, medicamento, problemaDental,
    firma: firmaPaciente ? 'sí' : 'no'
  });

  // Crear PDF
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // ---------- Helpers de salto (MISMO PATRÓN) ----------
  const LINE = 14; // altura estimada por línea
  const BOTTOM_SAFE = () => doc.page.height - doc.page.margins.bottom - 2 * LINE; // deja 2 líneas para el pie

  function nuevaPagina() {
    // pie de la página actual
    doc.font('Helvetica').fontSize(8).fillColor('gray').text('', 40, BOTTOM_SAFE());
    insertarPie(doc, false);
    // nueva página + encabezado
    doc.addPage();
    insertarEncabezado(
      doc,
      'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
      ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR']
    );
  }

  function ensureSpace(lines = 3) {
    const need = lines * LINE;
    if (doc.y + need > BOTTOM_SAFE()) {
      nuevaPagina();
    }
  }

  // Igual que en tu ortodoncia:
  const printRows = (titulo, rows = [], cols = []) => {
    ensureSpace(2);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(titulo || '', 50).moveDown(0.3);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(10).fillColor('black').text('- (Sin registros)', 60).moveDown(0.3);
      return;
    }
    rows.forEach(r => {
      ensureSpace(1);
      const line = cols.map(k => (r[k] ?? '-')).join(' | ');
      doc.font('Helvetica').fontSize(10).fillColor('black').text(`- ${line}`, 60).moveDown(0.3);
    });
  };

  // Encabezado de la primera página
  insertarEncabezado(
    doc,
    'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
    ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR']
  );

  // ============ 1) Datos Generales ============
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('1. Datos Generales del Paciente', 50).moveDown(0.3);

  doc.font('Helvetica').fontSize(10).fillColor('black')
    .text(`Nombre: ${nombrePaciente}`, 50).moveDown(0.2)
    .text(`Domicilio: ${domicilioPaciente}`, 50).moveDown(0.2)
    .text(`Teléfono: ${telefonoPaciente}`, 50).moveDown(0.2)
    .text(`Sexo: ${sexoPaciente}`, 50).moveDown(0.2)
    .text(`Fecha de nacimiento: ${fechaNacimiento}`, 50).moveDown(0.2)
    .text(`Edad: ${edadPaciente}`, 50).moveDown(0.2)
    .text(`Estado civil: ${estadoCivil}`, 50).moveDown(0.2)
    .text(`Ocupación: ${ocupacionPaciente}`, 50).moveDown(0.6);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Motivo de la consulta:', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(motivoConsulta || '-', 50, undefined, { width: 500, align: 'justify' }).moveDown(0.6);

  // ============ 2) Antecedentes Personales Patológicos ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('2. Antecedentes Personales Patológicos', 50).moveDown(0.3);

  // Mapeo para usar printRows con el MISMO patrón:
  const patRows = (antecedentesPatologicos || []).map(p => ({
    patologia: p.patologia,
    estado: p.si ? 'Sí' : (p.no ? 'No' : 'Sin respuesta'),
    fecha: p.fecha || '-'
  }));
  printRows('', patRows, ['patologia', 'estado', 'fecha']);

  // ============ 3) Tratamiento médico / Medicación / Problema dental ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('3. Tratamiento Médico y Medicación', 50).moveDown(0.3);

  doc.font('Helvetica').fontSize(10).fillColor('black')
    .text(`¿Bajo tratamiento médico?: ${tratamientoMedico ? 'Sí' : 'No'}`, 50).moveDown(0.2)
    .text(`¿Cuál?: ${tratamientoMedicoCual || 'No especificado'}`, 50).moveDown(0.2)
    .text(`¿Toma medicamentos?: ${medicamento ? 'Sí' : 'No'}`, 50).moveDown(0.2)
    .text(`¿Cuál?: ${medicamentoCual || 'No especificado'}`, 50).moveDown(0.2)
    .text(`¿Problema dental previo?: ${problemaDental ? 'Sí' : 'No'}`, 50).moveDown(0.2)
    .text(`¿Cuál?: ${problemaDentalCual || 'No especificado'}`, 50).moveDown(0.6);

  // ============ 4) Solo Mujeres ============
  if ((sexoPaciente || '').toLowerCase().startsWith('fem')) {
    ensureSpace(6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('4. Condiciones (Solo Mujeres)', 50).moveDown(0.3);

    const mujRows = (antecedentesMujeres || []).map(c => ({
      condicion: c.condicion,
      estado: c.si ? 'Sí' : (c.no ? 'No' : 'Sin respuesta'),
      fecha: c.fecha || '-'
    }));
    printRows('', mujRows, ['condicion', 'estado', 'fecha']);
  }

  // ============ 5) No Patológicos ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('5. Antecedentes Personales No Patológicos', 50).moveDown(0.3);

  const noPatRows = (antecedentesNoPatologicos || []).map(h => ({
    habito: h.habito,
    estado: h.si ? 'Sí' : (h.no ? 'No' : 'Sin respuesta'),
    cantidad: h.cantidad || '-'
  }));
  printRows('', noPatRows, ['habito', 'estado', 'cantidad']);

  // ============ 6) Heredofamiliares ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('6. Antecedentes Heredofamiliares', 50).moveDown(0.3);

  const miembrosEtiquetas = ['Madre','Abuela Materna','Abuelo Materno','Padre','Abuela Paterna','Abuelo Paterna','Hermano','Otros'];
  const famRows = (antecedentesFamiliares || []).map(f => ({
    patologia: f.patologia,
    presentes: (f.miembros || []).map((v, i) => (v ? miembrosEtiquetas[i] : null)).filter(Boolean).join(', ') || 'Sin antecedentes'
  }));
  printRows('', famRows, ['patologia', 'presentes']);

  // ============ 7) Interrogatorio por Aparatos y Sistemas ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('7. Interrogatorio por Aparatos y Sistemas', 50).moveDown(0.3);

  const interRows = Object.entries(interrogatorioSistemas || {}).map(([sistema, respuesta]) => ({
    sistema, respuesta: respuesta || 'Sin observaciones'
  }));
  printRows('', interRows, ['sistema', 'respuesta']);

  // ============ 8) Exploración (Patologías) ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('8. Exploración Clínica (Patologías observadas)', 50).moveDown(0.3);

  const explRows = Object.entries(exploracionClinica || {}).map(([zona, observacion]) => ({
    zona, observacion: observacion || 'Sin hallazgos'
  }));
  printRows('', explRows, ['zona', 'observacion']);

  // ============ 9) Observaciones Generales ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('9. Observaciones Generales', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(observacionesGenerales || 'Sin observaciones registradas.', 50, undefined, { width: 500, align: 'justify' }).moveDown(0.6);

  // ============ 10) Hallazgos Radiográficos ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('10. Hallazgos Radiográficos y de Laboratorio', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(hallazgosRadiograficos || 'Sin hallazgos registrados.', 50, undefined, { width: 500, align: 'justify' }).moveDown(0.6);

// ============ 11) Firma del Paciente ============
  ensureSpace(12);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black')
    .text('11. Firma del Paciente', 50).moveDown(1.5);

  // 🖊️ Inserta la firma centrada usando tu helper SIN modificarlo
  try {
    insertarFirma(doc, firmaPaciente, {
      label: `${nombrePaciente || 'Paciente'}`,
      width: 140,
      height: 70
    });
  } catch (err) {
    console.error('❌ Error al insertar firma:', err);
    doc.font('Helvetica').fontSize(10).fillColor('black')
      .text('(No se pudo renderizar la firma)', 50, undefined, { align: 'center' })
      .moveDown(2);
  }

  // Pie de la última página
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
