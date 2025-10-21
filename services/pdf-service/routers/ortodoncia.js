const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie } = require('../utils/pdfHelpers');

const router = express.Router();

router.post('/generate', (req, res) => {
  const data = req.body || {};

  const {
    nombrePaciente = '',
    fechaIngreso   = '',
    fechaAlta      = '',
    examenClinico = {},
    analisisFuncional = {},
    analisisModelos = {},
    indicesValorativos = {},
    planTratamiento = {},
    analisisCefalometrico = {},
    factoresComplementarios = {},
    analisisJaraback = [],
    medidasLineales = [],
    analisisMcNamara = []
  } = data;
  console.log("Datos recibidos para generar PDF de ortodoncia:", data);

  // Crear PDF
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // ---------- Helpers de salto ----------
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

  // Encabezado de la primera página
  insertarEncabezado(
    doc,
    'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
    ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR']
  );

  // ============ 1) Identificación ============
  ensureSpace(5);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('1. Identificación del Paciente', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Nombre: ${nombrePaciente}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Fecha de Ingreso: ${fechaIngreso}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Fecha de Alta: ${fechaAlta}`, 50).moveDown(0.6);

  // ============ 2) Examen Clínico ============
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('2. Examen Clínico', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Tipo de cuerpo: ${examenClinico.tipoCuerpo || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Tipo de cara: ${examenClinico.tipoCara || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Tipo de cráneo: ${examenClinico.tipoCraneo || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Otros: ${examenClinico.otros || ''}`, 50).moveDown(0.6);

  // ============ 3) Análisis Funcional ============
  ensureSpace(12);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('3. Análisis Funcional', 50).moveDown(0.3);

  // 3a) Funciones básicas
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('a) Funciones Básicas', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Respiración: ${analisisFuncional.respiracion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Deglución: ${analisisFuncional.deglucion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Masticación: ${analisisFuncional.masticacion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Fonación: ${analisisFuncional.fonacion || ''}`, 50).moveDown(0.6);

  // 3b) ATM
  ensureSpace(10);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('b) Salud Articular (ATM)', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Problemas actuales: ${analisisFuncional.problemasATM || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dolor: ${analisisFuncional.dolorATM || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Ruidos: ${analisisFuncional.ruidosATM || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dolor a la palpación: ${analisisFuncional.dolorPalpacion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Máxima Apertura (mm): ${analisisFuncional.aperturaMax || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Lateralidad Izq. (mm): ${analisisFuncional.latIzq || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Protrusión (mm): ${analisisFuncional.protrusion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Lateralidad Der. (mm): ${analisisFuncional.latDer || ''}`, 50).moveDown(0.6);

  // 3c) Discrepancia OC-RC
  ensureSpace(6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('c) Discrepancia Oclusión Céntrica – Relación Céntrica (OC–RC)', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Vertical (mm): ${analisisFuncional.verticalOCRC || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Horizontal (mm): ${analisisFuncional.horizontalOCRC || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Otros: ${analisisFuncional.otrosOCRC || ''}`, 50).moveDown(0.6);

  // ============ 4) Análisis de Modelos ============
  ensureSpace(14);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('4. Análisis de Modelos', 50).moveDown(0.3);

  // I. Relaciones dentarias
  const rd = analisisModelos.relacionesDentarias || {};
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('I. Relaciones Dentarias', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Oclusión de molares (Der/Izq): ${rd.oclusionMolaresDer || '-'} / ${rd.oclusionMolaresIzq || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Oclusión de caninos (Der/Izq): ${rd.oclusionCaninosDer || '-'} / ${rd.oclusionCaninosIzq || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Resalte horizontal (mm): ${rd.resalteHorizontal || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Resalte vertical (mm): ${rd.resalteVertical || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Línea media superior (mm): ${rd.lineaMediaSup || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Línea media inferior (mm): ${rd.lineaMediaInf || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Mordida cruzada post. derecha (mm): ${rd.mordidaCruzadaDer || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Mordida cruzada post. izquierda (mm): ${rd.mordidaCruzadaIzq || ''}`, 50).moveDown(0.6);

  // II. Anomalías dentarias
  ensureSpace(10);
  const ad = analisisModelos.anomaliasDentarias || {};
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('II. Anomalías Dentarias', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes ausentes: ${ad.dientesAusentes || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes malformados: ${ad.dientesMalformados || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Giroversión: ${ad.dientesGiroversion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Infraversión: ${ad.dientesInfraversion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Supraversion: ${ad.dientesSupraversion || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Pigmentados: ${ad.dientesPigmentados || ''}`, 50).moveDown(0.6);

  // III. Arcadas individuales
  ensureSpace(6);
  const ai = analisisModelos.arcadasIndividuales || {};
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('III. Arcadas Individuales', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Arcada Superior: ${(ai.arcadaSuperior || '').toUpperCase()}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Arcada Inferior: ${(ai.arcadaInferior || '').toUpperCase()}`, 50).moveDown(0.6);

  // ============ 5) Índices Valorativos ============
  ensureSpace(14);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('5. Índices Valorativos', 50).moveDown(0.3);

  // Pont - Maxilar
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Análisis de Pont - Maxilar', 50).moveDown(0.3);
  const pontMx = indicesValorativos.pontMaxilar || {};
  const pPre = pontMx.premaxila || {};
  const pPreMol = pontMx.premolares || {};
  const pMol = pontMx.molares || {};
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Premaxila (NC/Pac/Dif): ${pPre.nc || '-'} / ${pPre.pac || '-'} / ${pPre.dif || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Premolares (NC/Pac/Dif): ${pPreMol.nc || '-'} / ${pPreMol.pac || '-'} / ${pPreMol.dif || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Molares (NC/Pac/Dif): ${pMol.nc || '-'} / ${pMol.pac || '-'} / ${pMol.dif || '-'}`, 50).moveDown(0.6);

  // Pont - Mandibular
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Análisis de Pont - Mandibular', 50).moveDown(0.3);
  const pontMd = indicesValorativos.pontMandibular || {};
  const pmPre = pontMd.premolares || {};
  const pmMol = pontMd.molares || {};
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Premolares (Pac/Dif): ${pmPre.pac || '-'} / ${pmPre.dif || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Molares (Pac/Dif): ${pmMol.pac || '-'} / ${pmMol.dif || '-'}`, 50).moveDown(0.6);

  // Suma incisivos / Bolton / Longitud Arco
  ensureSpace(10);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Suma de los Incisivos: ${indicesValorativos.sumaIncisivos || ''}`, 50).moveDown(0.6);

  const sup = indicesValorativos.boltonSuperiores || [];
  const inf = indicesValorativos.boltonInferiores || [];
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Análisis de Bolton', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Superiores (16–26): ${sup.join(', ') || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Inferiores (46–36): ${inf.join(', ') || '-'}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Diferencia de Bolton (mm): ${indicesValorativos.diferenciaBolton || ''}`, 50).moveDown(0.6);

  const la = indicesValorativos.longitudArco || {};
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Análisis de Longitud de Arco', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Apinamiento (mm): ${la.apinamiento || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Protrusión Dental (mm): ${la.protrusionDental || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Curva de Spee (mm): ${la.curvaSpee || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Total (mm): ${la.totalLongitud || ''}`, 50).moveDown(0.6);

  // ============ 6) Plan de Tratamiento ============
  ensureSpace(14);
  const pt = planTratamiento || {};
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('6. Plan de Tratamiento', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Ortopedia - Maxilar: ${pt.ortopediaMaxilar || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Ortopedia - Mandíbula: ${pt.ortopediaMandibula || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes Inf. - Incisivo: ${pt.dientesInfIncisivo || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes Inf. - Molar: ${pt.dientesInfMolar || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes Sup. - Molar: ${pt.dientesSupMolar || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes Sup. - Incisivo: ${pt.dientesSupIncisivo || ''}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Dientes Sup. - Estética: ${pt.dientesSupEstetica || ''}`, 50).moveDown(0.3);
  const ancl = pt.anclaje || {};
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Anclaje Maxilar: ${(ancl.maxilar || '').toUpperCase()}`, 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(`Anclaje Mandibular: ${(ancl.mandibular || '').toUpperCase()}`, 50).moveDown(0.6);

  // ============ 7) Análisis Cefalométrico ============
  ensureSpace(16);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('7. Análisis Cefalométrico', 50).moveDown(0.3);

  const printRows = (titulo, rows = [], cols = []) => {
    ensureSpace(2);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text(titulo || '', 50).moveDown(0.3);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(10).fillColor('black').text('- (Sin registros)', 60).moveDown(0.3);
      return;
    }
    rows.forEach(r => {
      ensureSpace(1);
      const line = cols.map(k => r[k] ?? '-').join(' | ');
      doc.font('Helvetica').fontSize(10).fillColor('black').text(`- ${line}`, 60).moveDown(0.3);
    });
  };

  printRows('Biotipo Facial', (analisisCefalometrico.biotipoFacial || []), ['factor','nc','paciente','diferencia','dc','resultado']);
  doc.moveDown(0.3);
  printRows('Clase Esquelética', (analisisCefalometrico.claseEsqueletica || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.3);
  printRows('Problemas Verticales', (analisisCefalometrico.problemasVerticales || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.3);
  printRows('Factores Dentales', (analisisCefalometrico.factoresDentales || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.3);

  ensureSpace(4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('black').text('Diagnóstico', 50).moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('black').text(analisisCefalometrico.diagnosticoCefalometrico || '', 50).moveDown(0.6);

  // ============ 8) Factores Complementarios ============
  ensureSpace(12);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('8. Factores Complementarios', 50).moveDown(0.3);
  printRows('Clase II', (factoresComplementarios.claseII || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.3);
  printRows('Clase III', (factoresComplementarios.claseIII || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.3);
  printRows('Verticales', (factoresComplementarios.verticales || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.6);

  // ============ 9) Jaraback ============
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('9. Análisis Cefalométrico de Jaraback', 50).moveDown(0.3);
  printRows('', (analisisJaraback || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.6);

  // ============ 10) Medidas Lineales ============
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('10. Medidas Lineales', 50).moveDown(0.3);
  printRows('', (medidasLineales || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.6);

  // ============ 11) McNamara ============
  ensureSpace(8);
  doc.font('Helvetica-Bold').fontSize(12).fillColor('black').text('11. Análisis de McNamara', 50).moveDown(0.3);
  printRows('', (analisisMcNamara || []), ['factor','nc','paciente','dc']);
  doc.moveDown(0.6);

  // Pie de la ÚLTIMA página
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
