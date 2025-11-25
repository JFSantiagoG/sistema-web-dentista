// public/js/justificante.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('justificanteForm');
  if (!form) return console.error('❌ No se encontró #justificanteForm');

  const modeBadge          = document.getElementById('modeBadge');
  const fechaEmisionEl     = document.getElementById('fechaEmision');
  const nombrePacienteEl   = document.getElementById('nombrePaciente');
  const procedimientoEl    = document.getElementById('procedimiento');
  const fechaProcEl        = document.getElementById('fechaProcedimiento');
  const diasReposoEl       = document.getElementById('diasReposo');

  const canvas   = document.getElementById('signature-pad-justificante');
  const clearBtn = document.getElementById('clearSignature-pad-justificante');
  const firmaImg = document.getElementById('firmaJustificanteImg');

  const btnGuardar   = document.getElementById('btnGuardar');
  const btnEnviar    = document.getElementById('btnEnviar');
  const btnDescargar = document.getElementById('descargarPDF');

  // 👇 base para cargar firmas desde el backend
  const FIRMA_BASE_URL = '/api/patients/uploads';

  // SweetAlert helpers
  const hasSwal = typeof window.Swal !== 'undefined';
  const info  = (t,m) => hasSwal ? Swal.fire({icon:'info',    title:t, text:m}) : alert(`${t}\n${m||''}`);
  const ok    = (t,m) => hasSwal ? Swal.fire({icon:'success', title:t, text:m}) : alert(`${t}\n${m||''}`);
  const err   = (t,m) => hasSwal ? Swal.fire({icon:'error',   title:t, text:m}) : alert(`${t}\n${m||''}`);
  const warn  = (t,m) => hasSwal ? Swal.fire({icon:'warning', title:t, text:m}) : alert(`${t}\n${m||''}`);
  async function ask(t, m, confirm='Sí', cancel='Cancelar') {
    if (hasSwal) {
      const r = await Swal.fire({
        title:t, text:m, icon:'question',
        showCancelButton:true,
        confirmButtonText:confirm,
        cancelButtonText:cancel
      });
      return r.isConfirmed;
    }
    return window.confirm(`${t}\n${m||''}`);
  }

  // URL params
  const qs = new URLSearchParams(location.search);
  const pacienteId   = qs.get('paciente_id') || qs.get('id') || null;   // modo NUEVO
  const formularioIdQ = qs.get('formulario_id');                        // modo VISUALIZAR
  const viewMode = !!formularioIdQ;

  // auth
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : {};

  // estado: folio recordado en sesión (solo para modo nuevo)
  const SS_KEY = (pid) => `justificante:formId:${pid}`;
  let formularioId = viewMode
    ? Number(formularioIdQ)
    : (pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null);

  // canal de refresco del perfil
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('justificantes') : null;
  const notificarGuardado = (pid, folio) => {
    try {
      localStorage.setItem(`justificante:saved:${pid}`, String(Date.now()));
      bc?.postMessage?.({ type: 'justificante-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  };

  // fecha hoy bloqueada (YYYY-MM-DD)
  const hoyISO = (() => {
    const now = new Date();
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();
  fechaEmisionEl.value = hoyISO;
  fechaEmisionEl.readOnly = true;
  fechaEmisionEl.min = hoyISO;
  fechaEmisionEl.max = hoyISO;

  // ===== firma canvas =====
  function initSignaturePad(canvasEl) {
    if (!canvasEl) return { getB64: () => null, clear: () => {} };
    const ctx = canvasEl.getContext('2d');

    function drawLegend() {
      ctx.save();
      ctx.clearRect(0,0,canvasEl.width,canvasEl.height);
      ctx.fillStyle = '#6c757d';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Haz click aquí para firmar', canvasEl.width/2, canvasEl.height/2);
      ctx.restore();
    }
    drawLegend();

    let drawing = false, started = false, last={x:0,y:0};
    function pos(e){
      const r=canvasEl.getBoundingClientRect();
      const t=e.touches?e.touches[0]:e;
      return {x:t.clientX-r.left,y:t.clientY-r.top};
    }
    function down(e){
      drawing=true;
      if(!started){
        started=true;
        ctx.clearRect(0,0,canvasEl.width,canvasEl.height);
      }
      last=pos(e);
    }
    function move(e){
      if(!drawing)return;
      const p=pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x,last.y);
      ctx.lineTo(p.x,p.y);
      ctx.lineWidth=2;
      ctx.lineCap='round';
      ctx.stroke();
      last=p;
    }
    function up(){drawing=false;}

    canvasEl.addEventListener('mousedown',down);
    canvasEl.addEventListener('mousemove',move);
    canvasEl.addEventListener('mouseup',up);
    canvasEl.addEventListener('mouseleave',up);
    canvasEl.addEventListener('touchstart',(e)=>{e.preventDefault();down(e);},{passive:false});
    canvasEl.addEventListener('touchmove',(e)=>{e.preventDefault();move(e);},{passive:false});
    canvasEl.addEventListener('touchend',(e)=>{e.preventDefault();up(e);},{passive:false});
    canvasEl.style.cursor='crosshair';

    function isBlank(){
      const {data}=ctx.getImageData(0,0,canvasEl.width,canvasEl.height);
      for(let i=3;i<data.length;i+=4) if(data[i]!==0) return false;
      return true;
    }
    function getB64(){
      if(isBlank()) return null;
      return canvasEl.toDataURL('image/png');
    }
    function clear(){ started=false; drawLegend(); }

    return { getB64, clear };
  }
  const sig = initSignaturePad(canvas);
  clearBtn?.addEventListener('click', sig.clear);

  // ===== helpers filename =====
  const stripAccents = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function firstAndLast(full=''){
    const parts=(full||'').trim().split(/\s+/).filter(Boolean);
    return {first:parts[0]||'', last:parts.length>1?parts[parts.length-1]:''};
  }
  const yyyymmdd = (dStr) => (dStr||'').replaceAll('-','') || hoyISO.replaceAll('-','');
  function buildFilename({ fecha, formKey, fullName }) {
    const {first,last}=firstAndLast(fullName||'');
    return stripAccents(`${yyyymmdd(fecha)}_${formKey}_${[first,last].filter(Boolean).join('_')}`).replace(/\s+/g,'_');
  }
  function downloadBlob(blob, filename){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=filename+'.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== helpers datos =====
  function buildData() {
    return {
      fechaEmision:       fechaEmisionEl.value || '',
      nombrePaciente:     nombrePacienteEl.value || '',
      procedimiento:      procedimientoEl.value || '',
      fechaProcedimiento: fechaProcEl.value || '',
      diasReposo:         diasReposoEl.value || ''
    };
  }
  function setReadonlyAll(ro=true){
    [nombrePacienteEl, procedimientoEl, fechaProcEl, diasReposoEl].forEach(el=>{
      if(!el) return;
      el.readOnly = ro;
      if (el.type === 'number') el.disabled = ro;
    });
  }

  // ===== obtener firma en base64 (VISUALIZAR o NUEVO) =====
  async function getFirmaBase64() {
    // 1) Primero intentar desde la imagen (modo VISUALIZAR)
    if (firmaImg && !firmaImg.classList.contains('d-none') && firmaImg.src) {
      try {
        console.log('[justificante] intentando firma desde <img>', firmaImg.src);
        const resp = await fetch(firmaImg.src);
        if (!resp.ok) {
          console.warn('[getFirmaBase64] HTTP error al cargar imagen:', resp.status);
        } else {
          const blob = await resp.blob();
          const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          console.log('[justificante] firma desde <img> (base64)', String(base64).slice(0,80) + '...');
          return base64;
        }
      } catch (e) {
        console.error('[getFirmaBase64] Error convirtiendo imagen:', e);
      }
    }

    // 2) Si no hay img, usar el canvas (modo NUEVO)
    if (sig && typeof sig.getB64 === 'function') {
      const fromCanvas = sig.getB64();
      if (fromCanvas) {
        console.log('[justificante] firma desde canvas', String(fromCanvas).slice(0,80) + '...');
        return fromCanvas;
      }
    }

    console.log('[justificante] getFirmaBase64 -> SIN firma');
    return null;
  }

  // ===== cargar paciente (modo nuevo) =====
  async function cargarPaciente() {
    if (!pacienteId) return;
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');
      nombrePacienteEl.value = nombre || '';
      nombrePacienteEl.readOnly = true;
    } catch (e) {
      console.error('Error cargando paciente:', e);
      await err('Error', 'No se pudo cargar la información del paciente.');
    }
  }

  // ===== cargar justificante por folio (modo visualizar) =====
async function cargarJustificantePorFolio(id) {
  try {
    const res = await fetch(`/api/patients/forms/justificante/${encodeURIComponent(id)}`, {
      headers: authHeaders
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();

    console.log('[justificante] detalle recibido:', j);

    nombrePacienteEl.value   = j.nombre_paciente || '';
    fechaEmisionEl.value     = (j.fecha_emision || '').split('T')[0] || '';
    procedimientoEl.value    = j.procedimiento || '';
    fechaProcEl.value        = j.fecha_procedimiento || '';
    diasReposoEl.value       = j.dias_reposo ?? '';

    // ==== FIRMA GUARDADA ====
    const firmaPath =
      j.firma_path ||
      j.firmaPath ||
      j.firma_file ||
      j.firmaFile ||
      null;

    console.log('[justificante] firmaPath:', firmaPath);

    // en visualizar ocultamos el canvas y mostramos sólo la imagen, si hay
    if (canvas) canvas.classList.add('d-none');
    if (clearBtn) clearBtn.classList.add('d-none');

    if (firmaImg) {
      if (firmaPath) {
        const url = `${FIRMA_BASE_URL}/${encodeURIComponent(firmaPath)}`;
        console.log('[justificante] mostrando firma desde:', url);
        firmaImg.src = url;
        firmaImg.style.display = 'block';
      } else {
        console.warn('[justificante] no se encontró firma guardada');
        firmaImg.style.display = 'none';
      }
    }
    // ==== FIN FIRMA ====

    // 🔒 Bloquear edición
    setReadonlyAll(true);

  } catch (e) {
    console.error('Error cargando justificante:', e);
    await err('Error', 'No se pudo cargar el justificante.');
  }
}


 // ===== Guardar en BD (con firma OPCIONAL) =====
async function guardarEnBD() {
  if (!pacienteId) {
    await warn('ID faltante', 'La URL debe incluir ?paciente_id=<id>.');
    return null;
  }

  const data = buildData();

  if (!data.procedimiento || !data.fechaProcedimiento || !data.diasReposo) {
    await warn('Campos requeridos', 'Completa procedimiento, fechas y días de reposo.');
    return null;
  }

  // 🔥 AQUI: firma del profesional (canvas)
  const firma = sig.getB64();
  if (firma) {
    data.firmaBase64 = firma;   // 👈 se irá al backend
  }

  if (formularioId) {
    const crearOtro = await ask(
      `Ya existe un folio (${formularioId}).`,
      '¿Deseas crear otro justificante nuevo con estos datos?',
      'Sí, crear otro'
    );
    if (!crearOtro) return null;
    formularioId = null;
    sessionStorage.removeItem(SS_KEY(pacienteId));
  }

  btnGuardar.disabled = true;
  try {
    const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/justificantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    formularioId = Number(json.formulario_id) || null;

    if (formularioId) {
      sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
      notificarGuardado(pacienteId, formularioId);
    }
    await ok('Guardado', `Folio: ${formularioId ?? '—'}`);
    return formularioId;
  } catch (e) {
    console.error('Error guardando justificante:', e);
    await err('Error', 'No se pudo guardar el justificante.');
    return null;
  } finally {
    btnGuardar.disabled = false;
  }
}


  // ===== botones =====
  btnGuardar?.addEventListener('click', guardarEnBD);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formularioId) {
      await warn('Primero guarda el justificante', 'Para enviarlo debes guardarlo y obtener un folio.');
      return;
    }
    await new Promise(r => setTimeout(r, 500));
    await ok('Justificante enviado', `Folio ${formularioId}`);
  });

  btnDescargar?.addEventListener('click', async () => {
    if (!formularioId) {
      await warn('Primero guarda el justificante', 'Para descargar el PDF debes guardarlo y obtener un folio.');
      return;
    }
    await info('Se abrirá el PDF en otra pestaña', 'Al regresar, podrás descargarlo con un nombre sugerido.');

    const data = buildData();
    data.formularioId = formularioId;

    const firma = await getFirmaBase64();   // 👈 ahora usa img/canvas según el modo
    if (firma) data.firmaMedico = firma;    // se envía SOLO al PDF

    try {
      const res = await fetch('/api/pdf/justificante/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const filename = buildFilename({
        fecha: fechaEmisionEl.value || hoyISO,
        formKey: 'justificante',
        fullName: (nombrePacienteEl.value || '').trim()
      });

      if (hasSwal) {
        await Swal.fire({
          icon: 'success',
          title: 'PDF listo',
          html: `
            <p>El PDF se abrió en otra pestaña.</p>
            <p class="mb-1"><small>Nombre sugerido:</small></p>
            <code style="user-select:all">${filename}.pdf</code>
          `,
          showCancelButton: true,
          confirmButtonText: '⬇️ Descargar PDF',
          cancelButtonText: 'Cerrar'
        }).then(r => { if (r.isConfirmed) downloadBlob(blob, filename); });
      } else {
        if (confirm(`PDF listo.\nNombre sugerido: ${filename}.pdf\n\n¿Descargar ahora?`)) {
          downloadBlob(blob, filename);
        }
      }

      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error al generar PDF:', e);
      await err('Error', 'No se pudo generar el PDF.');
    }
  });

  // ===== inicialización por modo =====
  if (modeBadge) {
    modeBadge.classList.remove('d-none');
    modeBadge.textContent = viewMode ? 'Visualizar justificante' : 'Nuevo justificante';
  }

  if (viewMode) {
    btnGuardar?.classList.add('d-none'); // no se puede guardar en visualizar
    await cargarJustificantePorFolio(formularioId);
  } else {
    await cargarPaciente();
  }
});
