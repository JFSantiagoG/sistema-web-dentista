// public/js/justificante.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('justificanteForm');
  if (!form) return console.error('❌ No se encontró #justificanteForm');

  const fechaEmisionEl       = document.getElementById('fechaEmision');
  const nombrePacienteEl     = document.getElementById('nombrePaciente');
  const procedimientoEl      = document.getElementById('procedimiento');
  const fechaProcedimientoEl = document.getElementById('fechaProcedimiento');
  const diasReposoEl         = document.getElementById('diasReposo');

  // Firma SOLO para PDF
  const canvas   = document.getElementById('signature-pad-justificante');
  const clearBtn = document.getElementById('clearSignature-pad-justificante');

  // Botones
  const btnGuardar   = form.querySelector('.btn-outline-secondary'); // "Guardar Borrador"
  const btnDescargar = document.getElementById('descargarPDF');      // "Descargar PDF"

  // SweetAlert helpers (fallback a alert/confirm si no está disponible)
  const hasSwal = typeof window.Swal !== 'undefined';
  async function info(t, m)  { return hasSwal ? Swal.fire({icon:'info',    title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function ok(t, m)    { return hasSwal ? Swal.fire({icon:'success', title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function err(t, m)   { return hasSwal ? Swal.fire({icon:'error',   title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function warn(t, m)  { return hasSwal ? Swal.fire({icon:'warning', title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function ask(t, m, confirm='Sí', cancel='Cancelar') {
    if (hasSwal) {
      const r = await Swal.fire({ title:t, text:m, icon:'question', showCancelButton:true, confirmButtonText:confirm, cancelButtonText:cancel });
      return r.isConfirmed;
    } else {
      return window.confirm(`${t}\n${m||''}`);
    }
  }

  // URL → paciente_id
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id') || null;

  // auth
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : {};

  // estado: folio (formulario_id) guardado
  const SS_KEY = (pid) => `justificante:formId:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  // Canal para refrescar perfil (opcional)
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('justificantes') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(`justificante:saved:${pid}`, String(Date.now()));
      bc?.postMessage?.({ type: 'justificante-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // Fecha hoy bloqueada
  const hoyISO = (() => {
    const now = new Date();
    return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  })();
  if (fechaEmisionEl) {
    fechaEmisionEl.value = hoyISO;
    fechaEmisionEl.readOnly = true;
    fechaEmisionEl.min = hoyISO;
    fechaEmisionEl.max = hoyISO;
  }

  // Cargar paciente → nombre autollenado y readonly
  async function cargarPaciente() {
    if (!pacienteId) { await warn('ID faltante', 'La URL debe incluir ?paciente_id=<id>.'); return; }
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');
      if (nombrePacienteEl) {
        nombrePacienteEl.value = nombre || '';
        nombrePacienteEl.readOnly = true;
      }
    } catch (e) {
      console.error('Error cargando paciente:', e);
      await err('Error', 'No se pudo cargar la información del paciente.');
    }
  }
  await cargarPaciente();

  // ====== Firma en canvas: leyenda interna + trazado manual ======
  function initSignaturePad(canvasEl) {
    if (!canvasEl) return { getB64: () => null, clear: () => {} };

    // Leyenda dentro del canvas
    const ctx = canvasEl.getContext('2d');
    function drawLegend() {
      const text = 'Haz click aquí para firmar';
      ctx.save();
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.fillStyle = '#6c757d';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvasEl.width / 2, canvasEl.height / 2);
      ctx.restore();
    }
    drawLegend();

    let drawing = false; let started = false;
    let last = { x: 0, y: 0 };

    function pos(evt) {
      const r = canvasEl.getBoundingClientRect();
      const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left;
      const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - r.top;
      return { x, y };
    }
    function down(e) {
      drawing = true;
      if (!started) {
        started = true;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      last = pos(e);
    }
    function move(e) {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      last = p;
    }
    function up() { drawing = false; }

    canvasEl.addEventListener('mousedown', down);
    canvasEl.addEventListener('mousemove', move);
    canvasEl.addEventListener('mouseup', up);
    canvasEl.addEventListener('mouseleave', up);

    canvasEl.addEventListener('touchstart', (e) => { e.preventDefault(); down(e); }, { passive: false });
    canvasEl.addEventListener('touchmove',  (e) => { e.preventDefault(); move(e); }, { passive: false });
    canvasEl.addEventListener('touchend',   (e) => { e.preventDefault(); up(e);   }, { passive: false });

    canvasEl.style.cursor = 'crosshair';

    function isBlank() {
      const { data } = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    }
    function getB64() {
      if (!started || isBlank()) return null;
      return canvasEl.toDataURL('image/png');
    }
    function clear() {
      started = false;
      drawLegend();
    }

    return { getB64, clear };
  }
  const sig = initSignaturePad(canvas);

  // Botón limpiar firma
  clearBtn?.addEventListener('click', sig.clear);

  // ====== Helpers nombre de archivo ======
  function stripAccents(str='') {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function firstAndLast(full='') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  function yyyymmdd(dStr) {
    const s = (dStr || '').replaceAll('-', '');
    if (s && s.length === 8) return s;
    return hoyISO.replaceAll('-', '');
  }
  function buildFilename({ fecha, formKey, fullName }) {
    const { first, last } = firstAndLast(fullName || '');
    const base = `${yyyymmdd(fecha)}_${formKey}_${[first, last].filter(Boolean).join('_')}`;
    return stripAccents(base).replace(/\s+/g, '_');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ====== Helpers de datos ======
  function buildData() {
    return {
      fechaEmision:       fechaEmisionEl?.value || '',
      nombrePaciente:     nombrePacienteEl?.value || '',
      procedimiento:      procedimientoEl?.value || '',
      fechaProcedimiento: fechaProcedimientoEl?.value || '',
      diasReposo:         diasReposoEl?.value || ''
      // ❌ SIN firma para BD
    };
  }

  // ====== Guardar en BD (sin firma) ======
  async function guardarEnBD() {
    if (!pacienteId) { await warn('ID faltante', 'La URL debe incluir ?paciente_id=<id>.'); return null; }
    const data = buildData();

    // Validaciones mínimas
    if (!data.procedimiento || !data.fechaProcedimiento || !data.diasReposo) {
      await warn('Campos requeridos', 'Completa procedimiento, fechas y días de reposo.');
      return null;
    }

    // Si ya existe folio, preguntar si crear OTRO justificante nuevo
    if (formularioId) {
      const crearOtro = await ask(
        `Ya existe un folio (${formularioId}).`,
        '¿Deseas crear otro justificante nuevo con estos datos?',
        'Sí, crear otro'
      );
      if (!crearOtro) return null;
      // Olvidar folio anterior para forzar nuevo
      formularioId = null;
      if (pacienteId) sessionStorage.removeItem(SS_KEY(pacienteId));
    }

    // Anti doble-clic
    if (btnGuardar) btnGuardar.disabled = true;

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
      if (btnGuardar) btnGuardar.disabled = false;
    }
  }

  // Botón: Guardar Borrador
  btnGuardar?.addEventListener('click', guardarEnBD);

  // Submit (Enviar) — requiere folio
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!formularioId) {
      await warn('Primero guarda el justificante', 'Para enviarlo debes guardarlo y obtener un folio.');
      return;
    }
    // Simulación de envío; aquí va tu endpoint real si aplica
    await new Promise(r => setTimeout(r, 500));
    await ok('Justificante enviado', `Folio ${formularioId}`);
  });

  // Descargar / Ver PDF — requiere folio; firma SOLO PDF
  btnDescargar?.addEventListener('click', async () => {
    if (!formularioId) {
      await warn('Primero guarda el justificante', 'Para descargar el PDF debes guardarlo y obtener un folio.');
      return;
    }

    // Aviso previo (abre en otra pestaña)
    const pre = await info(
      'Se abrirá el PDF en otra pestaña',
      'Al regresar, podrás descargarlo desde aquí con un nombre sugerido.'
    );

    const data = buildData();
    data.formularioId = formularioId;

    // Enviar firma SOLO al PDF
    const firma = sig.getB64();
    if (firma) data.firmaMedico = firma; // tu generador usa firmaMedico

    try {
      const res = await fetch('/api/pdf/justificante/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // Ver en otra pestaña
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // Sugerir descarga con nombre: YYYYMMDD_justificante_Nombre_Apellido.pdf
      const fullName = (nombrePacienteEl?.value || '').trim();
      const fecha    = fechaEmisionEl?.value || hoyISO;
      const filename = buildFilename({ fecha, formKey: 'justificante', fullName });

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
        }).then((r) => {
          if (r.isConfirmed) downloadBlob(blob, filename);
        });
      } else {
        // Fallback simple
        const doDl = window.confirm(`PDF listo.\nNombre sugerido: ${filename}.pdf\n\n¿Descargar ahora?`);
        if (doDl) downloadBlob(blob, filename);
      }

      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error al generar PDF:', e);
      await err('Error', 'No se pudo generar el PDF.');
    }
  });
});
