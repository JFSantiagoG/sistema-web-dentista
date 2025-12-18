const urlParams = new URLSearchParams(window.location.search);
const viewerMode = urlParams.get('mode') || '2d';
const pacienteId = urlParams.get('paciente') || '';
const groupId    = urlParams.get('group')   || '';
const filesParam = urlParams.get('files')   || '';
// ===============================
//  HELPERS SWEETALERT2
// ===============================
function haveSwal() {
  return typeof Swal !== 'undefined';
}

// Confirm genérico para borrar algo
async function swalConfirmDelete(texto, { title } = {}) {
  if (!haveSwal()) return confirm(texto); // fallback

  const res = await Swal.fire({
    icon: 'warning',
    title: title || '¿Estás seguro?',
    text: texto,
    showCancelButton: true,
    confirmButtonText: 'Sí, borrar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33',
    cancelButtonColor: '#6c757d'
  });
  return res.isConfirmed;
}

// Toast de elemento eliminado
function swalDeletedToast(titulo) {
  if (!haveSwal()) {
    console.log(titulo);
    return;
  }
  Swal.fire({
    icon: 'info',
    title: titulo,
    timer: 900,
    showConfirmButton: false,
    toast: true,
    position: 'top-end'
  });
}

// -------------------------------------------
// SELECTORES BASE
// -------------------------------------------
const imagen = document.getElementById("imagenVisualizada");
let dicomViewer = document.getElementById("dicomViewer");

// -------------------------------------------
// ESTADO COMÚN (JPG/PNG)
// -------------------------------------------
let zoomLevel = 1, rotation = 0, currentFilter = "none";
let rasterFilterMode = "none";
let brightnessFactor = 1;
let contrastFactor   = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false, startX, startY;

let activeTool = "none"; // "none" | "measure" | "pan" | "annotate" | "rect" | "circle" | "angle"

// JPG/PNG overlay
let rasterWrapper = null;
let measureOverlay = null;

// ⚠️ Todo en coords de IMAGEN (naturalWidth/Height)
let measureStartImg = null;
let measurements = []; // [{startImg:{x,y}, endImg:{x,y}, distMm:number}]
let drawingMeasure = false;

let rasterAnnotations = []; // [{posImg:{x,y}, text:string}]
let rasterShapes = [];      // [{type:"rect"|"circle", startImg:{x,y}, endImg:{x,y}}]
let shapeStartImg = null;

let anglePoints = [];       // array temporal de hasta 3 puntos (en coords de imagen)
let angles = [];            // lista de ángulos guardados [{center, p1, p2, value}]

const PIXEL_TO_MM = 25.4 / 96; // 1px @96dpi ≈ 0.26458 mm

// Utils
const deepClone = (o) => JSON.parse(JSON.stringify(o));
const setCursor = (el, cur) => { if (el) el.style.cursor = cur; };

// -------------------------------------------
// ESTADO DICOM (manual, sin cornerstoneTools)
// -------------------------------------------
let isDicom = false;
let dicomBaseViewport = null;
let dicomOverlay = null;
let dicomCtx = null;

let dicomMeasureStartImg = null;
let dicomPreviewImg = null;
let dicomMeasurements = []; // [{startImg:{x,y}, endImg:{x,y}, distPx, distMm}]

let dicomIsPanning = false;
let dicomPanStart = null;
let dicomPanStartTranslation = null;

let dicomPixelSpacing = null; // [rowSpacing, colSpacing]
// Stack 3D (varios cortes DICOM)
let dicomStack = {
  imageIds: [],
  currentIndex: 0
};


// Figuras y Notas DICOM
let dicomShapes = [];       // [{type:"rect"|"circle", startImg:{x,y}, endImg:{x,y}}]
let dicomShapeStartImg = null;
let dicomShapePreviewImg = null;

let dicomAnnotations = [];  // [{posImg:{x,y}, text:string}]

let dicomAnglePoints = [];  // array temporal de hasta 3 puntos
let dicomAngles = [];       // [{center, p1, p2, value}]
let dicomAnglePreview = null;

// -------------------------------------------
// INICIALIZAR DICOM
// -------------------------------------------
function initDicomViewer() {
  
  if (viewerMode === '3d') return;
  if (!dicomViewer) return;

  dicomViewer.style.position = "relative";
  dicomViewer.style.touchAction = "none";

  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

  try {
    cornerstoneWADOImageLoader.webWorkerManager.initialize({
      webWorkerPath: "/visualizador/static/libs/cornerstoneWADOImageLoaderWebWorker.js",
      taskConfiguration: {
        decodeTask: {
          codecsPath: "/visualizador/static/libs/cornerstoneWADOImageLoaderCodecs.js",
        },
      },
    });
  } catch (e) {
    console.warn("⚠️ WebWorker opcional no inicializado");
  }

  try {
    cornerstone.enable(dicomViewer);
  } catch (e) {
    console.error("❌ cornerstone.enable falló:", e);
    return;
  }

  const ruta = dicomViewer.getAttribute("data-file");
  if (!ruta) return;
  const imageId = "wadouri:" + window.location.origin + ruta;

  cornerstone.loadImage(imageId).then((image) => {
    cornerstone.displayImage(dicomViewer, image);
    dicomBaseViewport = deepClone(cornerstone.getViewport(dicomViewer));
    isDicom = true;

    dicomPixelSpacing = readPixelSpacing(image);
    console.log("🧪 PixelSpacing:", dicomPixelSpacing || "No definido");

    ensureDicomOverlay();

    dicomViewer.addEventListener("cornerstoneimagerendered", redrawDicomOverlay);
    wireDicomMouseEvents();

    console.log("✅ DICOM cargado (manual overlay)");
  }).catch((err) => {
    console.error("❌ Error DICOM:", err);
    dicomViewer.innerHTML = '<div style="padding:12px;color:#a00;text-align:center">No se pudo visualizar el archivo DICOM.</div>';
  });
}
initDicomViewer();

// -------------------------------------------
// OVERLAY DICOM
// -------------------------------------------
function ensureDicomOverlay() {
  if (!dicomViewer) return;
  if (!dicomOverlay) {
    dicomOverlay = document.createElement("canvas");
    dicomOverlay.style.position = "absolute";
    dicomOverlay.style.top = "0";
    dicomOverlay.style.left = "0";
    dicomOverlay.style.pointerEvents = "auto"; // necesitamos eventos encima
    dicomOverlay.style.zIndex = "10";
    dicomViewer.appendChild(dicomOverlay);
    dicomCtx = dicomOverlay.getContext("2d");
  }
  resizeDicomOverlay();
}

function resizeDicomOverlay() {
  if (!dicomOverlay || !dicomViewer) return;
  dicomOverlay.width = dicomViewer.clientWidth;
  dicomOverlay.height = dicomViewer.clientHeight;
  redrawDicomOverlay();
}

