const express = require("express");
const PDFDocument = require("pdfkit");
const { insertarEncabezado, insertarPie } = require("../utils/pdfHelpers");

const router = express.Router();

router.post("/generate", (req, res) => {
  const { paciente, tratamientosPorDiente = {}, estadoEncia = {}, odontogramaVisual } = req.body;

  // Log limpio: NO imprimimos la imagen base64
  const { odontogramaVisual: _omit, ...logData } = req.body;
  console.log("📄 Odontograma recibido:", logData);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {
    res.set("Content-Type", "application/pdf");
    res.send(Buffer.concat(chunks));
  });

  // === Encabezado + Pie (siempre al crear página) ===
  const initPage = (titleForContinuation) => {
    insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Odontograma Clínico"]);
    insertarPie(doc, false); // 👈 pie una sola vez por página (incluida la primera)
    if (titleForContinuation) {
      doc
        .moveDown(0.3)
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#00457C")
        .text(titleForContinuation, leftX, doc.y, { width: usableWidth })
        .moveDown(0.5);
    }
  };

  // Crear la PRIMERA página (con encabezado y pie)
  insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Odontograma Clínico"]);
  insertarPie(doc, false); // 👈 pie en la página 1

  // === Datos del paciente ===
  doc
    .fontSize(10)
    .fillColor("gray")
    .text(`PACIENTE: ${paciente?.nombre ?? "-"}`, 50, doc.y, { continued: true })
    .text(`FECHA DE TÉRMINO: ${paciente?.fechaTermino ?? "-"}`, { align: "right" })
    .moveDown(1.5);

  // === Imagen del odontograma (opcional) ===
  if (odontogramaVisual) {
    const base64Data = odontogramaVisual.replace(/^data:image\/png;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#00457C")
      .text("Odontograma Visual", { align: "center" })
      .moveDown(0.5)
      .image(buffer, { fit: [500, 300], align: "center" })
      .moveDown(1.2);
  }

  // === Configuración de una sola columna ===
  const leftX = 50;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right; // ~515
  const footerReserve = 80; // reserva para no pisar el pie
  const maxY = doc.page.height - doc.page.margins.bottom - footerReserve;

  // Helper: asegura espacio o crea nueva página (encabezado + pie) y opcionalmente reimprime título
  const ensureSpace = (heightNeeded, titleIfNewPage = "") => {
    if (doc.y + heightNeeded <= maxY) return;
    doc.addPage();
    // Encabezado + Pie SIEMPRE al crear página
    insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Odontograma Clínico"]);
    insertarPie(doc, false);
    doc.moveDown(0.3);
    if (titleIfNewPage) {
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#00457C")
        .text(titleIfNewPage, leftX, doc.y, { width: usableWidth })
        .moveDown(0.5);
    }
  };

  // === Tratamientos por Diente (UNA COLUMNA, una línea por tratamiento) ===
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Tratamientos por Diente", leftX, doc.y, { width: usableWidth })
    .moveDown(0.5);

  const dientesOrdenados = Object.keys(tratamientosPorDiente).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  dientesOrdenados.forEach((dienteId, idx) => {
    const lista = Array.isArray(tratamientosPorDiente[dienteId])
      ? tratamientosPorDiente[dienteId]
      : (tratamientosPorDiente[dienteId] ? [String(tratamientosPorDiente[dienteId])] : []);

    if (lista.length === 0) {
      const line = `Diente ${dienteId}: (sin tratamientos)`;
      const h = doc.heightOfString(line, { width: usableWidth });
      ensureSpace(h, idx === 0 ? "Tratamientos por Diente" : "Tratamientos por Diente (cont.)");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(line, leftX, doc.y, { width: usableWidth })
        .moveDown(0.15);
      return;
    }

    lista.forEach((tx, j) => {
      const line = `Diente ${dienteId}: ${tx}`;
      const h = doc.heightOfString(line, { width: usableWidth });
      ensureSpace(h, (idx === 0 && j === 0) ? "Tratamientos por Diente" : "Tratamientos por Diente (cont.)");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(line, leftX, doc.y, { width: usableWidth })
        .moveDown(0.15);
    });
  });

  doc.moveDown(0.6);

  // === Estado de la Encía (una columna) ===
  const estadoKeys = Object.keys(estadoEncia);
  let estadoHeight = 0;
  {
    const titleH = (() => {
      doc.font("Helvetica-Bold").fontSize(11);
      return doc.heightOfString("Estado de la Encía", { width: usableWidth }) + doc.currentLineHeight() * 0.4;
    })();
    doc.font("Helvetica").fontSize(10);
    const linesH = estadoKeys.reduce((acc, k) => {
      const line = `${k}: ${estadoEncia[k]}`;
      return acc + doc.heightOfString(line, { width: usableWidth }) + 3;
    }, 0);
    estadoHeight = titleH + linesH + 6;
  }

  ensureSpace(estadoHeight, "Estado de la Encía");

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Estado de la Encía", leftX, doc.y, { width: usableWidth })
    .moveDown(0.4);

  estadoKeys.forEach((condicion) => {
    const valor = estadoEncia[condicion];
    const line = `${condicion}: ${valor}`;
    const h = doc.heightOfString(line, { width: usableWidth });
    ensureSpace(h, "Estado de la Encía (cont.)");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("black")
      .text(line, leftX, doc.y, { width: usableWidth })
      .moveDown(0.15);
  });

  // ❌ Importante: NO dibujar pie aquí.
  // El pie ya se dibuja una sola vez cada vez que se crea una página.

  doc.end();
});

module.exports = router;
