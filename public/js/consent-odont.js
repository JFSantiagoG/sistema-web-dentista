// public/js/consent-odont.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Auth
  const token = localStorage.getItem('token') || '';
  const authHeaders = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : {};
  const FIRMA_BASE_URL = '/api/patients/uploads';
  const firmaWrap  = document.querySelector('.card.section-card .firma-wrap') || document.querySelector('.firma-wrap');
  const firmaImg   = document.getElementById('firmaConsentImg');
  const bloqueFirma = document.querySelector('.card.section-card');

  // --- Refs
  const form = document.getElementById('consentForm');

  // Paso 1 (captura)
  const pacienteSelect       = document.getElementById('pacienteSelect');      // oculto (compat)
  const nombreVis            = document.getElementById('nombrePacienteVisible'); // visible, readonly
  const fechaInput           = document.getElementById('fechaRegistroInput');
  const numeroPacienteInput  = document.getElementById('numeroPacienteInput');

  const tratInput            = document.getElementById('tratamientoInput');
  const montoInput           = document.getElementById('montoInput');
  const ausenInput           = document.getElementById('ausenciaInput');

  // Paso 2 (confirmación)
  const confirmNombre        = document.getElementById('confirmNombrePaciente');
  const confirmFecha         = document.getElementById('confirmFecha');
  const confirmNum           = document.getElementById('confirmNumeroPaciente');

  const confirmTrat          = document.getElementById('confirmTratamiento');
  const confirmMonto         = document.getElementById('confirmMonto');
  const confirmAus           = document.getElementById('confirmAusencia');

  const step1 = document.getElementById('doctor-step');
  const step2 = document.getElementById('patient-step');
  const ind1  = document.getElementById('step1-indicator');
  const ind2  = document.getElementById('step2-indicator');

  // Firma
  const canvasFirma   = document.getElementById('signature-pad');
  const clearFirmaBtn = document.getElementById('clearSignature-pad');

  // Botón PDF
  const btnDescargarPDF = document.getElementById('btnDescargarPDF') || document.querySelector('.btn-info');

  // QueryString
  const qs = new URLSearchParams(location.search);
  const pacienteId   = qs.get('paciente_id') || qs.get('id') || null;
  const formularioIdQS = qs.get('formulario_id') || null;

  // Estado local (folio por paciente)
  const SS_KEY = (pid) => `consent-odont:formId:${pid}`;
  let formularioId = (formularioIdQS) ? Number(formularioIdQS) :
    (pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null);

  // Canal para refrescar perfil (opcional)
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('consent-odont') : null;
  function notificarGuardado(pid, folio) {
    try {
      localStorage.setItem(`consent-odont:saved:${pid}`, String(Date.now()));
      bc?.postMessage?.({ type: 'consent-odont-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // Utils
  const todayISO = () => {
    const now = new Date();
    const z = new Date(now.getTime() - now.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();

  // SweetAlert helpers
  const hasSwal = typeof window.Swal !== 'undefined';
  async function info(t, m)  { return hasSwal ? Swal.fire({icon:'info',    title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function ok(t, m)    { return hasSwal ? Swal.fire({icon:'success', title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function errbox(t, m){ return hasSwal ? Swal.fire({icon:'error',   title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function warn(t, m)  { return hasSwal ? Swal.fire({icon:'warning', title:t, text:m})    : alert(`${t}\n${m||''}`); }

  // Nombre de archivo
  function stripAccents(str='') { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function firstAndLast(full='') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: '', last: '' };
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts[parts.length - 1] };
  }
  function yyyymmdd(dStr) {
    const s = (dStr || '').replaceAll('-', '');
    if (s && s.length === 8) return s;
    return todayISO().replaceAll('-', '');
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

  // ====== Firma: pad simple con leyenda ======
  function initSignaturePad(canvasEl) {
    if (!canvasEl) return { getB64: () => null, clear: () => {} };

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
  // ====== Helper para obtener la firma en base64 ======
async function getFirmaBase64() {
  // 1) Intentar desde el signature pad
  if (sigPaciente && sigPaciente.getB64) {
    const fromPad = sigPaciente.getB64();
    if (fromPad) return fromPad;
  }

  // 2) Intentar desde la imagen ya cargada (visualizar)
  if (firmaImg && firmaImg.src && firmaImg.style.display !== 'none') {
    try {
      const resp = await fetch(firmaImg.src);
      if (!resp.ok) {
        console.warn('[getFirmaBase64] HTTP error al cargar imagen:', resp.status);
        return null;
      }
      const blob = await resp.blob();
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      return base64; // data:image/png;base64,...
    } catch (e) {
      console.error('[getFirmaBase64] Error convirtiendo imagen:', e);
      return null;
    }
  }

  // 3) No hay firma
  return null;
}

  const sigPaciente = initSignaturePad(canvasFirma);
  clearFirmaBtn?.addEventListener('click', sigPaciente.clear);

  // ====== Prefill paciente (modo nuevo)
  async function cargarPacienteYPrefill() {
    if (!pacienteId) return;
    if (fechaInput) {
      const iso = todayISO();
      fechaInput.value = iso;
      fechaInput.readOnly = true;
      fechaInput.min = iso;
      fechaInput.max = iso;
    }
    if (numeroPacienteInput) {
      numeroPacienteInput.value = String(pacienteId);
      numeroPacienteInput.readOnly = true;
    }

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = buildNombre(p) || '(Sin nombre)';

      if (nombreVis) nombreVis.value = nombre;

      if (pacienteSelect) {
        pacienteSelect.innerHTML = '';
        const opt = document.createElement('option');
        opt.value = String(pacienteId);
        opt.textContent = nombre;
        opt.selected = true;
        pacienteSelect.appendChild(opt);
      }
    } catch (e) {
      console.error('Error cargando paciente:', e);
      await errbox('Error', 'No se pudo cargar el paciente.');
    }
  }

  // ====== Paso a confirmación (expuesta global por compat)
  window.showPatientStep = function showPatientStep() {
    const nombrePaciente = (() => {
      if (pacienteSelect && pacienteSelect.selectedIndex >= 0) {
        return pacienteSelect.options[pacienteSelect.selectedIndex].text;
      }
      return nombreVis?.value || '';
    })();

    const fecha = fechaInput?.value || todayISO();
    const numero = numeroPacienteInput?.value || (pacienteId ? String(pacienteId) : '');
    const tratamiento = (tratInput?.value || '').trim();
    const monto = (montoInput?.value ?? '').trim();
    const ausenciaDias = (ausenInput?.value ?? '').trim();

    if (!nombrePaciente || !fecha || !tratamiento || monto === '' || ausenciaDias === '') {
      Swal?.fire?.({ icon: 'warning', title: 'Faltan datos', text: 'Completa nombre, fecha, tratamiento, monto y ausencia.' }) ||
      alert('Faltan datos: nombre, fecha, tratamiento, monto y ausencia.');
      return;
    }

    if (confirmNombre) confirmNombre.value = nombrePaciente;
    if (confirmFecha)  confirmFecha.value  = fecha;
    if (confirmNum)    confirmNum.value    = numero;
    if (confirmTrat)   confirmTrat.value   = tratamiento;
    if (confirmMonto)  confirmMonto.textContent = monto || '0.00';
    if (confirmAus)    confirmAus.textContent   = ausenciaDias || '0';

    step1 && (step1.style.display = 'none');
    step2 && (step2.style.display = 'block');
    ind1?.classList.remove('active');
    ind2?.classList.add('active');
  };

  window.showDoctorStep = function showDoctorStep() {
    step2 && (step2.style.display = 'none');
    step1 && (step1.style.display = 'block');
    ind2?.classList.remove('active');
    ind1?.classList.add('active');
  };

  // ====== Guardar en BD (submit del formulario) — sin firma en BD
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

   // En visualizar: permitir "Enviar" (simulado), igual que consent-quiro
    if (formularioIdQS) {
      await ok('Formulario enviado', '(Simulado) Enviado al paciente.');
      return;
    }


    const nombrePaciente = confirmNombre?.value || nombreVis?.value || '';
    const fecha = confirmFecha?.value || fechaInput?.value || todayISO();
    const numero = confirmNum?.value || numeroPacienteInput?.value || (pacienteId ? String(pacienteId) : '');
    const tratamiento = (confirmTrat?.value || tratInput?.value || '').trim();
    const monto = (confirmMonto?.textContent ?? montoInput?.value ?? '').trim();
    const ausenciaDias = (confirmAus?.textContent ?? ausenInput?.value ?? '').trim();

    const autorizacion = document.getElementById('autorizacionCheck')?.checked || false;
    const economico    = document.getElementById('economicoCheck')?.checked || false;
    const ausencia     = document.getElementById('ausenciaCheck')?.checked || false;

    if (!pacienteId) { await warn('ID inválido', 'Falta ?paciente_id en la URL.'); return; }
    if (!nombrePaciente || !fecha || !tratamiento || monto === '' || ausenciaDias === '') {
      await warn('Faltan datos', 'Completa la información requerida.');
      return;
    }

    const body = {
      fecha,                   // YYYY-MM-DD
      numero_paciente: numero, // string
      tratamiento,
      monto,
      ausencia_dias: ausenciaDias,
      autorizacion,
      economico,
      ausencia
      // (sin firma en BD aún)
    };
    const firmaPacienteB64 = sigPaciente.getB64();
    if (firmaPacienteB64) {
      body.firmaBase64 = firmaPacienteB64;
    }

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-odont`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      formularioId = Number(json.formulario_id) || null;
      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarGuardado(pacienteId, formularioId);
      }

      await ok('Guardado', `Folio ${formularioId ?? '—'} creado correctamente.`);
    } catch (err) {
      console.error('Error al guardar consentimiento:', err);
      await errbox('Error', 'No se pudo guardar el consentimiento.');
    }
  });

  // ====== Descargar / Ver PDF (con firma SOLO para PDF)
  btnDescargarPDF?.addEventListener('click', async () => {
    const nombre = confirmNombre?.value || nombreVis?.value || '';
    const fecha  = confirmFecha?.value  || fechaInput?.value || todayISO();
    const numero = confirmNum?.value    || numeroPacienteInput?.value || (pacienteId ? String(pacienteId) : '');
    const tratamiento = (confirmTrat?.value || tratInput?.value || '').trim();
    const monto = (confirmMonto?.textContent ?? montoInput?.value ?? '').trim();
    const ausencia = (confirmAus?.textContent ?? ausenInput?.value ?? '').trim();

    if (!nombre || !fecha || !tratamiento || monto === '' || ausencia === '') {
      await warn('Faltan datos', 'Completa la información para el PDF.');
      return;
    }

    // Requiere folio
    if (!formularioId) {
      await warn('Primero guarda', 'Debes guardar para obtener un folio.');
      return;
    }

    // firma del paciente SOLO para PDF
    const firmaPaciente = await getFirmaBase64(); // puede ser null

    await info('Se abrirá el PDF en otra pestaña', 'Al regresar, podrás descargarlo con un nombre sugerido.');

    try {
      const res = await fetch('/api/pdf/consentimiento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formularioId, // para que el PDF muestre el folio si lo deseas
          paciente: { nombre, fecha, numeroPaciente: numero },
          tratamiento,
          monto,
          ausencia,
          firmaPaciente // no se guarda en BD
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const filename = buildFilename({ fecha, formKey: 'consent-odont', fullName: nombre });

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
        const doDl = window.confirm(`PDF listo.\nNombre sugerido: ${filename}.pdf\n\n¿Descargar ahora?`);
        if (doDl) downloadBlob(blob, filename);
      }

      URL.revokeObjectURL(viewUrl);
    } catch (e) {
      console.error('Error generando PDF:', e);
      await errbox('Error', 'No se pudo generar el PDF.');
    }
  });

  // ====== VISUALIZAR (solo lectura) ======
  async function cargarParaVisualizar(formId) {
    const url = `/api/patients/forms/consent-odont/${encodeURIComponent(formId)}`;
    try {
      // 1) Verifica token para no “morir” en silencio con 401
      if (!token) {
        await errbox('No autenticado', 'No hay token en localStorage. Inicia sesión antes de visualizar.');
        console.warn('[Visualizar] Falta token, se intentará de todos modos:', url);
      }

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });

      // 2) Si falla, muestro el texto de error para saber la causa
      const raw = await res.text();
      if (!res.ok) {
        console.error('[Visualizar] HTTP ' + res.status, raw);
        let msg = `HTTP ${res.status}`;
        try { const jErr = JSON.parse(raw); msg += ` – ${jErr.error || jErr.message || 'Error'} `; } catch {}
        await errbox('No se pudo cargar el consentimiento', msg);
        return;
      }

      // 3) Si OK, parseo
      let j = {};
      try { j = JSON.parse(raw); } catch (e) {
        console.error('[Visualizar] JSON inválido:', raw);
        await errbox('Error', 'Respuesta del servidor inválida.');
        return;
      }

      // 4) Mapeo de campos
      const nombre = j?.paciente?.nombre_completo
        || ([j?.paciente?.nombre, j?.paciente?.apellido].filter(Boolean).join(' '))
        || j?.nombre_paciente
        || '(Sin nombre)';

      const fecha  = (j?.fecha || j?.fecha_emision || '').slice(0,10) || todayISO();
      const numero = j?.numero_paciente || (j?.paciente?.id ? String(j.paciente.id) : '');

      // Paso 1
      if (nombreVis) nombreVis.value = nombre;
      if (fechaInput) fechaInput.value = fecha;
      if (numeroPacienteInput) numeroPacienteInput.value = numero;

      // Paso 2
      if (confirmNombre) confirmNombre.value = nombre;
      if (confirmFecha)  confirmFecha.value  = fecha;
      if (confirmNum)    confirmNum.value    = numero;

      if (confirmTrat)  confirmTrat.value = j?.tratamiento || '';
      if (confirmMonto) confirmMonto.textContent = (j?.monto != null ? String(j.monto) : '0.00');
      if (confirmAus)   confirmAus.textContent   = (j?.ausencia_dias != null ? String(j.ausencia_dias) : '0');

            // ==== FIRMA GUARDADA (si existe) ====
      const firmaPath =
        j.firma_path ||
        j.firmaPath ||
        j.firma_archivo ||
        j.firmaArchivo ||
        j.firma_file ||
        j.firmaFile ||
        j.firma; // por si el modelo usa otro nombre

      console.log('[Visualizar consent-odont] firmaPath:', firmaPath);

      // En visualizar NO queremos que se use el canvas ni el botón limpiar
      if (firmaWrap) {
        firmaWrap.style.display = 'none';
      }
      if (clearFirmaBtn) {
        clearFirmaBtn.classList.add('d-none');
      }

      if (firmaImg) {
        if (firmaPath) {
          const url = `${FIRMA_BASE_URL}/${encodeURIComponent(firmaPath)}`;
          console.log('Mostrando firma de consentimiento desde:', url);
          firmaImg.src = url;
          firmaImg.style.display = 'block';
        } else {
          console.warn('Consentimiento sin firma guardada');
          firmaImg.style.display = 'none';
        }
      }
      // ==== FIN FIRMA ====

      // Mostrar paso 2 (solo lectura)
      step1 && (step1.style.display = 'none');
      step2 && (step2.style.display = 'block');
      ind1?.classList.remove('active');
      ind2?.classList.add('active');

      // Desactivar inputs (excepto botón PDF)
      document.body.classList.add('view-only');
      form.querySelectorAll('input, textarea, select, button.btn-step').forEach(el => {
        if (el === btnDescargarPDF) return;
        el.setAttribute('readonly', true);
        if (!el.matches('#btnDescargarPDF, .btn-info')) el.setAttribute('disabled', true);
      });

      clearFirmaBtn?.classList.add('d-none');

      console.info('[Visualizar] OK', j);
    } catch (e) {
      console.error('[Visualizar] Excepción', e);
      await errbox('Error', 'No se pudo cargar el consentimiento para visualizar.');
    }
  }


  // GO
  if (formularioIdQS) {
    cargarParaVisualizar(formularioIdQS);
  } else {
    if (!pacienteId) {
      warn('Falta el ID del paciente', 'Agrega ?paciente_id=<id> en la URL.');
    } else {
      cargarPacienteYPrefill();
    }
  }
});