function redrawDicomOverlay() {
  if (!dicomCtx || !dicomOverlay) return;
  dicomCtx.clearRect(0, 0, dicomOverlay.width, dicomOverlay.height);

  dicomCtx.lineWidth = 2;
  dicomCtx.font = "16px Arial";

  // Mediciones
  dicomMeasurements.forEach(m => {
    const s = cornerstone.pixelToCanvas(dicomViewer, m.startImg);
    const e = cornerstone.pixelToCanvas(dicomViewer, m.endImg);

    dicomCtx.strokeStyle = "yellow";
    dicomCtx.fillStyle = "yellow";

    dicomCtx.beginPath(); dicomCtx.arc(s.x, s.y, 5, 0, Math.PI * 2); dicomCtx.fill();
    dicomCtx.beginPath(); dicomCtx.arc(e.x, e.y, 5, 0, Math.PI * 2); dicomCtx.fill();

    dicomCtx.beginPath(); dicomCtx.moveTo(s.x, s.y); dicomCtx.lineTo(e.x, e.y); dicomCtx.stroke();

    const label = (m.distMm != null)
      ? `${m.distMm.toFixed(1)} mm`
      : `${m.distPx.toFixed(1)} px`;
    dicomCtx.fillText(label, e.x + 10, e.y - 10);
  });

  // Figuras persistentes
  dicomShapes.forEach(s => {
    const sp = cornerstone.pixelToCanvas(dicomViewer, s.startImg);
    const ep = cornerstone.pixelToCanvas(dicomViewer, s.endImg);
    dicomCtx.strokeStyle = "magenta";
    if (s.type === "rect") {
      dicomCtx.strokeRect(sp.x, sp.y, ep.x - sp.x, ep.y - sp.y);
    } else if (s.type === "circle") {
      dicomCtx.strokeStyle = "blue";
      const r = Math.hypot(ep.x - sp.x, ep.y - sp.y);
      dicomCtx.beginPath(); dicomCtx.arc(sp.x, sp.y, r, 0, Math.PI * 2); dicomCtx.stroke();
    }
  });

  // Ángulos persistentes
  dicomAngles.forEach(a => {
    const c = cornerstone.pixelToCanvas(dicomViewer, a.center);
    const p1 = cornerstone.pixelToCanvas(dicomViewer, a.p1);
    const p2 = cornerstone.pixelToCanvas(dicomViewer, a.p2);

    dicomCtx.strokeStyle = "cyan";
    dicomCtx.fillStyle = "cyan";

    [c, p1, p2].forEach(p => {
      dicomCtx.beginPath(); dicomCtx.arc(p.x, p.y, 4, 0, Math.PI * 2); dicomCtx.fill();
    });

    dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(p1.x, p1.y); dicomCtx.stroke();
    dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(p2.x, p2.y); dicomCtx.stroke();

    dicomCtx.fillText(`${a.value.toFixed(1)}°`, c.x + 10, c.y - 10);
  });

  // Preview de ángulo
  if (activeTool === "angle" && dicomAnglePoints.length > 0 && dicomAnglePreview) {
    dicomCtx.strokeStyle = "limegreen";
    dicomCtx.lineWidth = 2;

    if (dicomAnglePoints.length === 1) {
      // línea p1 → cursor
      const p1 = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[0]);
      const pTemp = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePreview);
      dicomCtx.beginPath(); dicomCtx.moveTo(p1.x, p1.y); dicomCtx.lineTo(pTemp.x, pTemp.y); dicomCtx.stroke();
    } else if (dicomAnglePoints.length === 2) {
      // p1–c fijo + c–cursor dinámico
      const p1 = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[0]);
      const c  = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[1]);
      const pTemp = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePreview);

      dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(p1.x, p1.y); dicomCtx.stroke();
      dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(pTemp.x, pTemp.y); dicomCtx.stroke();
    }
  }

  // Notas
  dicomCtx.fillStyle = "red";
  dicomAnnotations.forEach(a => {
    const p = cornerstone.pixelToCanvas(dicomViewer, a.posImg);
    dicomCtx.beginPath(); dicomCtx.arc(p.x, p.y, 5, 0, Math.PI * 2); dicomCtx.fill();
    dicomCtx.fillText(a.text, p.x + 8, p.y - 8);
  });

  // Preview medición
  if (dicomMeasureStartImg && dicomPreviewImg && activeTool === "measure") {
    const s = cornerstone.pixelToCanvas(dicomViewer, dicomMeasureStartImg);
    const e = cornerstone.pixelToCanvas(dicomViewer, dicomPreviewImg);
    dicomCtx.strokeStyle = "limegreen";
    dicomCtx.fillStyle = "limegreen";
    dicomCtx.beginPath(); dicomCtx.arc(s.x, s.y, 5, 0, Math.PI * 2); dicomCtx.fill();
    dicomCtx.beginPath(); dicomCtx.moveTo(s.x, s.y); dicomCtx.lineTo(e.x, e.y); dicomCtx.stroke();
  }

  // Preview figura
  if (dicomShapeStartImg && dicomShapePreviewImg && (activeTool === "rect" || activeTool === "circle")) {
    const sp = cornerstone.pixelToCanvas(dicomViewer, dicomShapeStartImg);
    const ep = cornerstone.pixelToCanvas(dicomViewer, dicomShapePreviewImg);
    dicomCtx.strokeStyle = "limegreen";
    dicomCtx.lineWidth = 2;
    if (activeTool === "rect") {
      dicomCtx.strokeRect(sp.x, sp.y, ep.x - sp.x, ep.y - sp.y);
    } else {
      const r = Math.hypot(ep.x - sp.x, ep.y - sp.y);
      dicomCtx.beginPath(); dicomCtx.arc(sp.x, sp.y, r, 0, Math.PI * 2); dicomCtx.stroke();
    }
  }
}

// Helpers DICOM
function getImagePointFromMouseEvent(evt) {
  return cornerstone.pageToPixel(dicomViewer, evt.pageX, evt.pageY);
}
function distanceInMm(dx, dy) {
  if (!dicomPixelSpacing) return null;
  const [rowSpacing, colSpacing] = dicomPixelSpacing;
  return Math.sqrt((dx * colSpacing) ** 2 + (dy * rowSpacing) ** 2);
}
function readPixelSpacing(image) {
  try {
    const ds = image.data;
    let sp = ds?.string?.("x00280030") || ds?.string?.("x00181164");
    if (!sp) return null;
    const parts = sp.split("\\").map(parseFloat);
    return [parts[0], parts[1]];
  } catch { return null; }
}

