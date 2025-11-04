// services/pdf-service/routers/evolucion.js
const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();

const { insertarEncabezado, insertarPie, verificarEspacioYAgregarPagina } = require('../utils/pdfHelpers');
const { insertarFirma } = require('../utils/pdffirma');

router.post('/generate', (req, res) => {
  const {
    nombrePaciente = '',
    numeroPaciente = '',
    fechaRegistro = '',
    evoluciones = [],
    firmaPaciente = null
  } = req.body || {};

  const doc = new PDFDocument({ size: [612, 776], margin: 40 }); // Carta (pt)
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  doc.on('end', () => { res.set('Content-Type', 'application/pdf'); res.send(Buffer.concat(chunks)); });

  // ===== Encabezado
  insertarEncabezado(doc, 'CONSULTORIO DENTAL NIMAFESI', [
    'CIRUJANO DENTISTA NANCY HERNÁNDEZ LÓPEZ',
    'ESPECIALISTA EN CIRUGÍA Y ORTOPEDIA MAXILAR',
    'CED. 4808022 | CED. ESP. 7873133'
  ]);

  // ===== Cabecera de paciente
  doc.fontSize(12).fillColor('#666');
  doc.text(`PACIENTE: ${nombrePaciente}`, 50, doc.y, { continued: true });
  doc.text(`N°: ${numeroPaciente}`, { align: 'center', continued: true });
  doc.text(`FECHA: ${fechaRegistro}`, { align: 'right' });
  doc.moveDown(0.5);

  // ===== Tabla Evolución
  const startX = 40;
  const contentRight = doc.page.width - doc.page.margins.right; // 612 - 40 = 572
  const maxWidth = contentRight - startX;                       // 572 - 40 = 532

  // Anchuras por columna (suman ~532)
  const widths = [80, 150, 70, 110, 122]; // Fecha, Tratamiento, Costo, A/C, Próxima
  const headers = ['Fecha', 'Tratamiento', 'Costo ($)', 'A/C', 'Próxima cita y TX'];

  const PAD_Y = 4;           // padding vertical dentro de la celda
  const LINE_GAP = 2;        // separación extra entre filas
  const FOOTER_RESERVE = 80; // coherente con tus helpers

  const colX = (i) => startX + widths.slice(0, i).reduce((a, b) => a + b, 0);

  // Encabezados
  const headerY = doc.y;
  headers.forEach((h, i) => {
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000')
      .text(h, colX(i), headerY, { width: widths[i], align: 'center' });
  });
  // línea bajo encabezados
  doc.moveTo(startX, doc.y + 4).lineTo(startX + maxWidth, doc.y + 4).strokeColor('#999').lineWidth(0.5).stroke();
  doc.moveDown(0.6);

  // Si no hay registros
  if (!evoluciones || evoluciones.length === 0) {
    doc.font('Helvetica').fontSize(12).fillColor('#444').text('Sin registros de evolución.', startX, doc.y + 8);
  } else {
    // Filas
    evoluciones.forEach((evo, idx) => {
      // Valores con formateo básico
      const vals = [
        evo.fecha || '-',                               // Fecha
        String(evo.tratamiento || '-'),                 // Tratamiento
        (evo.costo != null && evo.costo !== '') ? Number(evo.costo).toFixed(0) : '-', // Costo
        String(evo.ac || '-'),                          // A/C
        String(evo.proxima || '-')                      // Próxima cita y TX
      ];

      // Medir alturas de cada celda considerando ancho y estilo
      const aligns = ['center', 'left', 'center', 'left', 'left'];
      const fonts  = ['Helvetica', 'Helvetica', 'Helvetica', 'Helvetica', 'Helvetica'];
      const sizes  = [12, 12, 12, 12, 12];

      const cellHeights = vals.map((v, i) => {
        const text = (v == null ? '-' : String(v));
        return doc.heightOfString(text, {
          width: widths[i],
          align: aligns[i],
          lineGap: 0
        });
      });

      // Altura final de la fila (máximo de celdas + paddings)
      const rowHeight = Math.max(...cellHeights) + (PAD_Y * 2);

      // Salto de página si no cabe
      verificarEspacioYAgregarPagina(doc, rowHeight + LINE_GAP + FOOTER_RESERVE);

      const rowY = doc.y;

      // Dibujar cada celda
      vals.forEach((v, i) => {
        const x = colX(i);
        const text = (v == null ? '-' : String(v));
        doc.font(fonts[i]).fontSize(sizes[i]).fillColor('#000')
          .text(text, x, rowY + PAD_Y, {
            width: widths[i],
            align: aligns[i]
          });
      });

      // Opcional: líneas de guía de fila (borde inferior suave)
      doc.moveTo(startX, rowY + rowHeight).lineTo(startX + maxWidth, rowY + rowHeight)
        .strokeColor('#e0e0e0').lineWidth(0.5).stroke();

      // Avanzar Y a la siguiente fila
      doc.y = rowY + rowHeight + LINE_GAP;
    });
  }

  doc.moveDown(1.5);

  // ===== Firma (si llega)
  insertarFirma(doc, firmaPaciente, { label: `${nombrePaciente}` });

  // ===== Pie
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
