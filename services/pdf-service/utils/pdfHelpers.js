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
  if (firma) {
    doc
      .fontSize(10)
      .fillColor('black')
      .text('____________________________', { align: 'center' })
      .text('Firma del Paciente', { align: 'center' })
      .moveDown(1);
  }

  doc
    .fontSize(8)
    .fillColor('gray')
    .text('CONSULTORIO DENTAL NIMAFESI AV. CUAUHTÉMOC No 205, COL ROMA NORTE, CDMX, TEL. 55842721 / CEL. 5548591837', { align: 'center' })
    .text('CONSULTORIO 206, 2DO PISO, EDIFICIO MARA LUNES A VIERNES 10:00–20:00 | SÁBADOS 10:00–14:00', { align: 'center' })
}
module.exports = { insertarEncabezado, insertarPie };