function wireDicomMouseEvents() {
  // Usamos el overlay para captar eventos (pointerEvents:auto)
  const target = dicomOverlay || dicomViewer;

  // -----------------------------
  // MOUSE DOWN
  // -----------------------------
  target.addEventListener("mousedown", async (e) => {
    if (!isDicom || e.button !== 0) return;

    // Pan
    if (activeTool === "pan") {
      const vp = cornerstone.getViewport(dicomViewer);
      dicomIsPanning = true;
      dicomPanStart = { pageX: e.pageX, pageY: e.pageY };
      dicomPanStartTranslation = { ...vp.translation };
      setCursor(dicomViewer, "grabbing");
      return;
    }

    // Medición
    if (activeTool === "measure") {
      const imgPt = getImagePointFromMouseEvent(e);
      if (!dicomMeasureStartImg) {
        dicomMeasureStartImg = imgPt;
        dicomPreviewImg = null;
      } else {
        const dx = imgPt.x - dicomMeasureStartImg.x;
        const dy = imgPt.y - dicomMeasureStartImg.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const distMm = distanceInMm(dx, dy);
        dicomMeasurements.push({
          startImg: dicomMeasureStartImg,
          endImg: imgPt,
          distPx,
          distMm
        });
        dicomMeasureStartImg = null;
        dicomPreviewImg = null;
      }
      redrawDicomOverlay();
      return;
    }

    // Figuras
    if (activeTool === "rect" || activeTool === "circle") {
      const imgPt = getImagePointFromMouseEvent(e);
      if (!dicomShapeStartImg) {
        dicomShapeStartImg = imgPt;
        dicomShapePreviewImg = null;
      } else {
        dicomShapes.push({
          type: activeTool,
          startImg: dicomShapeStartImg,
          endImg: imgPt
        });
        dicomShapeStartImg = null;
        dicomShapePreviewImg = null;
        redrawDicomOverlay();
      }
      return;
    }

    // Ángulo (3 clics: p1, centro, p2)
    if (activeTool === "angle") {
      const imgPt = getImagePointFromMouseEvent(e);
      dicomAnglePoints.push(imgPt);

      if (dicomAnglePoints.length === 3) {
        const [p1, c, p2] = dicomAnglePoints;
        const ang = calcAngle(p1, c, p2);
        dicomAngles.push({ p1, center: c, p2, value: ang });
        dicomAnglePoints = [];
        dicomAnglePreview = null;
      }
      redrawDicomOverlay();
      return;
    }

    // Notas
    if (activeTool === "annotate") {
      const imgPt = getImagePointFromMouseEvent(e);

      let text = null;

      if (haveSwal()) {
        const { value } = await Swal.fire({
          title: 'Agregar nota',
          input: 'textarea',
          inputLabel: 'Escribe tu nota',
          inputPlaceholder: 'Escribe aquí tu nota…',
          inputAttributes: {
            'aria-label': 'Escribe tu nota'
          },
          showCancelButton: true,
          confirmButtonText: 'Guardar',
          cancelButtonText: 'Cancelar'
        });
        text = value;
      } else {
        text = prompt('📝 Escribe tu nota:');
      }

      text = (text || '').trim();
      if (text) {
        dicomAnnotations.push({ posImg: imgPt, text });
        redrawDicomOverlay();

        // Toast bonito con la nota
        if (haveSwal()) {
          Swal.fire({
            icon: 'success',
            title: 'Nota agregada',
            text: text,
            timer: 1400,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        } else {
          console.log('Nota DICOM agregada:', text);
        }
      }

      return;
    }
  });

  // -----------------------------
  // MOUSE MOVE
  // -----------------------------
  target.addEventListener("mousemove", (e) => {
    if (!isDicom) return;

    // Pan en curso
    if (dicomIsPanning && activeTool === "pan") {
      const vp = cornerstone.getViewport(dicomViewer);
      vp.translation.x =
        dicomPanStartTranslation.x + (e.pageX - dicomPanStart.pageX);
      vp.translation.y =
        dicomPanStartTranslation.y + (e.pageY - dicomPanStart.pageY);
      cornerstone.setViewport(dicomViewer, vp);
      return;
    }

    // Preview medición
    if (activeTool === "measure" && dicomMeasureStartImg) {
      dicomPreviewImg = getImagePointFromMouseEvent(e);
      redrawDicomOverlay();
      return;
    }

    // Preview figura
    if ((activeTool === "rect" || activeTool === "circle") && dicomShapeStartImg) {
      dicomShapePreviewImg = getImagePointFromMouseEvent(e);
      redrawDicomOverlay();
      return;
    }

    // Preview ángulo
    if (activeTool === "angle" && dicomAnglePoints.length > 0) {
      dicomAnglePreview = getImagePointFromMouseEvent(e);
      redrawDicomOverlay();
      return;
    }
  });

  // -----------------------------
  // MOUSE UP
  // -----------------------------
  window.addEventListener("mouseup", () => {
    if (dicomIsPanning) {
      dicomIsPanning = false;
      setCursor(dicomViewer, "grab");
    }
  });

  // -----------------------------
  // CLIC DERECHO (borrado) – CON SWEETALERT
  // -----------------------------
  target.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    if (!isDicom) return;

    const ptImg = getImagePointFromMouseEvent(e);
    const tolPxCanvas = 10;
    const vp = cornerstone.getViewport(dicomViewer);
    const tolDicom = tolPxCanvas / (vp.scale || 1);

    // 1) Notas
    for (let i = 0; i < dicomAnnotations.length; i++) {
      const a = dicomAnnotations[i];
      if (Math.hypot(ptImg.x - a.posImg.x, ptImg.y - a.posImg.y) <= tolDicom) {
        const ok = await swalConfirmDelete(`¿Borrar la nota "${a.text}"?`, {
          title: 'Eliminar nota'
        });
        if (ok) {
          dicomAnnotations.splice(i, 1);
          redrawDicomOverlay();
          swalDeletedToast('Nota eliminada');
        }
        return;
      }
    }

    // 2) Mediciones
    for (let i = 0; i < dicomMeasurements.length; i++) {
      const m = dicomMeasurements[i];
      if (isPointNearSegmentImg(ptImg, m.startImg, m.endImg, tolDicom)) {
        const ok = await swalConfirmDelete('¿Borrar esta medición?', {
          title: 'Eliminar medición'
        });
        if (ok) {
          dicomMeasurements.splice(i, 1);
          redrawDicomOverlay();
          swalDeletedToast('Medición eliminada');
        }
        return;
      }
    }

    // 3) Figuras
    for (let i = 0; i < dicomShapes.length; i++) {
      const s = dicomShapes[i];
      if (hitTestShapeImg(ptImg, s, tolDicom)) {
        const ok = await swalConfirmDelete(`¿Borrar esta ${s.type}?`, {
          title: 'Eliminar figura'
        });
        if (ok) {
          dicomShapes.splice(i, 1);
          redrawDicomOverlay();
          swalDeletedToast('Figura eliminada');
        }
        return;
      }
    }

    // 4) Ángulos (borrado tocando el vértice)
    for (let i = 0; i < dicomAngles.length; i++) {
      const a = dicomAngles[i];
      const c = a.center;
      if (Math.hypot(ptImg.x - c.x, ptImg.y - c.y) <= tolDicom) {
        const ok = await swalConfirmDelete(
          `¿Borrar este ángulo (${a.value.toFixed(1)}°)?`,
          { title: 'Eliminar ángulo' }
        );
        if (ok) {
          dicomAngles.splice(i, 1);
          redrawDicomOverlay();
          swalDeletedToast('Ángulo eliminado');
        }
        return;
      }
    }
  });

  // -----------------------------
  // RESIZE OBSERVER
  // -----------------------------
  const ro = new ResizeObserver(resizeDicomOverlay);
  ro.observe(dicomViewer);
}
// -------------------------------------------
// JPG/PNG OVERLAY + PAN + MEDICIONES + FIGURAS + NOTAS
// -------------------------------------------
function ensureRasterWrapper() {
  if (!imagen || isDicom) return;
  if (!rasterWrapper) {
    rasterWrapper = document.createElement("div");
    rasterWrapper.style.position = "relative";
    rasterWrapper.style.display = "inline-block";
    rasterWrapper.style.transformOrigin = "center center";
    imagen.parentNode.insertBefore(rasterWrapper, imagen);
    rasterWrapper.appendChild(imagen);

    measureOverlay = document.createElement("canvas");
    measureOverlay.style.position = "absolute";
    measureOverlay.style.top = "0";
    measureOverlay.style.left = "0";
    measureOverlay.style.pointerEvents = "auto"; // overlay captura eventos
    rasterWrapper.appendChild(measureOverlay);

    const ro = new ResizeObserver(syncOverlaySize);
    ro.observe(imagen);
    window.addEventListener("resize", syncOverlaySize);
    syncOverlaySize();

    wireRasterMouseEvents();
  }
}

function syncOverlaySize() {
  if (!imagen || !measureOverlay) return;
  measureOverlay.width  = imagen.clientWidth;
  measureOverlay.height = imagen.clientHeight;
  const ctx = measureOverlay.getContext("2d");
  redrawRasterOverlay(ctx);
}

function actualizarTransformaciones() {
  if (rasterWrapper && !isDicom) {
    rasterWrapper.style.transform =
      `translate(${offsetX}px, ${offsetY}px) scale(${zoomLevel}) rotate(${rotation}deg)`;
    imagen.style.filter = currentFilter;
  }
}

function applyRasterCssFilter() {
  // componentes base: brillo y contraste siempre aplicados
  const parts = [];

  // modo de color
  if (rasterFilterMode === "grayscale") {
    parts.push("grayscale(100%)");
  } else if (rasterFilterMode === "sepia") {
    parts.push("sepia(100%)");
  } else if (rasterFilterMode === "invert") {
    parts.push("invert(100%)");
  }

  // brillo y contraste ajustables
  parts.push(`brightness(${brightnessFactor})`);
  parts.push(`contrast(${contrastFactor})`);

  currentFilter = parts.join(" ");
  actualizarTransformaciones();
}

// --- Helpers Raster: pantalla <-> imagen
function rasterEventToImagePoint(e) {
  if (!rasterWrapper || !measureOverlay) return { x: 0, y: 0 };

  const rect = rasterWrapper.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  let dx = e.clientX - cx;
  let dy = e.clientY - cy;

  // deshacer translate (pan)
  dx -= offsetX;
  dy -= offsetY;

  // deshacer rotación
  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  // deshacer zoom
  const ux = rx / zoomLevel;
  const uy = ry / zoomLevel;

  // coords de canvas pre-transform
  const xCanvas = ux + measureOverlay.width  / 2;
  const yCanvas = uy + measureOverlay.height / 2;

  // pasar a coords de IMAGEN original
  const xImg = xCanvas / measureOverlay.width  * imagen.naturalWidth;
  const yImg = yCanvas / measureOverlay.height * imagen.naturalHeight;

  return { x: xImg, y: yImg };
}

