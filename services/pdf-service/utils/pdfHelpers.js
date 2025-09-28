const path = require('path');
const fs = require('fs');

function insertarEncabezado(doc, tituloPrincipal = 'CONSULTORIO DENTAL NIMAFESI', subtitulos = []) {
  const assets = path.join(__dirname, '../assets');
  const logoUNAM = path.join(assets, 'logo.png');
  const logoFESI = path.join(assets, 'diente.png');
  const fondo    = path.join(assets, 'diente.png');

  if (fs.existsSync(fondo)) {
    doc.opacity(0.08)
       .image(fondo, 0, 0, {
         width: doc.page.width,
         height: doc.page.height
       })
       .opacity(1);
  }

  if (fs.existsSync(logoFESI)) {
    doc.image(logoFESI, 35, 40, { width: 50 });
  }
  if (fs.existsSync(logoUNAM)) {
    doc.image(logoUNAM, doc.page.width - 90, 40, { width: 50 });
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor('#00457C')
    .text(tituloPrincipal, { align: 'center' });

  subtitulos.forEach((linea, i) => {
    doc
      .moveDown(i === 0 ? 0.3 : 0.1)
      .fontSize(11)
      .fillColor('black')
      .text(linea, { align: 'center' });
  });

  doc.moveDown(1.5);
}

function insertarPie(doc, firma = true) {
  const marginLeft   = doc.page.margins.left;
  const marginRight  = doc.page.margins.right;
  const marginBottom = doc.page.margins.bottom;
  const pageWidth    = doc.page.width;
  const pageHeight   = doc.page.height;
  const contentWidth = pageWidth - marginLeft - marginRight;

  const linea1 = 'CONSULTORIO DENTAL NIMAFESI AV. CUAUHTÉMOC No 205, COL ROMA NORTE, CDMX, TEL. 55842721 / CEL. 5548591837';
  const linea2 = 'CONSULTORIO 206, 2DO PISO, EDIFICIO MARA · LUNES A VIERNES 10:00–20:00 · SÁBADOS 10:00–14:00';

  const prevFontSize = doc._fontSize;
  const prevFill     = doc._fillColor;
  const prevX        = doc.x;
  const prevY        = doc.y;

  const fitAndDrawCentered = (text, targetY, startSize = 8, minSize = 6) => {
    let size = startSize;
    doc.fontSize(size);
    let w = doc.widthOfString(text);
    while (w > contentWidth && size > minSize) {
      size -= 0.5;
      doc.fontSize(size);
      w = doc.widthOfString(text);
    }
    // centrar manualmente para evitar envoltura
    const x = (pageWidth - w) / 2;
    doc.text(text, x, targetY, { lineBreak: false }); 
    return size;
  };
  doc.fillColor('gray');
  let tmpFontSize = 8;
  const estLineHeight = (s) => s * 1.2;

  const y2 = pageHeight - marginBottom - estLineHeight(tmpFontSize);             
  const y1 = y2 - estLineHeight(tmpFontSize);                                    

  // Dibuja ambas líneas (cada una ajusta su tamaño si hace falta)
  const size2 = fitAndDrawCentered(linea2, y2, 8, 6);
  const size1 = fitAndDrawCentered(linea1, y1, Math.max(8, size2), 6);

  // Restaura estado
  doc.fontSize(prevFontSize || 12);
  doc.fillColor(prevFill || 'black');
  doc.x = prevX;
  doc.y = prevY;
}
module.exports = { insertarEncabezado, insertarPie };