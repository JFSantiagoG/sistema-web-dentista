/**
 * Inserta una firma en el PDF, centrada y con línea base
 * @param {PDFDocument} doc - Instancia de PDFKit
 * @param {string|null} firmaBase64 - Imagen en base64 de la firma (PNG)
 * @param {Object} options - Opciones de personalización
 * @param {string} options.label - Texto bajo la firma ("Médico", "Paciente", etc.)
 * @param {number} [options.width=140] - Ancho de la firma
 * @param {number} [options.height=70] - Alto de la firma
 */
function insertarFirma(
  doc,
  firmaBase64,
  {
    label = "Médico",
    width = 140,
    height = 70
  } = {}
) {
  const pageWidth = doc.page.width;
  const posX = (pageWidth - width) / 2;  // ✅ centrado horizontal
  const posY = doc.y;                    // posición actual Y

  if (!firmaBase64) {
    doc
      .moveDown(1.5)
      .fontSize(10)
      .fillColor("black")
      .text("__________________________________", { align: "center" })
      .text(`Firma de ${label} no disponible`, { align: "center" });
    return;
  }

  try {
    const data = firmaBase64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(data, "base64");

    // Firma centrada
    doc.image(buffer, posX, posY, { width, height });

    // Línea base justo debajo de la firma (pegada)
    const lineY = posY + height - 10; 
    doc
      .moveTo(posX, lineY)
      .lineTo(posX + width, lineY)
      .strokeColor("#000")
      .lineWidth(1)
      .stroke();

    // Texto bajo la línea
    doc
      .fontSize(10)
      .fillColor("black")
      .text(`${label}`, 0, lineY + 3, { align: "center" });

    doc.moveDown(1.5);
  } catch (err) {
    console.error("❌ Error al insertar firma:", err);
    doc
      .fontSize(10)
      .fillColor("red")
      .text(`Error al mostrar firma de ${label}`, { align: "center" });
  }
}

module.exports = { insertarFirma };