function rasterImageToCanvas(ptImg) {
  const preX = ptImg.x / imagen.naturalWidth  * measureOverlay.width;
  const preY = ptImg.y / imagen.naturalHeight * measureOverlay.height;
  return { x: preX, y: preY };
}

// --- Dibujo persistente (mediciones + figuras + notas) en Raster
function redrawRasterOverlay(ctx) {
  if (!measureOverlay) return;
  ctx.clearRect(0, 0, measureOverlay.width, measureOverlay.height);
  ctx.lineWidth = 2;
  ctx.font = "16px Arial";

  // Mediciones
  measurements.forEach(m => {
    const s = rasterImageToCanvas(m.startImg);
    const e = rasterImageToCanvas(m.endImg);
    ctx.strokeStyle = "yellow";
    ctx.fillStyle   = "yellow";
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(e.x, e.y); ctx.stroke();
    ctx.fillText(`${m.distMm.toFixed(1)} mm`, e.x + 10, e.y - 10);
  });

  // Figuras
  rasterShapes.forEach(s => {
    const sp = rasterImageToCanvas(s.startImg);
    const ep = rasterImageToCanvas(s.endImg);
    if (s.type === "rect") {
      ctx.strokeStyle = "magenta";
      ctx.strokeRect(sp.x, sp.y, ep.x - sp.x, ep.y - sp.y);
    } else if (s.type === "circle") {
      ctx.strokeStyle = "blue";
      const r = Math.hypot(ep.x - sp.x, ep.y - sp.y);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
    }
  });

  // Ángulos
  angles.forEach(a => {
    const c  = rasterImageToCanvas(a.center);
    const p1 = rasterImageToCanvas(a.p1);
    const p2 = rasterImageToCanvas(a.p2);

    ctx.strokeStyle = "cyan";
    ctx.fillStyle = "cyan";

    [c, p1, p2].forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

    ctx.fillText(`${a.value.toFixed(1)}°`, c.x + 10, c.y - 10);
  });

  // Notas
  ctx.fillStyle = "red";
  rasterAnnotations.forEach(a => {
    const p = rasterImageToCanvas(a.posImg);
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(a.text, p.x + 8, p.y - 8);
  });
}

// --- Eventos raster (pan con wrapper; dibujo/preview en overlay)
function wireRasterMouseEvents() {
  // PAN (sobre wrapper)
  rasterWrapper?.addEventListener("mousedown", (e) => {
    if (activeTool !== "pan" || e.button !== 0) return;
    isDragging = true;
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    setCursor(rasterWrapper, "grabbing");
  });

  window.addEventListener("mousemove", (e) => {
    if (activeTool !== "pan" || !isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    actualizarTransformaciones();
  });

  window.addEventListener("mouseup", () => {
    if (activeTool !== "pan") return;
    isDragging = false;
    setCursor(rasterWrapper, "grab");
  });

  // CLICK IZQ (medición / figura / nota / ángulo)
  measureOverlay?.addEventListener("click", async (e) => {
    const ctx = measureOverlay.getContext("2d");

    // Medición
    if (activeTool === "measure") {
      const ptImg = rasterEventToImagePoint(e);
      if (!measureStartImg) {
        measureStartImg = ptImg; drawingMeasure = true;
        redrawRasterOverlay(ctx);
        const s = rasterImageToCanvas(ptImg);
        ctx.fillStyle = "limegreen";
        ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
      } else {
        const s = rasterImageToCanvas(measureStartImg);
        const p = rasterImageToCanvas(ptImg);
        const distPx = Math.hypot(p.x - s.x, p.y - s.y);
        const distMm = distPx * PIXEL_TO_MM;
        measurements.push({ startImg: measureStartImg, endImg: ptImg, distMm });
        measureStartImg = null; drawingMeasure = false;
        redrawRasterOverlay(ctx);
      }
      return;
    }

    // Figuras
    if (activeTool === "rect" || activeTool === "circle") {
      const ptImg = rasterEventToImagePoint(e);
      if (!shapeStartImg) {
        shapeStartImg = ptImg;
        const s = rasterImageToCanvas(ptImg);
        redrawRasterOverlay(ctx);
        ctx.fillStyle = "limegreen"; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        rasterShapes.push({ type: activeTool, startImg: shapeStartImg, endImg: ptImg });
        shapeStartImg = null;
        redrawRasterOverlay(ctx);
      }
      return;
    }

    // Ángulo (3 clics: primer extremo, vértice, segundo extremo)
    if (activeTool === "angle") {
      const ptImg = rasterEventToImagePoint(e);
      anglePoints.push(ptImg);

      if (anglePoints.length === 3) {
        const [p1, center, p2] = anglePoints;
        const ang = calcAngle(p1, center, p2);
        angles.push({ center, p1, p2, value: ang });
        anglePoints = [];
        redrawRasterOverlay(ctx);
      } else {
        // sólo pintar puntos temporales
        redrawRasterOverlay(ctx);
        const pCanvas = rasterImageToCanvas(ptImg);
        ctx.fillStyle = anglePoints.length === 1 ? "limegreen" : "orange";
        ctx.beginPath(); ctx.arc(pCanvas.x, pCanvas.y, 5, 0, Math.PI * 2); ctx.fill();
      }
      return;
    }

    // Notas
    if (activeTool === "annotate") {
      const ptImg = rasterEventToImagePoint(e);
      let text = null;

      if (haveSwal()) {
        const { value } = await Swal.fire({
          title: 'Agregar nota',
          input: 'textarea',
          inputLabel: 'Escribe tu nota',
          inputPlaceholder: 'Escribe aquí tu nota…',
          inputAttributes: {
            'aria-label': 'Escribe tu nota'
          },
          showCancelButton: true,
          confirmButtonText: 'Guardar',
          cancelButtonText: 'Cancelar'
        });
        text = value;
      } else {
        text = prompt('📝 Escribe tu nota:');
      }

      text = (text || '').trim();
      if (text) {
        rasterAnnotations.push({ posImg: ptImg, text });
        redrawRasterOverlay(ctx);

        // Toast bonito con la nota
        if (haveSwal()) {
          Swal.fire({
            icon: 'success',
            title: 'Nota agregada',
            text: text,
            timer: 1400,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        } else {
          console.log('Nota raster agregada:', text);
        }
      }
      return;
    }


  });

  // MOUSEMOVE (previews)
  measureOverlay?.addEventListener("mousemove", (e) => {
    const ctx = measureOverlay.getContext("2d");

    // Preview medición
    if (activeTool === "measure" && drawingMeasure && measureStartImg) {
      const ptImg = rasterEventToImagePoint(e);
      const s = rasterImageToCanvas(measureStartImg);
      const p = rasterImageToCanvas(ptImg);
      redrawRasterOverlay(ctx);
      ctx.strokeStyle = "limegreen"; ctx.fillStyle = "limegreen"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      return;
    }

    // Preview figura
    if ((activeTool === "rect" || activeTool === "circle") && shapeStartImg) {
      const ptImg = rasterEventToImagePoint(e);
      const sp = rasterImageToCanvas(shapeStartImg);
      const ep = rasterImageToCanvas(ptImg);
      redrawRasterOverlay(ctx);
      ctx.strokeStyle = "limegreen"; ctx.lineWidth = 2;
      if (activeTool === "rect") {
        ctx.strokeRect(sp.x, sp.y, ep.x - sp.x, ep.y - sp.y);
      } else {
        const r = Math.hypot(ep.x - sp.x, ep.y - sp.y);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, r, 0, Math.PI * 2); ctx.stroke();
      }
      return;
    }

    // Preview de ángulo
    if (activeTool === "angle" && anglePoints.length > 0) {
      const tempPt = rasterEventToImagePoint(e);
      redrawRasterOverlay(ctx);

      if (anglePoints.length === 1) {
        const p1 = rasterImageToCanvas(anglePoints[0]);
        const pTemp = rasterImageToCanvas(tempPt);
        ctx.strokeStyle = "limegreen";
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(pTemp.x, pTemp.y); ctx.stroke();
      } else if (anglePoints.length === 2) {
        const p1 = rasterImageToCanvas(anglePoints[0]);
        const c  = rasterImageToCanvas(anglePoints[1]);
        const pTemp = rasterImageToCanvas(tempPt);

        ctx.strokeStyle = "limegreen";
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(pTemp.x, pTemp.y); ctx.stroke();
      }
      return;
    }
  });

  // CLIC DERECHO RASTER (borrado con SweetAlert)
  measureOverlay?.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    const ctx = measureOverlay.getContext("2d");
    const ptImg = rasterEventToImagePoint(e);

    const tolPx = 10;
    const tolImg = Math.max(
      tolPx / measureOverlay.width  * imagen.naturalWidth,
      tolPx / measureOverlay.height * imagen.naturalHeight
    );

    // 1) Notas
    for (let i = 0; i < rasterAnnotations.length; i++) {
      const a = rasterAnnotations[i];
      if (Math.hypot(ptImg.x - a.posImg.x, ptImg.y - a.posImg.y) <= tolImg) {
        const ok = await swalConfirmDelete(`¿Borrar la nota "${a.text}"?`, {
          title: 'Eliminar nota'
        });
        if (ok) {
          rasterAnnotations.splice(i, 1);
          redrawRasterOverlay(ctx);
          swalDeletedToast('Nota eliminada');
        }
        return;
      }
    }

    // 2) Mediciones
    for (let i = 0; i < measurements.length; i++) {
      const m = measurements[i];
      if (isPointNearSegmentImg(ptImg, m.startImg, m.endImg, tolImg)) {
        const ok = await swalConfirmDelete('¿Borrar esta medición?', {
          title: 'Eliminar medición'
        });
        if (ok) {
          measurements.splice(i, 1);
          redrawRasterOverlay(ctx);
          swalDeletedToast('Medición eliminada');
        }
        return;
      }
    }

    // 3) Figuras
    for (let i = 0; i < rasterShapes.length; i++) {
      const s = rasterShapes[i];
      if (hitTestShapeImg(ptImg, s, tolImg)) {
        const ok = await swalConfirmDelete(`¿Borrar esta ${s.type}?`, {
          title: 'Eliminar figura'
        });
        if (ok) {
          rasterShapes.splice(i, 1);
          redrawRasterOverlay(ctx);
          swalDeletedToast('Figura eliminada');
        }
        return;
      }
    }

    // 4) Ángulos (tocando el vértice)
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      const c = a.center;
      if (Math.hypot(ptImg.x - c.x, ptImg.y - c.y) <= tolImg) {
        const ok = await swalConfirmDelete(
          `¿Borrar este ángulo (${a.value.toFixed(1)}°)?`,
          { title: 'Eliminar ángulo' }
        );
        if (ok) {
          angles.splice(i, 1);
          redrawRasterOverlay(ctx);
          swalDeletedToast('Ángulo eliminado');
        }
        return;
      }
    }
  });
}

