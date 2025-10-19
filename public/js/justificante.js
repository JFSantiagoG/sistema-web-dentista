// public/js/justificante.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('justificanteForm');
  if (!form) return console.error('❌ No se encontró #justificanteForm');

  const fechaEmisionEl       = document.getElementById('fechaEmision');
  const nombrePacienteEl     = document.getElementById('nombrePaciente');
  const procedimientoEl      = document.getElementById('procedimiento');
  const fechaProcedimientoEl = document.getElementById('fechaProcedimiento');
  const diasReposoEl         = document.getElementById('diasReposo');

  const canvas   = document.getElementById('signature-pad-justificante');  // firma SOLO PDF
  const clearBtn = document.getElementById('clearSignature-pad-justificante');
  const btnGuardar = form.querySelector('.btn-outline-secondary');         // "Guardar Borrador"
  const btnDescargar = document.getElementById('descargarPDF');            // "Descargar PDF"

  // Cursor tipo X al activar firma (cosmético)
  if (canvas) {
    canvas.addEventListener('click', () => { canvas.style.cursor = 'crosshair'; });
  }

  // Helpers SweetAlert (fallback si no está disponible)
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
      return confirm(`${t}\n${m||''}`);
    }
  }

  // URL → paciente_id
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id') || null;

  // auth
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

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
  if (fechaEmisionEl) {
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    fechaEmisionEl.value = iso;
    fechaEmisionEl.readOnly = true;
    fechaEmisionEl.min = iso;
    fechaEmisionEl.max = iso;
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

  // Firma: limpiar
  clearBtn?.addEventListener('click', () => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  // Helpers de datos
  function buildData() {
    return {
      fechaEmision:       fechaEmisionEl?.value || '',
      nombrePaciente:     nombrePacienteEl?.value || '',
      procedimiento:      procedimientoEl?.value || '',
      fechaProcedimiento: fechaProcedimientoEl?.value || '',
      diasReposo:         diasReposoEl?.value || ''
      // SIN firma para BD
    };
  }
  function getFirmaBase64() {
    if (!canvas) return null;
    try {
      const blank = document.createElement('canvas');
      blank.width = canvas.width; blank.height = canvas.height;
      const isBlank = canvas.toDataURL() === blank.toDataURL();
      if (isBlank) return null;
      return canvas.toDataURL('image/png'); // SOLO PDF
    } catch {
      return null;
    }
  }

  // Guardar en BD (sin firma)
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

  // Descargar PDF — requiere folio; firma SOLO PDF
  btnDescargar?.addEventListener('click', async () => {
    if (!formularioId) {
      await warn('Primero guarda el justificante', 'Para descargar el PDF debes guardarlo y obtener un folio.');
      return;
    }
    const data = buildData();
    data.formularioId = formularioId;

    const firma = getFirmaBase64();
    if (firma) data.firmaMedico = firma;  // tu generador ya espera "firmaMedico"

    try {
      const res = await fetch('/api/pdf/justificante/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      await ok('PDF generado', `Folio ${formularioId}`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await err('Error', 'No se pudo generar el PDF.');
    }
  });
});
