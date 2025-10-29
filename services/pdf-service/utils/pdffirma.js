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
  const posX = (pageWidth - width) / 2;   // centrado horizontal
  const startY = doc.y;                   // ancla vertical (siempre igual)

  // 1) Intentar dibujar la imagen si existe
  if (firmaBase64) {
    try {
      const data = firmaBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(data, "base64");
      doc.image(buffer, posX, startY, { width, height });
    } catch (err) {
      console.error("❌ Error al insertar firma:", err);
      // Si falla, seguimos sin imagen, pero conservamos el layout.
    }
  }
  // 2) SIEMPRE dibujar la línea base y el label, con la misma geometría
  const lineY = startY + height - 10; // pegada al borde inferior de la firma
  doc
    .moveTo(posX, lineY)
    .lineTo(posX + width, lineY)
    .strokeColor("#000")
    .lineWidth(1)
    .stroke();

  // Texto bajo la línea, centrado
  doc
    .fontSize(10)
    .fillColor("black")
    .text(`${label}`, 0, lineY + 3, { align: "center" });

  // Avanzar el cursor dejando un respiro uniforme
  doc.y = lineY + 22; // deja espacio bajo el label
  doc.moveDown(0.5);
}

module.exports = { insertarFirma };