// -------------------------------------------
// HIT-TEST helpers (coords de imagen)
// -------------------------------------------
function isPointNearSegmentImg(p, a, b, tol) {
  const A = p.x - a.x, B = p.y - a.y;
  const C = b.x - a.x, D = b.y - a.y;
  const lenSq = C*C + D*D;
  let t = 0;
  if (lenSq > 0) t = Math.max(0, Math.min(1, (A*C + B*D) / lenSq));
  const xx = a.x + t * C, yy = a.y + t * D;
  const dx = p.x - xx, dy = p.y - yy;
  return (dx*dx + dy*dy) <= tol*tol;
}

function hitTestShapeImg(p, s, tol) {
  if (s.type === "rect") {
    const x1 = s.startImg.x, y1 = s.startImg.y;
    const x2 = s.endImg.x,   y2 = s.endImg.y;
    const pA = { x: x1, y: y1 }, pB = { x: x2, y: y1 },
          pC = { x: x2, y: y2 }, pD = { x: x1, y: y2 };
    return (
      isPointNearSegmentImg(p, pA, pB, tol) ||
      isPointNearSegmentImg(p, pB, pC, tol) ||
      isPointNearSegmentImg(p, pC, pD, tol) ||
      isPointNearSegmentImg(p, pD, pA, tol)
    );
  } else if (s.type === "circle") {
    const r = Math.hypot(s.endImg.x - s.startImg.x, s.endImg.y - s.startImg.y);
    const d = Math.hypot(p.x - s.startImg.x, p.y - s.startImg.y);
    return Math.abs(d - r) <= tol;
  }
  return false;
}

// -------------------------------------------
// ANGLE helper (para raster y DICOM)
// -------------------------------------------
function calcAngle(p1, c, p2) {
  const v1 = { x: p1.x - c.x, y: p1.y - c.y };
  const v2 = { x: p2.x - c.x, y: p2.y - c.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  return (Math.acos(dot / (m1 * m2)) * 180) / Math.PI;
}

// -------------------------------------------
// BOTONES UI / HERRAMIENTAS
// -------------------------------------------
const btnZoomIn  = document.getElementById("zoomIn");
const btnZoomOut = document.getElementById("zoomOut");
const btnRotate  = document.getElementById("rotate");
const btnReset   = document.getElementById("reset");
const btnMeasure = document.getElementById("measure");
const btnPan     = document.getElementById("pan");
const btnAnnotate= document.getElementById("annotate");
const btnRect    = document.getElementById("shapeRect");
const btnCircle  = document.getElementById("shapeCircle");
const btnAngle   = document.getElementById("angle");

function setActiveTool(tool) {
  activeTool = tool;

  if (isDicom) {
    if (tool === "measure" || tool === "annotate" || tool === "rect" || tool === "circle" || tool === "angle") {
      setCursor(dicomViewer, "crosshair");
    } else if (tool === "pan") {
      setCursor(dicomViewer, "grab");
    } else {
      setCursor(dicomViewer, "default");
    }
  } else if (rasterWrapper) {
    const el = measureOverlay || rasterWrapper;
    if (tool === "measure" || tool === "annotate" || tool === "rect" || tool === "circle" || tool === "angle") {
      setCursor(el, "crosshair");
    } else if (tool === "pan") {
      setCursor(rasterWrapper, "grab");
    } else {
      setCursor(el, "default");
    }
  }
}

btnAngle?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("angle"); });
btnZoomIn?.addEventListener("click", () => {
  if (isDicom) {
    const vp = cornerstone.getViewport(dicomViewer);
    vp.scale = Math.min(10, vp.scale * 1.1);
    cornerstone.setViewport(dicomViewer, vp);
  } else {
    zoomLevel += 0.1;
    actualizarTransformaciones();
  }
});
btnZoomOut?.addEventListener("click", () => {
  if (isDicom) {
    const vp = cornerstone.getViewport(dicomViewer);
    vp.scale = Math.max(0.1, vp.scale * 0.9);
    cornerstone.setViewport(dicomViewer, vp);
  } else {
    zoomLevel = Math.max(0.1, zoomLevel - 0.1);
    actualizarTransformaciones();
  }
});
btnRotate?.addEventListener("click", () => {
  if (isDicom) {
    const vp = cornerstone.getViewport(dicomViewer);
    vp.rotation = ((vp.rotation||0) + 90) % 360;
    cornerstone.setViewport(dicomViewer, vp);
  } else {
    rotation = (rotation + 90) % 360;
    actualizarTransformaciones();
  }
});
btnReset?.addEventListener("click", () => {
  setActiveTool("none");
  if (isDicom && dicomBaseViewport) {
    cornerstone.setViewport(dicomViewer, deepClone(dicomBaseViewport));
    dicomMeasurements = []; dicomMeasureStartImg=null; dicomPreviewImg=null;
    dicomShapes = []; dicomShapeStartImg=null; dicomShapePreviewImg=null;
    dicomAnnotations = [];
    dicomAngles = []; dicomAnglePoints = []; dicomAnglePreview = null;
    redrawDicomOverlay();
  } else {
    zoomLevel=1; rotation=0; offsetX=0; offsetY=0; currentFilter="none";
    measurements=[]; rasterAnnotations=[]; rasterShapes=[];
    angles = []; anglePoints = [];
    measureStartImg=null; drawingMeasure=false; shapeStartImg=null;
    rasterFilterMode = "none";
    brightnessFactor = 1;
    contrastFactor   = 1;
    applyRasterCssFilter();
    if (measureOverlay) {
      const ctx = measureOverlay.getContext("2d");
      ctx.clearRect(0,0,measureOverlay.width,measureOverlay.height);
    }
  }
});
btnMeasure?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("measure"); });
btnPan?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("pan"); });
btnAnnotate?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("annotate"); });
btnRect?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("rect"); });
btnCircle?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("circle"); });

