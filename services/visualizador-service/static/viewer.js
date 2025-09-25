// -------------------------------------------
// SELECTORES BASE
// -------------------------------------------
const imagen = document.getElementById("imagenVisualizada");
const dicomViewer = document.getElementById("dicomViewer");

// -------------------------------------------
// ESTADO COMÚN (JPG/PNG)
// -------------------------------------------
let zoomLevel = 1, rotation = 0, currentFilter = "none";
let offsetX = 0, offsetY = 0;
let isDragging = false, startX, startY;

let activeTool = "none"; // "none" | "measure" | "pan" | "annotate" | "rect" | "circle"

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
      // Línea p1 → cursor
      const p1 = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[0]);
      const pTemp = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePreview);

      dicomCtx.beginPath();
      dicomCtx.moveTo(p1.x, p1.y);
      dicomCtx.lineTo(pTemp.x, pTemp.y);
      dicomCtx.stroke();
    } 
    else if (dicomAnglePoints.length === 2) {
      // Fijo p1–c, dinámico c–cursor
      const p1 = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[0]);
      const c  = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[1]);
      const pTemp = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePreview);

      dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(p1.x, p1.y); dicomCtx.stroke();
      dicomCtx.beginPath(); dicomCtx.moveTo(c.x, c.y); dicomCtx.lineTo(pTemp.x, pTemp.y); dicomCtx.stroke();
    }
  }

  // Preview dinámico de ángulo
  if (activeTool === "angle" && dicomAnglePoints.length > 0 && dicomAnglePreview) {
    dicomCtx.strokeStyle = "limegreen";
    dicomCtx.lineWidth = 2;

    if (dicomAnglePoints.length === 1) {
      // línea p1 → cursor
      const p1 = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePoints[0]);
      const pTemp = cornerstone.pixelToCanvas(dicomViewer, dicomAnglePreview);
      dicomCtx.beginPath(); dicomCtx.moveTo(p1.x, p1.y); dicomCtx.lineTo(pTemp.x, pTemp.y); dicomCtx.stroke();
    } 
    else if (dicomAnglePoints.length === 2) {
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
  target.addEventListener("mousedown", (e) => {
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
      const text = prompt("📝 Escribe tu nota:");
      if (text) {
        dicomAnnotations.push({ posImg: imgPt, text });
        redrawDicomOverlay();
      }
    }
  });

  // -----------------------------
  // MOUSE MOVE (solo uno)
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
      dicomAnglePreview = getImagePointFromMouseEvent(e); // usar global
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
  // CLIC DERECHO (borrado)
  // -----------------------------
  target.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!isDicom) return;

    const ptImg = getImagePointFromMouseEvent(e);
    const tolPxCanvas = 10;
    const vp = cornerstone.getViewport(dicomViewer);
    const tolDicom = tolPxCanvas / (vp.scale || 1);

    // Notas
    for (let i = 0; i < dicomAnnotations.length; i++) {
      const a = dicomAnnotations[i];
      if (
        Math.hypot(ptImg.x - a.posImg.x, ptImg.y - a.posImg.y) <= tolDicom
      ) {
        if (confirm(`¿Borrar la nota "${a.text}"?`)) {
          dicomAnnotations.splice(i, 1);
          redrawDicomOverlay();
        }
        return;
      }
    }

    // Mediciones
    for (let i = 0; i < dicomMeasurements.length; i++) {
      const m = dicomMeasurements[i];
      if (isPointNearSegmentImg(ptImg, m.startImg, m.endImg, tolDicom)) {
        if (confirm("¿Borrar esta medición?")) {
          dicomMeasurements.splice(i, 1);
          redrawDicomOverlay();
        }
        return;
      }
    }

    // Figuras
    for (let i = 0; i < dicomShapes.length; i++) {
      const s = dicomShapes[i];
      if (hitTestShapeImg(ptImg, s, tolDicom)) {
        if (confirm(`¿Borrar esta ${s.type}?`)) {
          dicomShapes.splice(i, 1);
          redrawDicomOverlay();
        }
        return;
      }
    }

    // Ángulos (borrado tocando el vértice)
    for (let i = 0; i < dicomAngles.length; i++) {
      const a = dicomAngles[i];
      const c = a.center;
      if (Math.hypot(ptImg.x - c.x, ptImg.y - c.y) <= tolDicom) {
        if (confirm(`¿Borrar este ángulo (${a.value.toFixed(1)}°)?`)) {
          dicomAngles.splice(i, 1);
          redrawDicomOverlay();
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

// --- Helpers Raster: pantalla <-> imagen <-> canvas (usando DOMMatrix)
function rasterEventToImagePoint(e) {
  if (!rasterWrapper || !measureOverlay) return { x: 0, y: 0 };

  // Bounding box del wrapper en pantalla
  const rect = rasterWrapper.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top  + rect.height / 2;

  // Vector click → centro
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;

  // 1) Deshacer translate (pan)
  dx -= offsetX;
  dy -= offsetY;

  // 2) Deshacer rotación (ahora sí con signo contrario)
  const rad = (-rotation * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;

  // 3) Deshacer zoom (scale)
  const ux = rx / zoomLevel;
  const uy = ry / zoomLevel;

  // 4) Convertir a coords de canvas “pre-transform”
  const xCanvas = ux + measureOverlay.width  / 2;
  const yCanvas = uy + measureOverlay.height / 2;

  // 5) Pasar a coords de IMAGEN original
  const xImg = xCanvas / measureOverlay.width  * imagen.naturalWidth;
  const yImg = yCanvas / measureOverlay.height * imagen.naturalHeight;

  return { x: xImg, y: yImg };
}





function rasterImageToCanvas(ptImg) {
  // imagen -> canvas (pre-transform)
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
    ctx.strokeStyle = "magenta";
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
    const c = rasterImageToCanvas(a.center);
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

  // CLICK IZQ (medición / figura / nota)
  measureOverlay?.addEventListener("click", (e) => {
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
        // Distancia en mm (aprox 96dpi)
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

    const ctx = measureOverlay.getContext("2d");

    if (anglePoints.length === 1) {
      // primer extremo
      redrawRasterOverlay(ctx);
      const p = rasterImageToCanvas(ptImg);
      ctx.fillStyle = "limegreen";
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    } 
    else if (anglePoints.length === 2) {
      // vértice
      redrawRasterOverlay(ctx);
      const p = rasterImageToCanvas(ptImg);
      ctx.fillStyle = "orange";
      ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    } 
    else if (anglePoints.length === 3) {
      const [p1, center, p2] = anglePoints;

      // Calcular ángulo en el vértice (center)
      const v1 = { x: p1.x - center.x, y: p1.y - center.y };
      const v2 = { x: p2.x - center.x, y: p2.y - center.y };
      const dot = v1.x * v2.x + v1.y * v2.y;
      const mag1 = Math.hypot(v1.x, v1.y);
      const mag2 = Math.hypot(v2.x, v2.y);
      let ang = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);

      angles.push({ center, p1, p2, value: ang });
      anglePoints = [];
      redrawRasterOverlay(ctx);
    }
    return;
  }
    // Notas
    if (activeTool === "annotate") {
      const ptImg = rasterEventToImagePoint(e);
      const text = prompt("📝 Escribe tu nota:");
      if (text) {
        rasterAnnotations.push({ posImg: ptImg, text });
        redrawRasterOverlay(ctx);
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
        // Mostrar línea desde p1 hasta cursor
        const p1 = rasterImageToCanvas(anglePoints[0]);
        const pTemp = rasterImageToCanvas(tempPt);
        ctx.strokeStyle = "limegreen";
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(pTemp.x, pTemp.y); ctx.stroke();
      } 
      else if (anglePoints.length === 2) {
        // Mostrar dos líneas desde vértice hacia p1 y cursor
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


  // Clic derecho (borrado)
  measureOverlay?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const ctx = measureOverlay.getContext("2d");
    const ptImg = rasterEventToImagePoint(e);

    // tolerancia en imagen (aprox convertida desde 10px canvas)
    const tolPx = 10;
    const tolImg = Math.max(
      tolPx / measureOverlay.width  * imagen.naturalWidth,
      tolPx / measureOverlay.height * imagen.naturalHeight
    );

    // Notas
    for (let i=0;i<rasterAnnotations.length;i++){
      const a = rasterAnnotations[i];
      if (Math.hypot(ptImg.x - a.posImg.x, ptImg.y - a.posImg.y) <= tolImg) {
        if (confirm(`¿Borrar la nota "${a.text}"?`)) {
          rasterAnnotations.splice(i,1); redrawRasterOverlay(ctx);
        }
        return;
      }
    }
    // Mediciones
    for (let i=0;i<measurements.length;i++){
      const m = measurements[i];
      if (isPointNearSegmentImg(ptImg, m.startImg, m.endImg, tolImg)) {
        if (confirm("¿Borrar esta medición?")) {
          measurements.splice(i,1); redrawRasterOverlay(ctx);
        }
        return;
      }
    }
    // Figuras
    for (let i=0;i<rasterShapes.length;i++){
      const s = rasterShapes[i];
      if (hitTestShapeImg(ptImg, s, tolImg)) {
        if (confirm(`¿Borrar esta ${s.type}?`)) {
          rasterShapes.splice(i,1); redrawRasterOverlay(ctx);
        }
        return;
      }
    }

    // 4) Ángulos
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      // vértice en coords de imagen
      const c = a.center;
      if (Math.hypot(ptImg.x - c.x, ptImg.y - c.y) <= tolImg) {
        if (confirm(`¿Borrar este ángulo (${a.value.toFixed(1)}°)?`)) {
          angles.splice(i, 1);
          redrawRasterOverlay(ctx);
        }
        return;
      }
    }
  });
}

// -------------------------------------------
/** HIT-TEST helpers (en coords de imagen: sirven para Raster y DICOM) */
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
// BOTONES UI
// -------------------------------------------
const btnZoomIn  = document.getElementById("zoomIn");
const btnZoomOut = document.getElementById("zoomOut");
const btnRotate  = document.getElementById("rotate");
const btnReset   = document.getElementById("reset");
const btnMeasure = document.getElementById("measure");
const btnPan     = document.getElementById("pan");
const btnAnnotate= document.getElementById("annotate"); // notas
const btnRect    = document.getElementById("shapeRect");
const btnCircle  = document.getElementById("shapeCircle");


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


const btnAngle = document.getElementById("angle");
btnAngle?.addEventListener("click", () => { ensureRasterWrapper(); setActiveTool("angle"); });
btnZoomIn?.addEventListener("click", () => {
  if (isDicom) {
    const vp = cornerstone.getViewport(dicomViewer);
    vp.scale = Math.min(10, vp.scale * 1.1);
    cornerstone.setViewport(dicomViewer, vp);
  } else { zoomLevel += 0.1; actualizarTransformaciones(); }
});
btnZoomOut?.addEventListener("click", () => {
  if (isDicom) {
    const vp = cornerstone.getViewport(dicomViewer);
    vp.scale = Math.max(0.1, vp.scale * 0.9);
    cornerstone.setViewport(dicomViewer, vp);
  } else { zoomLevel = Math.max(0.1, zoomLevel - 0.1); actualizarTransformaciones(); }
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
    redrawDicomOverlay();
  } else {
    zoomLevel=1; rotation=0; offsetX=0; offsetY=0; currentFilter="none";
    measurements=[]; rasterAnnotations=[]; rasterShapes=[];
    measureStartImg=null; drawingMeasure=false; shapeStartImg=null;
    actualizarTransformaciones();
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
// FILTROS
// -------------------------------------------
function setFilter(filtro) {
  if (isDicom) {
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
      case "invert": vp.invert = !currentVp.invert; break;
      case "contrast": vp.voi.windowWidth = Math.max(1, (vp.voi.windowWidth || 400) * 0.5); break;
      case "brightness": vp.voi.windowCenter = (vp.voi.windowCenter || 40) + 50; break;
      default: break;
    }
    cornerstone.setViewport(dicomViewer, vp);
  } else {
    switch (filtro) {
      case "grayscale": currentFilter="grayscale(100%)"; break;
      case "sepia": currentFilter="sepia(100%)"; break;
      case "invert": currentFilter="invert(100%)"; break;
      case "contrast": currentFilter="contrast(200%)"; break;
      case "brightness": currentFilter="brightness(150%)"; break;
      default: currentFilter="none"; break;
    }
    actualizarTransformaciones();
  }
}
// -------------------------------------------
// HIT-TEST helpers (en coords de imagen: sirven para Raster y DICOM)
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

window.setFilter = setFilter;
