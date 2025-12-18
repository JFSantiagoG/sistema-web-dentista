const express = require('express');
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
    nombrePaciente = '',
    fecha = '',
    edad = '',
    nombreMedico = '',
    cedula = '',
    medicamentos = []
  } = req.body;

  const doc = new PDFDocument({
    size: [595.28, 420], // A5 apaisado como lo tenías
    margin: 40
  });

  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => {
    res.set('Content-Type', 'application/pdf');
    res.send(Buffer.concat(chunks));
  });

  // =========================
  // CONFIG LAYOUT
  // =========================
  const FOOTER_RESERVE = 80; // reserva para que NUNCA se encime con el pie
  const startX = 50;

  const headers = ['Medicamento', 'Dosis', 'Frecuencia', 'Duración', 'Indicaciones'];
  const widths  = [110, 80, 80, 80, 150];

  const paddingX = 6;
  const paddingY = 3;

  const fontSizeHeader = 7;  // no tan grande para que quepa
  const fontSizeBody   = 5;
  const minRowHeight   = 18;

  const HEADER_TITLE = 'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ';
  const HEADER_LINES = ['ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR'];

  // =========================
  // HELPERS
  // =========================
  function drawHeader() {
    insertarEncabezado(doc, HEADER_TITLE, HEADER_LINES);
  }

  function drawFooter() {
    insertarPie(doc, false);
  }

  function bottomLimit() {
    return doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
  }

  /**
   * Asegura espacio antes de dibujar algo.
   * Si no cabe: pone pie -> nueva página -> encabezado -> (opcional) callback
   * Retorna true si cambió de página.
   */
  function ensureSpace(neededHeight, afterNewPage) {
    if (doc.y + neededHeight <= bottomLimit()) return false;

    // Cierra página actual
    drawFooter();

    // Nueva página
    doc.addPage();

    // Reponer encabezado
    drawHeader();

    // Hook (p.ej. volver a poner datos del paciente o header tabla)
    if (typeof afterNewPage === 'function') afterNewPage();

    return true;
  }

  function drawPatientBlock() {
    // Altura aproximada del bloque (para el ensureSpace inicial si quieres)
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('gray')
      .text(`FECHA: ${fecha}`, startX)
      .moveDown(0.3)
      .text(`NOMBRE DEL PACIENTE: ${nombrePaciente}`, startX, doc.y, { continued: true })
      .text(`EDAD: ${edad}`, { align: 'right' })
      .moveDown(0.8);
  }

  function rowHeightFor(values, { isHeader = false } = {}) {
    const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
    const size = isHeader ? fontSizeHeader : fontSizeBody;

    const heights = values.map((v, i) => {
      const text = (v == null || v === '') ? '-' : String(v);
      const h = doc.font(font).fontSize(size).heightOfString(text, {
        width: widths[i] - paddingX * 2,
        align: 'center'
      });
      return h + paddingY * 2;
    });

    return Math.max(minRowHeight, ...heights);
  }

  function drawTableHeader() {
    const h = rowHeightFor(headers, { isHeader: true });

    // Si justo el header no cabe (raro), salta y vuelve a dibujar
    ensureSpace(h, () => {
      drawPatientBlock();
    });

    const y = doc.y;
    let x = startX;

    for (let i = 0; i < headers.length; i++) {
      const text = headers[i];

      doc
        .lineWidth(0.7)
        .strokeColor('#333')
        .rect(x, y, widths[i], h)
        .stroke();

      const th = doc.font('Helvetica-Bold').fontSize(fontSizeHeader).heightOfString(text, {
        width: widths[i] - paddingX * 2,
        align: 'center'
      });

      const ty = y + (h - th) / 2;

      doc
        .fillColor('black')
        .font('Helvetica-Bold')
        .fontSize(fontSizeHeader)
        .text(text, x + paddingX, ty, {
          width: widths[i] - paddingX * 2,
          align: 'center'
        });

      x += widths[i];
    }

    doc.y = y + h;
    doc.moveDown(0.2);
  }

  function drawRow(values) {
    const h = rowHeightFor(values, { isHeader: false });

    // Si no cabe la fila, brinca de página y repite header tabla
    const pageChanged = ensureSpace(h, () => {
      drawPatientBlock();
      drawTableHeader();
    });

    // (ya quedó en nueva página con header, o siguió igual)
    const y = doc.y;
    let x = startX;

    for (let i = 0; i < values.length; i++) {
      const text = (values[i] == null || values[i] === '') ? '-' : String(values[i]);

      doc
        .lineWidth(0.5)
        .strokeColor('#999')
        .rect(x, y, widths[i], h)
        .stroke();

      const th = doc.font('Helvetica').fontSize(fontSizeBody).heightOfString(text, {
        width: widths[i] - paddingX * 2,
        align: 'center'
      });
      const ty = y + (h - th) / 2;

      doc
        .fillColor('black')
        .font('Helvetica')
        .fontSize(fontSizeBody)
        .text(text, x + paddingX, ty, {
          width: widths[i] - paddingX * 2,
          align: 'center'
        });

      x += widths[i];
    }

    doc.y = y + h;
    doc.moveDown(0.15);
  }

  // =========================
  // PDF CONTENT
  // =========================
  drawHeader();

  // Datos paciente
  // (si por alguna razón tu encabezado ocupa mucho, aseguras espacio para esto)
  ensureSpace(60, () => drawPatientBlock());
  drawPatientBlock();

  // Tabla: header
  drawTableHeader();

  // Filas
  const meds = Array.isArray(medicamentos) ? medicamentos : [];
  if (meds.length === 0) {
    drawRow(['-', '-', '-', '-', '-']);
  } else {
    meds.forEach(m => {
      drawRow([
        m?.nombre,
        m?.dosis,
        m?.frecuencia,
        m?.duracion,
        m?.indicaciones
      ]);
    });
  }

  // Espacio antes de la firma
  // (ajusta 140 si tu firma es más grande)
  ensureSpace(140, () => {
    drawPatientBlock();
    // no es necesario repetir header de tabla aquí, ya vamos a firma
  });

  // Firma
  insertarFirma(doc, firmaMedico, { label: `${nombreMedico} · Cédula: ${cedula}` });

  // Pie final (última página)
  drawFooter();

  doc.end();
});

module.exports = router;