// -------------------------------------------
// FILTROS (botones)
// -------------------------------------------
function setFilter(filtro) {
  // Mostrar/ocultar sliders según filtro (definido al final)
  if (filtro === "brightness" || filtro === "contrast") {
    toggleFilterControls(filtro);
  } else {
    toggleFilterControls(null); // oculta sliders al cambiar de filtro
  }

  if (isDicom) {
    // ------- DICOM: viewport (windowCenter / windowWidth / invert) -------
    const currentVp = cornerstone.getViewport(dicomViewer);
    let vp = {
      ...deepClone(dicomBaseViewport),
      scale: currentVp.scale,
      translation: { ...currentVp.translation },
      rotation: currentVp.rotation,
      invert: currentVp.invert || false,
      voi: deepClone(currentVp.voi || {})
    };

    switch (filtro) {
      case "invert":
        vp.invert = !currentVp.invert;
        break;
      case "contrast":
        // preset ligero, luego el slider ajusta fino
        vp.voi.windowWidth = Math.max(1, (vp.voi.windowWidth || 400) * 0.7);
        break;
      case "brightness":
        vp.voi.windowCenter = (vp.voi.windowCenter || 40) + 30;
        break;
      case "none":
      case "grayscale":
      case "sepia":
      default:
        // volvemos a base sin cambios especiales
        vp = {
          ...deepClone(dicomBaseViewport),
          scale: currentVp.scale,
          translation: { ...currentVp.translation },
          rotation: currentVp.rotation,
          invert: false,
          voi: deepClone(dicomBaseViewport.voi || {})
        };
        break;
    }
    cornerstone.setViewport(dicomViewer, vp);
  } else {
    // ------- JPG/PNG: CSS filters + sliders -------
    switch (filtro) {
      case "none":
        rasterFilterMode = "none";
        brightnessFactor = 1;
        contrastFactor   = 1;
        if (brightnessSlider) brightnessSlider.value = 100;
        if (contrastSlider)   contrastSlider.value   = 100;
        break;
      case "grayscale":
        rasterFilterMode = "grayscale";
        break;
      case "sepia":
        rasterFilterMode = "sepia";
        break;
      case "invert":
        rasterFilterMode = "invert";
        break;
      case "contrast":
        if (contrastSlider) contrastSlider.value = 150;
        contrastFactor = 1.5;
        break;
      case "brightness":
        if (brightnessSlider) brightnessSlider.value = 150;
        brightnessFactor = 1.5;
        break;
    }
    applyRasterCssFilter();
  }
}

function goBack() {
  window.history.back();
}

window.setFilter = setFilter;

// =======================================
//  MODO 3D: STACK DICOM (varios cortes)
// =======================================
function normalizePathForViewer(p) {
  if (!p) return null;
  const s = String(p);

  // Ya viene bien
  if (s.startsWith('/visualizador/uploads/')) return s;
  if (s.startsWith('/visualizador/')) return s;

  // /uploads/archivo → /visualizador/uploads/archivo
  if (s.startsWith('/uploads/')) return '/visualizador' + s;

  // Ruta absoluta cualquiera
  if (s.startsWith('/')) return s;

  // Sólo nombre → asumimos /visualizador/uploads/nombre
  return '/visualizador/uploads/' + s;
}

// 🔹 AHORA ES ASÍNCRONA Y SOPORTA:
//   - ?files=...
//   - ?group=... → /visualizador/api/group/<group>/files
async function buildStackFromQuery() {
  const params = new URLSearchParams(window.location.search);
  let paths = [];

  const filesParam = params.get('files');

  if (filesParam) {
    // Igual que en la rejilla: puede venir CSV o JSON
    const trimmed = filesParam.trim();
    try {
      if (trimmed.startsWith('[') || trimmed.startsWith('%5B')) {
        const jsonStr = decodeURIComponent(trimmed);
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed)) {
          if (parsed.length && typeof parsed[0] === 'object') {
            paths = parsed
              .map(item =>
                item.storage_path ||
                item.path ||
                item.file ||
                item.url ||
                null
              )
              .filter(Boolean);
          } else {
            paths = parsed.map(String).filter(Boolean);
          }
        }
      } else {
        const decoded = decodeURIComponent(filesParam);
        paths = decoded
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }
    } catch (e) {
      console.error('❌ Error parseando ?files= para 3D:', e);
    }
  }

  // Si NO hay ?files=, intentamos con ?group= (igual que la rejilla)
  if (!paths.length) {
    const groupId = params.get('group') || params.get('group_id');
    if (groupId) {
      const url = `/visualizador/api/group/${encodeURIComponent(groupId)}/files`;

      try {
        const token = localStorage.getItem('token');
        const resp = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!resp.ok) {
          console.error('❌ Error HTTP en /api/group/... para 3D:', resp.status);
        } else {
          const data = await resp.json();
          if (data && Array.isArray(data.files)) {
            paths = data.files
              .map(f => f.storage_path || f.path || f.file || null)
              .filter(Boolean);
          }
        }
      } catch (e) {
        console.error('❌ Error haciendo fetch a /api/group/... para 3D:', e);
      }
    }
  }

  console.log('DEBUG 3D - paths crudos para stack:', paths);

  // Normalizamos las rutas y filtramos solo DICOM
  paths = paths
    .map(normalizePathForViewer)
    .filter(Boolean);

  const dicomPaths = paths.filter(p => p.toLowerCase().endsWith('.dcm'));
  const imageIds = dicomPaths.map(p => 'wadouri:' + window.location.origin + p);

  console.log('DEBUG 3D - imageIds DICOM para stack:', imageIds);
  return imageIds;
}

function loadDicomSlice(index) {
  if (!dicomViewer || !dicomStack.imageIds.length) return;
  if (index < 0 || index >= dicomStack.imageIds.length) return;

  const imageId = dicomStack.imageIds[index];
  dicomStack.currentIndex = index;

  cornerstone.loadImage(imageId).then(image => {
    cornerstone.displayImage(dicomViewer, image);

    // guardamos viewport base una sola vez
    if (!dicomBaseViewport) {
      dicomBaseViewport = deepClone(cornerstone.getViewport(dicomViewer));
    }
    redrawDicomOverlay();

    const seriesInfo = document.getElementById('seriesInfo');
    if (seriesInfo) {
      const nombre = (imageId.split('/').pop() || '').replace(/^wadouri:/, '');
      seriesInfo.textContent = `${index + 1} / ${dicomStack.imageIds.length} — ${nombre}`;
    }
  }).catch(err => {
    console.error('❌ Error cargando slice DICOM 3D:', err);
  });
}

function onDicomStackScroll(e) {
  if (!dicomStack.imageIds.length) return;
  e.preventDefault();

  const delta = e.deltaY || e.wheelDelta || 0;
  let nextIndex = dicomStack.currentIndex;

  if (delta > 0) {
    nextIndex = Math.min(dicomStack.imageIds.length - 1, dicomStack.currentIndex + 1);
  } else if (delta < 0) {
    nextIndex = Math.max(0, dicomStack.currentIndex - 1);
  }

  if (nextIndex !== dicomStack.currentIndex) {
    loadDicomSlice(nextIndex);
  }
}

