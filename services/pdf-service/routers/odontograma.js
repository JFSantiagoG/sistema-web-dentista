// services/pdf-service/routers/odontograma.js
const express = require("express");
const PDFDocument = require("pdfkit");
const { insertarEncabezado, insertarPie } = require("../utils/pdfHelpers");

const router = express.Router();

router.post("/generate", (req, res) => {
  const {
    paciente = {},               // { nombre, fechaTermino }
    tratamientosPorDiente = {},  // { "18": ["Limpieza", ...], ... }
    estadoEncia = {},            // { "Encía": "Sana", ... }
    odontogramaVisual            // dataURL base64 opcional (png)
  } = req.body || {};

  // Log ligero (sin base64)
  console.log("PDF Odontograma →", {
    nombre: paciente?.nombre || "(vacío)",
    fecha: paciente?.fechaTermino || "(vacío)",
    dientesConTx: Object.keys(tratamientosPorDiente || {}).length,
    camposEncia: Object.keys(estadoEncia || {}).length,
    img: odontogramaVisual ? "sí" : "no",
  });

  // ===== Crear PDF =====
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {
    res.set("Content-Type", "application/pdf");
    res.send(Buffer.concat(chunks));
  });

  // ---------- Helpers de salto (MISMO PATRÓN QUE HISTORIA) ----------
  const LINE = 14; // altura estimada por línea
  const BOTTOM_SAFE = () =>
    doc.page.height - doc.page.margins.bottom - 2 * LINE; // deja 2 líneas para el pie

  function nuevaPagina(title = "") {
    // pie de la página actual (como en historia)
    doc.font("Helvetica").fontSize(8).fillColor("gray").text("", 40, BOTTOM_SAFE());
    insertarPie(doc, false);
    // nueva página + encabezado
    doc.addPage();
    insertarEncabezado(
      doc,
      "CONSULTORIO DENTAL NIMAFESI",
      ["Odontograma Clínico"]
    );
    if (title) {
      doc
        .moveDown(0.3)
        .font("Helvetica-Bold").fontSize(11).fillColor("black")
        .text(title, 50)
        .moveDown(0.5);
    }
  }

  function ensureSpace(lines = 3, titleIfNewPage = "") {
    const need = lines * LINE;
    if (doc.y + need > BOTTOM_SAFE()) {
      nuevaPagina(titleIfNewPage);
    }
  }

  const leftX = 50;
  const usableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // ---------- Encabezado de la primera página ----------
  insertarEncabezado(
    doc,
    "CONSULTORIO DENTAL NIMAFESI",
    ["Odontograma Clínico"]
  );

  // ============ 1) Identificación del Paciente ============
  ensureSpace(6);
  doc
    .font("Helvetica-Bold").fontSize(12).fillColor("black")
    .text("1. Identificación del Paciente", leftX)
    .moveDown(0.3);

  doc
    .font("Helvetica").fontSize(10).fillColor("black")
    .text(`Paciente: ${paciente?.nombre || "-"}`, leftX, doc.y, { width: usableWidth })
    .moveDown(0.2)
    .text(`Fecha de término: ${paciente?.fechaTermino || "-"}`, leftX, doc.y, { width: usableWidth })
    .moveDown(0.6);

  // ============ 2) Odontograma Visual (opcional) ============
  if (odontogramaVisual) {
    ensureSpace(3);
    doc
      .font("Helvetica-Bold").fontSize(12).fillColor("black")
      .text("2. Odontograma Visual", leftX)
      .moveDown(0.3);

    try {
      const base64Data = odontogramaVisual.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // reservar aprox. 24 líneas (~300px)
      ensureSpace(24, "2. Odontograma Visual (cont.)");
      doc.image(buffer, {
        fit: [500, 300],
        align: "center",
        valign: "top",
      });
      doc.moveDown(1.0);
    } catch (e) {
      console.error("❌ Error al insertar imagen de odontograma:", e);
      ensureSpace(2);
      doc
        .font("Helvetica").fontSize(10).fillColor("red")
        .text("No se pudo mostrar la imagen del odontograma.", leftX)
        .moveDown(0.6);
    }
  }

  // ============ 3) Tratamientos por Diente ============
  const dientesOrdenados = Object.keys(tratamientosPorDiente || {}).sort((a, b) => {
    const na = Number(a), nb = Number(b);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  ensureSpace(3);
  doc
    .font("Helvetica-Bold").fontSize(12).fillColor("black")
    .text("3. Tratamientos por Diente", leftX)
    .moveDown(0.3);

  if (!dientesOrdenados.length) {
    ensureSpace(2);
    doc
      .font("Helvetica").fontSize(10).fillColor("black")
      .text("- (Sin tratamientos asignados)", leftX)
      .moveDown(0.6);
  } else {
    dientesOrdenados.forEach((dId, idx) => {
      const lista = Array.isArray(tratamientosPorDiente[dId])
        ? tratamientosPorDiente[dId]
        : (tratamientosPorDiente[dId] ? [String(tratamientosPorDiente[dId])] : []);

      if (!lista.length) {
        ensureSpace(1, idx === 0 ? "3. Tratamientos por Diente" : "3. Tratamientos por Diente (cont.)");
        doc
          .font("Helvetica").fontSize(10).fillColor("black")
          .text(`- Diente ${dId}: (sin tratamientos)`, leftX)
          .moveDown(0.15);
        return;
      }

      lista.forEach((tx, j) => {
        ensureSpace(1, (idx === 0 && j === 0) ? "3. Tratamientos por Diente" : "3. Tratamientos por Diente (cont.)");
        doc
          .font("Helvetica").fontSize(10).fillColor("black")
          .text(`- Diente ${dId}: ${tx}`, leftX)
          .moveDown(0.15);
      });
    });
    doc.moveDown(0.6);
  }

  // ============ 4) Estado de la Encía ============
  const estadoKeys = Object.keys(estadoEncia || {});
  ensureSpace(3);
  doc
    .font("Helvetica-Bold").fontSize(12).fillColor("black")
    .text("4. Estado de la Encía", leftX)
    .moveDown(0.3);

  if (!estadoKeys.length) {
    ensureSpace(1);
    doc
      .font("Helvetica").fontSize(10).fillColor("black")
      .text("- (Sin observaciones de encía)", leftX)
      .moveDown(0.6);
  } else {
    estadoKeys.forEach((k, i) => {
      const line = `- ${k}: ${estadoEncia[k] || "-"}`;
      ensureSpace(1, i === 0 ? "4. Estado de la Encía" : "4. Estado de la Encía (cont.)");
      doc
        .font("Helvetica").fontSize(10).fillColor("black")
        .text(line, leftX)
        .moveDown(0.15);
    });
    doc.moveDown(0.6);
  }

  // Pie de la última página (como en historia)
  insertarPie(doc, false);

  doc.end();
});

module.exports = router;
