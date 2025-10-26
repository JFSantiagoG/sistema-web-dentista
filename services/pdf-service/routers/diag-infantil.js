const express = require("express");
const PDFDocument = require("pdfkit");
const {
  insertarEncabezado,
  insertarPie,
  verificarEspacioYAgregarPagina
} = require("../utils/pdfHelpers");

const router = express.Router();

router.post("/generate", (req, res) => {
  const {
    paciente,
    odontograma = [],
    tratamientosGenerales = [],
    presupuesto,
    odontogramaVisual // lo recibimos, pero no lo imprimimos en el log
  } = req.body;

  // Log limpio (sin la imagen base64)
  const { odontogramaVisual: _omit, ...logData } = req.body;
  console.log("📄 Diagnóstico infantil recibido:", logData);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {
    res.set("Content-Type", "application/pdf");
    res.send(Buffer.concat(chunks));
  });

  // === Encabezado ===
  insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Diagnóstico Infantil"]);

  // === Datos del paciente ===
  doc
    .fontSize(10)
    .fillColor("gray")
    .text(`PACIENTE: ${paciente?.nombre ?? "-"}`, 50, doc.y, { continued: true })
    .text(`ID: ${paciente?.id ?? "-"}`, { align: "center", continued: true })
    .text(`FECHA: ${paciente?.fecha ?? "-"}`, { align: "right" })
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
      .image(buffer, {
        fit: [500, 300],
        align: "center"
      })
      .moveDown(1.5);
  }

  // === Configuración columnas ===
  const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right; // ~515
  const gutter = 20;
  const colWidth = (contentWidth - gutter) / 2; // ~247.5
  const firstColX = doc.page.margins.left;      // 40 -> pero abajo usamos 50 como estética
  const secondColX = doc.page.margins.left + colWidth + gutter;

  const startColX1 = 50;           // leve padding visual
  const startColX2 = secondColX;   // segunda columna
  let columnTopY = doc.y;          // techo de columnas (debajo de imagen/datos)
  let colX = startColX1;
  let colY = columnTopY;
  let inSecondColumn = false;

  const footerReserve = 80;
  const maxY = doc.page.height - doc.page.margins.bottom - footerReserve;

  let bottomYCol1 = columnTopY;
  let bottomYCol2 = columnTopY;

  // === TITULO: Tratamientos por Diente ===
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Tratamientos por Diente", colX, colY)
    .moveDown(0.5);

  columnTopY = doc.y; // si el título movió el cursor
  colY = columnTopY;

  // === Bucle dos columnas (odontograma) ===
  odontograma.forEach(item => {
    if (colY > maxY) {
      if (!inSecondColumn) {
        // saltar a segunda columna en la misma página
        colX = startColX2;
        colY = columnTopY;
        inSecondColumn = true;
      } else {
        // nueva página
        doc.addPage();
        insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Diagnóstico Infantil"]);
        insertarPie(doc, false);

        columnTopY = doc.y;
        colX = startColX1;
        colY = columnTopY;

        // reimprimir título
        doc
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor("#00457C")
          .text("Tratamientos por Diente", colX, colY)
          .moveDown(0.5);

        columnTopY = doc.y;
        colY = columnTopY;
        inSecondColumn = false;

        bottomYCol1 = columnTopY;
        bottomYCol2 = columnTopY;
      }
    }

    const diente = item?.diente ?? "-";
    const tratamiento = item?.tratamiento ?? "-";
    const costo = Number(item?.costo ?? 0);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("black")
      .text(`Diente ${diente}: ${tratamiento}`, colX, colY, { continued: true, width: colWidth })
      .fillColor("#008000")
      .text(` - $${costo.toFixed(2)}`);

    colY += 12;

    if (colX === startColX1) {
      bottomYCol1 = Math.max(bottomYCol1, colY);
    } else {
      bottomYCol2 = Math.max(bottomYCol2, colY);
    }
  });

  // ====== MEDICIÓN de espacio requerido para las secciones siguientes ======
  const measureNextSectionsHeight = () => {
    let h = 0;

    // Tratamientos Generales (si hay)
    if (Array.isArray(tratamientosGenerales) && tratamientosGenerales.length > 0) {
      doc.font("Helvetica-Bold").fontSize(11);
      h += doc.heightOfString("Tratamientos Generales", { width: colWidth });
      h += doc.currentLineHeight() * 0.5;

      doc.font("Helvetica").fontSize(10);
      tratamientosGenerales.forEach(tx => {
        const nombreTx = tx?.nombre ?? "-";
        const costoTx = Number(tx?.costo ?? 0);
        const line = `${nombreTx}: $${costoTx.toFixed(2)}`;
        h += doc.heightOfString(line, { width: colWidth });
        h += doc.currentLineHeight() * 0.3;
      });

      h += 6; // pequeño margen extra
    }

    // Presupuesto Total
    const total = Number(presupuesto?.total ?? 0);
    const meses = Number(presupuesto?.meses ?? 0);
    const mensualidad = Number(presupuesto?.mensualidad ?? 0);

    doc.font("Helvetica-Bold").fontSize(11);
    h += doc.heightOfString("Presupuesto Total", { width: colWidth });
    h += doc.currentLineHeight() * 0.5;

    doc.font("Helvetica").fontSize(10);
    h += doc.heightOfString(`Total estimado: $${total.toFixed(2)}`, { width: colWidth });
    h += doc.heightOfString(`Duración: ${meses} meses`, { width: colWidth });
    h += doc.heightOfString(`Mensualidad estimada: $${mensualidad.toFixed(2)}`, { width: colWidth });

    h += 10; // margen final

    return h;
  };

  const sectionsHeight = measureNextSectionsHeight();

  // ====== DECISIÓN: dónde imprimir las secciones ======
  // 1) Intentar en la columna actual
  let targetX = colX;
  let targetY = colY;
  let targetColumn = inSecondColumn ? 2 : 1;
  let remainHere = maxY - targetY;

  if (sectionsHeight > remainHere) {
    // 2) Si estamos en primera columna, intentar segunda columna (misma página)
    if (targetColumn === 1) {
      const remainSecond = maxY - columnTopY;
      if (sectionsHeight <= remainSecond) {
        targetX = startColX2;
        targetY = columnTopY;
        targetColumn = 2;
      } else {
        // 3) No cabe en segunda: nueva página
        doc.addPage();
        insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Diagnóstico Infantil"]);
        insertarPie(doc, false);
        columnTopY = doc.y;
        targetX = startColX1;
        targetY = columnTopY;
        targetColumn = 1;
      }
    } else {
      // ya estamos en segunda columna y no cabe: nueva página
      doc.addPage();
      insertarEncabezado(doc, "CONSULTORIO DENTAL NIMAFESI", ["Diagnóstico Infantil"]);
      insertarPie(doc, false);
      columnTopY = doc.y;
      targetX = startColX1;
      targetY = columnTopY;
      targetColumn = 1;
    }
  }

  // Colocar cursor en el punto elegido
  doc.x = targetX;
  doc.y = targetY;

  // ====== IMPRESIÓN: Tratamientos Generales ======
  if (Array.isArray(tratamientosGenerales) && tratamientosGenerales.length > 0) {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#00457C")
      .text("Tratamientos Generales", targetX, doc.y, { width: colWidth })
      .moveDown(0.5);

    tratamientosGenerales.forEach(tx => {
      const nombreTx = tx?.nombre ?? "-";
      const costoTx = Number(tx?.costo ?? 0);
      // Línea completa dentro del ancho de columna
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("black")
        .text(`${nombreTx}`, targetX, doc.y, { width: colWidth, continued: true })
        .fillColor("#008000")
        .text(`: $${costoTx.toFixed(2)}`, { width: colWidth });
      doc.moveDown(0.3);
    });

    doc.moveDown(0.3);
  }

  // ====== IMPRESIÓN: Presupuesto Total ======
  const total = Number(presupuesto?.total ?? 0);
  const meses = Number(presupuesto?.meses ?? 0);
  const mensualidad = Number(presupuesto?.mensualidad ?? 0);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#00457C")
    .text("Presupuesto Total", targetX, doc.y, { width: colWidth })
    .moveDown(0.5);

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("black")
    .text(`Total estimado: `, targetX, doc.y, { width: colWidth, continued: true })
    .fillColor("#B22222")
    .text(`$${total.toFixed(2)}`, { width: colWidth });

  doc
    .fillColor("black")
    .text(`Duración: ${meses} meses`, targetX, doc.y, { width: colWidth })
    .moveDown(0.3);

  doc
    .fillColor("black")
    .text(`Mensualidad estimada: `, targetX, doc.y, { width: colWidth, continued: true })
    .fillColor("#B22222")
    .text(`$${mensualidad.toFixed(2)}`, { width: colWidth });

  // === Pie ===
  doc.moveDown(2);
  insertarPie(doc, true);

  doc.end();
});

module.exports = router;