// 🔹 AHORA ES ASÍNCRONA
async function init3DStackFromFiles() {
  // Contenedor: usamos dicomViewer si existe, si no, seriesViewer
  let container = document.getElementById('dicomViewer');
  if (!container) {
    container = document.getElementById('seriesViewer');
  }
  if (!container) {
    console.warn('⚠️ No hay contenedor para modo 3D (dicomViewer ni seriesViewer)');
    return;
  }

  dicomViewer = container;
  dicomViewer.style.display   = 'block';
  dicomViewer.style.minHeight = '480px';
  dicomViewer.style.background = '#000';
  dicomViewer.style.position = 'relative';
  dicomViewer.style.touchAction = 'none';

  if (window.cornerstoneWADOImageLoader) {
    cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
    cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    try {
      cornerstoneWADOImageLoader.webWorkerManager.initialize({
        webWorkerPath: "/visualizador/static/libs/cornerstoneWADOImageLoaderWebWorker.js",
        taskConfiguration: {
          decodeTask: {
            codecsPath: "/visualizador/static/libs/cornerstoneWADOImageLoaderCodecs.js"
          }
        }
      });
    } catch (e) {
      console.warn("⚠️ WebWorker opcional no inicializado en 3D");
    }
  }

  try {
    cornerstone.enable(dicomViewer);
  } catch (e) {
    console.error('❌ cornerstone.enable falló en 3D:', e);
    return;
  }

  // ⬇️ AQUÍ LA CLAVE: aceptamos ?files= o ?group=
  const imageIds = await buildStackFromQuery();
  if (!imageIds.length) {
    console.warn('⚠️ No se encontraron DICOM válidos ni en ?files= ni en ?group= para 3D');
    return;
  }

  dicomStack.imageIds = imageIds;
  dicomStack.currentIndex = 0;
  isDicom = true;

  ensureDicomOverlay();
  wireDicomMouseEvents();
  loadDicomSlice(0);

  dicomViewer.addEventListener('wheel', onDicomStackScroll, { passive: false });

  console.log('✅ Modo 3D inicializado con', imageIds.length, 'slices');
}



// ======================
//  REJILLA + CARRUSEL
// ======================
(async function () {
  // Si estamos en modo 3D, no armamos rejilla/carrusel
  if (viewerMode === '3d') return;

  let files = [];

  // =========================
  // 1) multi-files-data (HTML)
  // =========================
  const dataTag = document.getElementById('multi-files-data');
  if (dataTag) {
    try {
      const raw = (dataTag.textContent || '').trim();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Puede venir como ["ruta1","ruta2"] o como [{storage_path:"..."}, ...]
          if (parsed.length && typeof parsed[0] === 'object') {
            files = parsed
              .map(item =>
                item.storage_path ||
                item.path ||
                item.file ||
                item.url ||
                null
              )
              .filter(Boolean);
          } else {
            files = parsed.map(String).filter(Boolean);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error parseando multi-files-data:', err);
    }
  }

  // =========================
  // 2) ?files= en la URL
  // =========================
  if (!files.length) {
    try {
      const params = new URLSearchParams(window.location.search);
      const filesParam = params.get('files');
      if (filesParam) {
        const trimmed = filesParam.trim();

        // Puede venir como JSON encodeado o CSV plano
        if (trimmed.startsWith('[') || trimmed.startsWith('%5B')) {
          const jsonStr = decodeURIComponent(trimmed);
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed)) {
            if (parsed.length && typeof parsed[0] === 'object') {
              files = parsed
                .map(item =>
                  item.storage_path ||
                  item.path ||
                  item.file ||
                  item.url ||
                  null
                )
                .filter(Boolean);
            } else {
              files = parsed.map(String).filter(Boolean);
            }
          }
        } else {
          const decoded = decodeURIComponent(filesParam);
          files = decoded
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        }
      }
    } catch (err) {
      console.error('❌ Error leyendo ?files= de la URL:', err);
    }
  }

// =========================
// 3) ?group=  → API Flask
// =========================
if (!files.length) {
  try {
    const params = new URLSearchParams(window.location.search);
    const groupId = params.get('group') || params.get('group_id');

    if (groupId) {
      const token = localStorage.getItem('token');

      const url = `/visualizador/api/group/${encodeURIComponent(groupId)}/files`
                + (token ? `?token=${encodeURIComponent(token)}` : '');

      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json'
        }
      });


      if (!res.ok) {
        console.error('❌ Error HTTP en /api/group/...:', res.status, url);
      } else {
        const data = await res.json();
        if (data && Array.isArray(data.files)) {
          files = data.files
            .map(f => f.storage_path || f.path || f.file || null)
            .filter(Boolean);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error haciendo fetch a /api/group/...:', err);
  }
}


  console.log('DEBUG REJILLA - files encontrados:', files);

  // Si seguimos sin archivos, no mostramos nada
  if (!Array.isArray(files) || files.length === 0) return;

  // =========================
  //  A partir de aquí es igual: rejilla + carrusel
  // =========================
  const pageSize = 9;
  let page = 0;

  const grid        = document.getElementById('multiGrid');
  const prev        = document.getElementById('prevPage');
  const next        = document.getElementById('nextPage');
  const info        = document.getElementById('pageInfo');

  const viewer      = document.getElementById('seriesViewer');
  const btnPrevSer  = document.getElementById('btnSeriesPrev');
  const btnPlay     = document.getElementById('btnSeriesPlay');
  const btnStop     = document.getElementById('btnSeriesPause');
  const btnNextSer  = document.getElementById('btnSeriesNext');
  const speedSelect = document.getElementById('seriesSpeed');
  const seriesInfo  = document.getElementById('seriesInfo');

  let currentIndex = 0;
  let timerId      = null;
  let intervalMs   = 600;

  // Estado inicial del visor de serie: OCULTO
  if (viewer) viewer.style.display = 'none';
  if (btnStop) btnStop.disabled = true;

  // Normaliza la ruta que viene del backend (nombre, /uploads/..., /visualizador/uploads/...)
  function resolvePath(entry) {
    if (!entry) return null;
    const s = String(entry);

    if (s.startsWith('/visualizador/uploads/')) return s;
    if (s.startsWith('/visualizador/')) return s;
    if (s.startsWith('/uploads/')) return '/visualizador' + s;
    if (s.startsWith('/')) return s;

    // Sólo nombre → asumimos /visualizador/uploads/nombre
    return '/visualizador/uploads/' + s;
  }

  function getDisplayName(entry) {
    const full = resolvePath(entry) || entry;
    const parts = String(full).split('/');
    return parts[parts.length - 1] || full;
  }

  // ================= REJILLA =================
  function initDicomThumbs() {
    if (typeof cornerstone === 'undefined' || typeof cornerstoneWADOImageLoader === 'undefined') return;

    try {
      cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
      cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
      try {
        cornerstoneWADOImageLoader.webWorkerManager.initialize({
          webWorkerPath: '/visualizador/static/libs/cornerstoneWADOImageLoaderWebWorker.js',
          taskConfiguration: {
            decodeTask: {
              codecsPath: '/visualizador/static/libs/cornerstoneWADOImageLoaderCodecs.js'
            }
          }
        });
      } catch (_) {}
    } catch (e) {
      console.warn('No se pudo configurar WADOImageLoader para miniaturas:', e);
    }

    const thumbs = document.querySelectorAll('.dicom-thumb');
    thumbs.forEach(div => {
      if (div.dataset.loaded === '1') return;

      const ruta    = div.dataset.file;
      const imageId = 'wadouri:' + window.location.origin + ruta;

      try {
        cornerstone.enable(div);
        cornerstone.loadImage(imageId).then(image => {
          cornerstone.displayImage(div, image);
          div.dataset.loaded = '1';
        }).catch(err => console.error('Error cargando miniatura DICOM:', err));
      } catch (e) {
        console.error('Error inicializando mini DICOM:', e);
      }
    });
  }

  function renderPage() {
    if (!grid) return;
    grid.innerHTML = '';

    const totalPages = Math.ceil(files.length / pageSize);
    const start      = page * pageSize;
    const slice      = files.slice(start, start + pageSize);

    slice.forEach(entry => {
      const cell = document.createElement('div');
      cell.className = 'grid-cell';

      const fullPath    = resolvePath(entry);
      const displayName = getDisplayName(entry);

      const link = document.createElement('a');
      link.href  = '/visualizador?file=' + encodeURIComponent(fullPath);
      link.className = 'grid-link';

      if (displayName.toLowerCase().endsWith('.dcm')) {
        const thumb = document.createElement('div');
        thumb.className    = 'dicom-thumb';
        thumb.dataset.file = fullPath;

        link.appendChild(thumb);
        cell.appendChild(link);

        const label = document.createElement('div');
        label.className = 'dicom-label';
        label.textContent = 'DICOM: ' + displayName;
        cell.appendChild(label);
      } else {
        const img = document.createElement('img');
        img.src   = fullPath;
        img.alt   = displayName;

        link.appendChild(img);
        cell.appendChild(link);
      }
      grid.appendChild(cell);
    });

    initDicomThumbs();

    if (info) {
      info.textContent = `Página ${page + 1} de ${totalPages}`;
    }
    if (prev) prev.disabled = (page === 0);
    if (next) next.disabled = (page >= totalPages - 1);
  }

  if (prev) {
    prev.addEventListener('click', () => {
      if (page > 0) {
        page--;
        renderPage();
      }
    });
  }

  if (next) {
    next.addEventListener('click', () => {
      const totalPages = Math.ceil(files.length / pageSize);
      if (page < totalPages - 1) {
        page++;
        renderPage();
      }
    });
  }

  renderPage();

  // ================= CARRUSEL =================
  function renderSeriesFrame(idx) {
    if (!viewer) return;
    const entry = files[idx];
    if (!entry) return;

    viewer.innerHTML = '';

    const fullPath    = resolvePath(entry);
    const displayName = getDisplayName(entry);

    if (displayName.toLowerCase().endsWith('.dcm')) {
      const div = document.createElement('div');
      div.style.width  = '100%';
      div.style.height = '100%';
      viewer.appendChild(div);

      try {
        const imageId = 'wadouri:' + window.location.origin + fullPath;
        cornerstone.enable(div);
        cornerstone.loadImage(imageId).then(image => {
          cornerstone.displayImage(div, image);
        }).catch(err => console.error('Error cargando DICOM en serie:', err));
      } catch (e) {
        console.error('Error inicializando DICOM serie:', e);
      }
    } else {
      const img = document.createElement('img');
      img.src   = fullPath;
      img.alt   = displayName;
      viewer.appendChild(img);
    }

    if (seriesInfo) {
      seriesInfo.textContent = `${idx + 1} / ${files.length} — ${displayName}`;
    }
  }

  function applySpeed() {
    const v = speedSelect ? Number(speedSelect.value) : NaN;
    intervalMs = Number.isFinite(v) && v > 0 ? v : 600;
  }

  function startSeries(fromIndex) {
    if (!viewer) return;
    if (typeof fromIndex === 'number') currentIndex = fromIndex;

    applySpeed();
    if (timerId) clearInterval(timerId);

    document.body.classList.add('series-playing');
    viewer.style.display = 'flex';

    renderSeriesFrame(currentIndex);
    timerId = setInterval(() => {
      currentIndex = (currentIndex + 1) % files.length;
      renderSeriesFrame(currentIndex);
    }, intervalMs);

    if (btnPlay) {
      btnPlay.disabled = true;
      btnPlay.textContent = '▶️ Play';
    }
    if (btnStop) btnStop.disabled = false;
  }

  function stopSeries() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }

    if (viewer) viewer.style.display = 'none';
    document.body.classList.remove('series-playing');

    if (btnPlay) {
      btnPlay.disabled = false;
      btnPlay.textContent = '▶️ Play';
    }
    if (btnStop) btnStop.disabled = true;

    if (seriesInfo) seriesInfo.textContent = '';
  }

  if (btnPlay) {
    btnPlay.addEventListener('click', () => startSeries(currentIndex));
  }
  if (btnStop) {
    btnStop.addEventListener('click', () => stopSeries());
  }
  if (btnPrevSer) {
    btnPrevSer.addEventListener('click', () => {
      currentIndex = (currentIndex - 1 + files.length) % files.length;
      if (viewer) viewer.style.display = 'flex';
      document.body.classList.add('series-playing');
      renderSeriesFrame(currentIndex);
    });
  }
  if (btnNextSer) {
    btnNextSer.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % files.length;
      if (viewer) viewer.style.display = 'flex';
      document.body.classList.add('series-playing');
      renderSeriesFrame(currentIndex);
    });
  }
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      const wasPlaying = !!timerId;
      applySpeed();
      if (wasPlaying) {
        clearInterval(timerId);
        timerId = setInterval(() => {
          currentIndex = (currentIndex + 1) % files.length;
          renderSeriesFrame(currentIndex);
        }, intervalMs);
      }
    });
  }
})();



