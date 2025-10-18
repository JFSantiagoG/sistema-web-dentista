const express = require('express');
const PDFDocument = require('pdfkit');
const { insertarEncabezado, insertarPie, verificarEspacioYAgregarPagina } = require('../utils/pdfHelpers');

const router = express.Router();

router.post('/generate', (req, res) => {
  const data = req.body;
  const {
    nombrePaciente = '',
    fechaIngreso = '',
    fechaAlta = '',
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

  // 🧾 Log limpio (resumen, sin spamear la consola):
  console.log('📋 Ortodoncia recibida:', {
    nombrePaciente,
    fechaIngreso,
    fechaAlta,
    examenClinicoKeys: Object.keys(examenClinico).length,
    analisisFuncionalKeys: Object.keys(analisisFuncional).length,
    analisisModelosBlocks: {
      relacionesDentarias: Object.keys(analisisModelos.relacionesDentarias || {}).length,
      anomaliasDentarias: Object.keys(analisisModelos.anomaliasDentarias || {}).length,
      arcadasIndividuales: Object.keys(analisisModelos.arcadasIndividuales || {}).length
    },
    indicesValorativosKeys: Object.keys(indicesValorativos || {}).length,
    planTratamientoKeys: Object.keys(planTratamiento || {}).length,
    analisisCefalometrico: {
      biotipoFacial: (analisisCefalometrico.biotipoFacial || []).length,
      claseEsqueletica: (analisisCefalometrico.claseEsqueletica || []).length,
      problemasVerticales: (analisisCefalometrico.problemasVerticales || []).length,
      factoresDentales: (analisisCefalometrico.factoresDentales || []).length,
      diagnosticoLen: (analisisCefalometrico.diagnosticoCefalometrico || '').length
    },
    factoresComplementarios: {
      claseII: (factoresComplementarios.claseII || []).length,
      claseIII: (factoresComplementarios.claseIII || []).length,
      verticales: (factoresComplementarios.verticales || []).length
    },
    analisisJaraback: analisisJaraback.length,
    medidasLineales: medidasLineales.length,
    analisisMcNamara: analisisMcNamara.length
  });

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // === Página 1: Encabezado + Pie ===
  insertarEncabezado(doc, 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ', [
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'
  ]);
  insertarPie(doc, false);

  // ========= Configuración general =========
  const LEFT_X = 50;
  const WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right; // ~515
  const FOOTER_RESERVE = 80; // no pisar el pie

  // Estilos consistentes
  const setTitle = () => doc.font('Helvetica-Bold').fontSize(12).fillColor('#111');
  const setSub = () => doc.font('Helvetica-Bold').fontSize(11).fillColor('#00457C');
  const setBody = () => doc.font('Helvetica').fontSize(10).fillColor('#111');

  // Wrapper de tu helper con reserva para el pie
  const vspace = (h) => {
    verificarEspacioYAgregarPagina(
      doc,
      h + FOOTER_RESERVE,
      'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
      ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR']
    );
  };

  const bullet = (text) => {
    setBody();
    vspace(Math.max(16, doc.heightOfString(`• ${text}`, { width: WIDTH })));
    doc.text(`• ${text}`, LEFT_X, doc.y, { width: WIDTH });
  };

  const labelValue = (label, value, opts = {}) => {
    const t = `${label}: ${value ?? '-'}`;
    setBody();
    vspace(Math.max(16, doc.heightOfString(t, { width: WIDTH })));
    doc.text(t, LEFT_X, doc.y, { width: WIDTH, align: opts.align || 'left' });
  };

  const smallGap = () => doc.moveDown(0.3);
  const midGap = () => doc.moveDown(0.6);

  // ===== 1. Identificación del Paciente =====
  setTitle();
  doc.text('1. Identificación del Paciente', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  labelValue('Nombre', nombrePaciente);
  labelValue('Fecha de Ingreso', fechaIngreso);
  labelValue('Fecha de Alta', fechaAlta);

  // ===== 2. Examen Clínico =====
  vspace(60);
  setTitle();
  doc.text('2. Examen Clínico', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  labelValue('Tipo de cuerpo', examenClinico.tipoCuerpo || '');
  labelValue('Tipo de cara', examenClinico.tipoCara || '');
  labelValue('Tipo de cráneo', examenClinico.tipoCraneo || '');
  labelValue('Otros', examenClinico.otros || '', { align: 'justify' });

  // ===== 3. Análisis Funcional =====
  vspace(60);
  setTitle();
  doc.text('3. Análisis Funcional', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  setSub(); doc.text('a) Funciones Básicas'); smallGap();
  labelValue('Respiración', analisisFuncional.respiracion || '', { align: 'justify' });
  labelValue('Deglución', analisisFuncional.deglucion || '', { align: 'justify' });
  labelValue('Masticación', analisisFuncional.masticacion || '', { align: 'justify' });
  labelValue('Fonación', analisisFuncional.fonacion || '', { align: 'justify' });

  vspace(40);
  setSub(); doc.text('b) Salud Articular'); smallGap();
  labelValue('Problemas en la actualidad', analisisFuncional.problemasATM || '', { align: 'justify' });
  labelValue('Dolor', (analisisFuncional.dolorATM || '').toUpperCase() === 'SI' ? 'Sí' : (analisisFuncional.dolorATM || 'No'));
  labelValue('Ruidos', (analisisFuncional.ruidosATM || '').toUpperCase() === 'SI' ? 'Sí' : (analisisFuncional.ruidosATM || 'No'));
  labelValue('Dolor a la palpación', analisisFuncional.dolorPalpacion || '', { align: 'justify' });

  labelValue('Máxima Apertura (mm)', analisisFuncional.aperturaMax || '');
  labelValue('Lateralidad Izq. (mm)', analisisFuncional.latIzq || '');
  labelValue('Protrusión (mm)', analisisFuncional.protrusion || '');
  labelValue('Lateralidad Der. (mm)', analisisFuncional.latDer || '');

  vspace(40);
  setSub(); doc.text('c) Discrepancia OC-RC'); smallGap();
  labelValue('Vertical (mm)', analisisFuncional.verticalOCRC || '');
  labelValue('Horizontal (mm)', analisisFuncional.horizontalOCRC || '');
  labelValue('Otros', analisisFuncional.otrosOCRC || '', { align: 'justify' });

  // ===== 4. Análisis de Modelos =====
  vspace(60);
  setTitle();
  doc.text('4. Análisis de Modelos', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  setSub(); doc.text('I. Relaciones Dentarias'); smallGap();
  const rd = analisisModelos.relacionesDentarias || {};
  labelValue('Oclusión de molares (Der/Izq, mm)', `${rd.oclusionMolaresDer || '-'} / ${rd.oclusionMolaresIzq || '-'}`);
  labelValue('Oclusión de caninos (Der/Izq, mm)', `${rd.oclusionCaninosDer || '-'} / ${rd.oclusionCaninosIzq || '-'}`);
  labelValue('Resalte horizontal (mm)', rd.resalteHorizontal || '');
  labelValue('Resalte vertical (mm)', rd.resalteVertical || '');
  labelValue('Línea media superior (mm)', rd.lineaMediaSup || '');
  labelValue('Línea media inferior (mm)', rd.lineaMediaInf || '');
  labelValue('Mordida cruzada post. derecha (mm)', rd.mordidaCruzadaDer || '');
  labelValue('Mordida cruzada post. izquierda (mm)', rd.mordidaCruzadaIzq || '');

  vspace(36);
  setSub(); doc.text('II. Anomalías Dentarias'); smallGap();
  const ad = analisisModelos.anomaliasDentarias || {};
  labelValue('Dientes ausentes', ad.dientesAusentes || '');
  labelValue('Dientes con malformación', ad.dientesMalformados || '');
  labelValue('Giroversión', ad.dientesGiroversion || '');
  labelValue('Infraversión', ad.dientesInfraversion || '');
  labelValue('Supraversion', ad.dientesSupraversion || '');
  labelValue('Pigmentados', ad.dientesPigmentados || '');

  vspace(36);
  setSub(); doc.text('III. Arcadas Individuales'); smallGap();
  const ai = analisisModelos.arcadasIndividuales || {};
  labelValue('Arcada Superior', (ai.arcadaSuperior || '').toUpperCase() || '-');
  labelValue('Arcada Inferior', (ai.arcadaInferior || '').toUpperCase() || '-');

  // ===== 5. Índices Valorativos =====
  vspace(60);
  setTitle();
  doc.text('5. Índices Valorativos', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  setSub(); doc.text('Análisis de Pont - Maxilar'); smallGap();
  const pontMx = (indicesValorativos.pontMaxilar || {});
  const pPre = pontMx.premaxila || {}, pPreMol = pontMx.premolares || {}, pMol = pontMx.molares || {};
  labelValue('Premaxila (NC/Pac/Dif)', `${pPre.nc || '-'} / ${pPre.pac || '-'} / ${pPre.dif || '-'}`);
  labelValue('Premolares (NC/Pac/Dif)', `${pPreMol.nc || '-'} / ${pPreMol.pac || '-'} / ${pPreMol.dif || '-'}`);
  labelValue('Molares (NC/Pac/Dif)', `${pMol.nc || '-'} / ${pMol.pac || '-'} / ${pMol.dif || '-'}`);

  vspace(24);
  setSub(); doc.text('Análisis de Pont - Mandibular'); smallGap();
  const pontMd = (indicesValorativos.pontMandibular || {});
  const pmPre = pontMd.premolares || {}, pmMol = pontMd.molares || {};
  labelValue('Premolares (Pac/Dif)', `${pmPre.pac || '-'} / ${pmPre.dif || '-'}`);
  labelValue('Molares (Pac/Dif)', `${pmMol.pac || '-'} / ${pmMol.dif || '-'}`);

  vspace(16);
  labelValue('Suma de los Incisivos', indicesValorativos.sumaIncisivos || '');

  vspace(24);
  setSub(); doc.text('Análisis de Bolton'); smallGap();
  const sup = indicesValorativos.boltonSuperiores || [];
  const inf = indicesValorativos.boltonInferiores || [];
  labelValue('Superiores (16–26)', sup.join(', ') || '-');
  labelValue('Inferiores (46–36)', inf.join(', ') || '-');
  labelValue('Diferencia de Bolton (mm)', indicesValorativos.diferenciaBolton || '');

  vspace(24);
  setSub(); doc.text('Análisis de Longitud de Arco'); smallGap();
  const la = indicesValorativos.longitudArco || {};
  labelValue('Apinamiento (mm)', la.apinamiento || '');
  labelValue('Protrusión Dental (mm)', la.protrusionDental || '');
  labelValue('Curva de Spee (mm)', la.curvaSpee || '');
  labelValue('Total (mm)', la.totalLongitud || '');

  // ===== 6. Plan de Tratamiento =====
  vspace(60);
  setTitle();
  doc.text('6. Plan de Tratamiento', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  const pt = planTratamiento || {};
  labelValue('Ortopedia - Maxilar', pt.ortopediaMaxilar || '', { align: 'justify' });
  labelValue('Ortopedia - Mandíbula', pt.ortopediaMandibula || '', { align: 'justify' });
  labelValue('Dientes Inferiores - Incisivo', pt.dientesInfIncisivo || '', { align: 'justify' });
  labelValue('Dientes Inferiores - Molar', pt.dientesInfMolar || '', { align: 'justify' });
  labelValue('Dientes Superiores - Molar', pt.dientesSupMolar || '', { align: 'justify' });
  labelValue('Dientes Superiores - Incisivo', pt.dientesSupIncisivo || '', { align: 'justify' });
  labelValue('Dientes Superiores - Estética', pt.dientesSupEstetica || '', { align: 'justify' });
  const ancl = pt.anclaje || {};
  labelValue('Anclaje Maxilar', (ancl.maxilar || '').toUpperCase() || '-');
  labelValue('Anclaje Mandibular', (ancl.mandibular || '').toUpperCase() || '-');

  // ===== 7. Análisis Cefalométrico =====
  vspace(60);
  setTitle();
  doc.text('7. Análisis Cefalométrico', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  const printTableRows = (title, rows = [], cols = []) => {
    if (!rows || rows.length === 0) {
      bullet(`${title}: (sin registros)`);
      return;
    }
    setSub(); doc.text(title); smallGap();
    rows.forEach(r => {
      const line = cols.map(k => r[k] ?? '-').join(' | ');
      bullet(line);
    });
    midGap();
  };

  printTableRows('Biotipo Facial', (analisisCefalometrico.biotipoFacial || []), ['factor','nc','paciente','diferencia','dc','resultado']);
  printTableRows('Clase Esquelética', (analisisCefalometrico.claseEsqueletica || []), ['factor','nc','paciente','dc']);
  printTableRows('Problemas Verticales', (analisisCefalometrico.problemasVerticales || []), ['factor','nc','paciente','dc']);
  printTableRows('Factores Dentales', (analisisCefalometrico.factoresDentales || []), ['factor','nc','paciente','dc']);

  setSub(); doc.text('Diagnóstico'); smallGap();
  labelValue('', analisisCefalometrico.diagnosticoCefalometrico || '', { align: 'justify' });

  // ===== 8. Factores Complementarios =====
  vspace(60);
  setTitle();
  doc.text('8. Factores Complementarios', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();

  printTableRows('Clase II', (factoresComplementarios.claseII || []), ['factor','nc','paciente','dc']);
  printTableRows('Clase III', (factoresComplementarios.claseIII || []), ['factor','nc','paciente','dc']);
  printTableRows('Verticales', (factoresComplementarios.verticales || []), ['factor','nc','paciente','dc']);

  // ===== 9. Análisis Cefalométrico de Jaraback =====
  vspace(60);
  setTitle();
  doc.text('9. Análisis Cefalométrico de Jaraback', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();
  printTableRows('', (analisisJaraback || []), ['factor','nc','paciente','dc']);

  // ===== 10. Medidas Lineales =====
  vspace(60);
  setTitle();
  doc.text('10. Medidas Lineales', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();
  printTableRows('', (medidasLineales || []), ['factor','nc','paciente','dc']);

  // ===== 11. Análisis de McNamara =====
  vspace(60);
  setTitle();
  doc.text('11. Análisis de McNamara', LEFT_X, doc.y, { width: WIDTH, underline: true });
  midGap();
  printTableRows('', (analisisMcNamara || []), ['factor','nc','paciente','dc']);

  // ⚠️ No dibujar pie aquí: se añade cuando se crea/navega de página por el helper
  doc.end();
});

module.exports = router;
