// services/pdf-service/utils/pdffirma.js
const { Buffer } = require("buffer");

/**
 * Intenta convertir una firma (dataURL o base64) en un Buffer PNG válido
 * @param {string} firmaBase64
 * @returns {Buffer|null}
 */
function decodeFirmaToPngBuffer(firmaBase64) {
  if (!firmaBase64 || typeof firmaBase64 !== "string") return null;

  let raw = firmaBase64.trim();

  // 1) Si viene como dataURL: data:image/png;base64,AAAA...
  const m = raw.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$/);
  if (m) {
    raw = m[1];
  }

  // 2) Limpiar caracteres NO válidos de base64 (por si algo se coló)
  //    Permitimos A-Z a-z 0-9 + / =
  raw = raw.replace(/[^A-Za-z0-9+/=]/g, "");

  let buffer;
  try {
    buffer = Buffer.from(raw, "base64");
  } catch (err) {
    console.error("❌ Error al decodificar base64 de firma:", err);
    return null;
  }

  if (!buffer || buffer.length < 20) {
    console.error("❌ Firma demasiado pequeña, posible PNG truncado. Size:", buffer.length);
    return null;
  }

  // 3) Verificar cabecera PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = buffer.slice(0, 8).toString("hex");
  if (pngHeader !== "89504e470d0a1a0a") {
    console.error("❌ La firma no tiene cabecera PNG válida. Header:", pngHeader);
    return null;
  }

  return buffer;
}

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
  const posX = (pageWidth - width) / 2;
  const startY = doc.y;

  console.log(
    "🖊️ insertarFirma() – firmaBase64 len:",
    firmaBase64 ? firmaBase64.length : 0
  );

  // 1) Intentar decodificar la imagen si existe
  if (firmaBase64) {
    try {
      const buffer = decodeFirmaToPngBuffer(firmaBase64);

      if (buffer) {
        console.log("🖊️ Firma decodificada OK. Buffer bytes:", buffer.length);
        doc.image(buffer, posX, startY, { width, height });
      } else {
        console.warn("⚠️ No se pudo decodificar la firma, se dibuja solo línea y label.");
      }
    } catch (err) {
      console.error("❌ Error al insertar firma:", err);
      // seguimos sin imagen, pero conservamos layout
    }
  }

  // 2) SIEMPRE dibujar la línea base y el label
  const lineY = startY + height - 10;

  doc
    .moveTo(posX, lineY)
    .lineTo(posX + width, lineY)
    .strokeColor("#000")
    .lineWidth(1)
    .stroke();

  doc
    .fontSize(10)
    .fillColor("black")
    .text(`${label}`, 0, lineY + 3, { align: "center" });

  doc.y = lineY + 22;
  doc.moveDown(0.5);
}

module.exports = { insertarFirma };