// ======================
// INPUT MULTIPLE (subida)
// ======================
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('imagenInput');
  const countEl = document.getElementById('fileCount');
  const listEl  = document.getElementById('fileList');

  if (!input || !countEl || !listEl) return;

  function formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    listEl.innerHTML = '';

    if (files.length === 0) {
      countEl.textContent = 'No hay archivos seleccionados.';
      return;
    }

    countEl.textContent = files.length === 1
      ? '1 archivo seleccionado.'
      : `${files.length} archivos seleccionados.`;

    files.forEach((f, idx) => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = `${idx + 1}. ${f.name}`;

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'text-muted small';
      sizeSpan.textContent = formatSize(f.size);

      li.appendChild(nameSpan);
      li.appendChild(sizeSpan);
      listEl.appendChild(li);
    });
  });
});

// ======================
// SLIDERS BRILLO / CONTRASTE
// ======================
const brightnessSlider = document.getElementById("brightnessSlider");
const contrastSlider   = document.getElementById("contrastSlider");
const filterBox        = document.getElementById("filterBox");
const brightnessGroup  = document.getElementById("brightnessGroup");
const contrastGroup    = document.getElementById("contrastGroup");

// Oculta todo de inicio
function hideAllFilterControls() {
  if (!filterBox) return;
  filterBox.classList.add("d-none");
  if (brightnessGroup) brightnessGroup.classList.add("d-none");
  if (contrastGroup)   contrastGroup.classList.add("d-none");
}
hideAllFilterControls();

// Muestra según el filtro
function toggleFilterControls(filter) {
  hideAllFilterControls();

  if (!filter || !filterBox) return;

  filterBox.classList.remove("d-none");

  if (filter === "brightness" && brightnessGroup) {
    brightnessGroup.classList.remove("d-none");
  }

  if (filter === "contrast" && contrastGroup) {
    contrastGroup.classList.remove("d-none");
  }
}

// Eventos sliders
if (brightnessSlider) {
  brightnessSlider.addEventListener("input", () => {
    const val = Number(brightnessSlider.value) || 100;

    if (isDicom) {
      // DICOM: mover windowCenter proporcional al slider
      const vp = cornerstone.getViewport(dicomViewer);
      const baseCenter = (dicomBaseViewport?.voi?.windowCenter) ?? vp.voi.windowCenter ?? 40;
      const delta = (val - 100) * 0.8; // desplazamiento aprox -80..+80
      vp.voi.windowCenter = baseCenter + delta;
      cornerstone.setViewport(dicomViewer, vp);
    } else {
      brightnessFactor = val / 100;
      applyRasterCssFilter();
    }
  });
}

if (contrastSlider) {
  contrastSlider.addEventListener("input", () => {
    const val = Number(contrastSlider.value) || 100;

    if (isDicom) {
      // DICOM: modificar windowWidth (contraste)
      const vp = cornerstone.getViewport(dicomViewer);
      const baseWidth = (dicomBaseViewport?.voi?.windowWidth) ?? vp.voi.windowWidth ?? 400;
      const factor = val / 100; // 0.5..1.5
      vp.voi.windowWidth = Math.max(1, baseWidth / factor);
      cornerstone.setViewport(dicomViewer, vp);
    } else {
      contrastFactor = val / 100;
      applyRasterCssFilter();
    }
  });
}
// ==========================
//  INICIALIZACIÓN GLOBAL
// ==========================
document.addEventListener('DOMContentLoaded', () => {
  if (viewerMode === '3d') {
    // Iniciamos el stack 3D con archivos de ?files= o ?group=
    (async () => {
      try {
        await init3DStackFromFiles();
      } catch (e) {
        console.error('❌ Error inicializando modo 3D:', e);
        if (haveSwal()) {
          Swal.fire('Error', 'No se pudo inicializar el modo 3D.', 'error');
        }
      }
    })();
  }
});