//PDF PRESUPUESTO
const express     = require("express");
const PDFDocument = require("pdfkit");

const { insertarEncabezado, insertarPie } = require("../utils/pdfHelpers");
const router = express.Router();

router.post("/generate", (req, res) => {
  const { odontogramaVisual, ...datosSinImagen } = req.body;
  console.log("📄 Presupuesto recibido:", datosSinImagen);

  const {
    paciente,
    odontograma = [],
    tratamientosGenerales = [],
    presupuesto
  } = req.body;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40
  });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {
    res.set("Content-Type", "application/pdf");
    res.send(Buffer.concat(chunks));
  });

  // === Encabezado ===
  insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", [
    "Presupuesto de Tratamiento Odontológico"
  ]);

  // === Datos paciente ===
  doc
    .fontSize(10)
    .fillColor("gray")
    .text(`PACIENTE: ${paciente.nombre}`, 50, doc.y, { continued: true })
    .text(`N°: ${paciente.numeroPaciente}`, { align: "center", continued: true })
    .text(`FECHA: ${paciente.fechaRegistro}`, { align: "right" })
    .moveDown(1.5);

  // === Odontograma visual ===
  if (odontogramaVisual) {
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor("#00457C")
      .text("Odontograma Visual", { align: "center" })
      .moveDown(0.5)
      .image(odontogramaVisual, {
        fit: [500, 300],
        align: "center"
      })
      .moveDown(1.5);
  }

  // === Tratamientos por Diente ===
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Tratamientos por Diente", { align: "left" })
    .moveDown(0.5);

  const startY = doc.y;
  let colX = 50; // columna izquierda
  let colY = startY;
  const maxY = 700; // límite inferior
  let inSecondColumn = false;

  odontograma.forEach((item) => {
    if (colY > maxY) {
      if (!inSecondColumn) {
        // pasa a segunda columna
        colX = 320;
        colY = startY;
        inSecondColumn = true;
      } else {
        // ya está en segunda columna → nueva página
        doc.addPage();
        insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", [
          "Presupuesto de Tratamiento Odontológico"
        ]);
        colX = 50;
        colY = 120;
        inSecondColumn = false;
      }
    }

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("black")
      .text(`Diente ${item.diente}: ${item.tratamiento}`, colX, colY, {
        continued: true
      })
      .fillColor("#008000")
      .text(` - $${item.costo.toFixed(2)}`);

    colY += 12;
  });

  // === Tratamientos Generales & Costo Total ===
  if (colY > maxY) {
    if (!inSecondColumn) {
      // pasa a segunda columna
      colX = 320;
      colY = startY;
      inSecondColumn = true;
    } else {
      // ya usaste ambas columnas → nueva hoja
      doc.addPage();
      insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", [
        "Presupuesto de Tratamiento Odontológico"
      ]);
      colX = 50;
      colY = 120;
      inSecondColumn = false;
    }
  }

  // --- Tratamientos Generales ---
  if (tratamientosGenerales.length > 0) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#00457C")
      .text("Tratamientos Generales", colX, colY);

    colY += 15;

    tratamientosGenerales.forEach((tx) => {
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(`${tx.nombre}`, colX, colY, { continued: true })
        .fillColor("#008000")
        .text(`: $${tx.costo.toFixed(2)}`);
      colY += 14;
    });
  }

  // --- Costo Total ---
  colY += 10;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Costo Total", colX, colY);

  colY += 15;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("black")
    .text(`Total estimado: `, colX, colY, { continued: true })
    .fillColor("#B22222")
    .text(`$${presupuesto.total.toFixed(2)}`);

  colY += 15;
  doc
    .fillColor("black")
    .text(`Duración: ${presupuesto.meses} meses`, colX, colY);

  colY += 15;
  doc
    .fillColor("black")
    .text(`Mensualidad estimada: `, colX, colY, { continued: true })
    .fillColor("#B22222")
    .text(`$${presupuesto.mensualidad.toFixed(2)}`);

  // === Pie institucional ===
  doc.moveDown(2);
  insertarPie(doc, true);

  doc.end();
}); // END PDF PRESUPUESTO

module.exports = router;
