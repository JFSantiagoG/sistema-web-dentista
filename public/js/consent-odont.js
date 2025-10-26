// public/js/consent-odont.js
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token') || '';
  const authHeaders = token ? { Authorization: `Bearer ${token}`, Accept: 'application/json' } : {};

  // --- refs
  const form = document.getElementById('consentForm');

  // Paso 1 (captura)
  const pacienteSelect       = document.getElementById('pacienteSelect');   // oculto, compat
  const nombreVis            = document.getElementById('nombrePacienteVisible'); // visible, readonly (si existe)
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

  // --- paciente_id desde URL
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');

  // --- util
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
  async function err(t, m)   { return hasSwal ? Swal.fire({icon:'error',   title:t, text:m})    : alert(`${t}\n${m||''}`); }
  async function warn(t, m)  { return hasSwal ? Swal.fire({icon:'warning', title:t, text:m})    : alert(`${t}\n${m||''}`); }

  // Nombre de archivo sugerido
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

  // ====== Init firma con leyenda interna ======
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
  const sigPaciente = initSignaturePad(canvasFirma);
  clearFirmaBtn?.addEventListener('click', sigPaciente.clear);

  // --- cargar paciente + prefills
  async function cargarPacienteYPrefill() {
    if (!pacienteId) {
      await warn('Falta el ID del paciente', 'Agrega ?paciente_id=<id> en la URL.');
      return;
    }
    // Fecha = HOY (readonly)
    if (fechaInput) {
      const iso = todayISO();
      fechaInput.value = iso;
      fechaInput.readOnly = true;
      fechaInput.min = iso;
      fechaInput.max = iso;
    }
    // Número de paciente = id
    if (numeroPacienteInput) {
      numeroPacienteInput.value = String(pacienteId);
      numeroPacienteInput.readOnly = true;
    }

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, {
        headers: authHeaders
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = buildNombre(p) || '(Sin nombre)';

      // Visible (si existe campo visible)
      if (nombreVis) nombreVis.value = nombre;

      // Select oculto (para compatibilidad con tu showPatientStep)
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
      await err('Error', 'No se pudo cargar el paciente.');
    }
  }

  // --- navegación pasos (expuestas global)
  window.showPatientStep = function showPatientStep() {
    const nombrePaciente = (function() {
      if (pacienteSelect && pacienteSelect.selectedIndex >= 0) {
        return pacienteSelect.options[pacienteSelect.selectedIndex].text;
      }
      return nombreVis?.value || '';
    })();

    const fecha = fechaInput?.value || todayISO();
    const numero = numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = tratInput?.value || '';
    const monto = (montoInput?.value ?? '').trim();
    const ausenciaDias = (ausenInput?.value ?? '').trim();

    if (!nombrePaciente || !fecha || !tratamiento || monto === '' || ausenciaDias === '') {
      Swal?.fire?.({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa nombre, fecha, tratamiento, monto y ausencia.',
      }) || alert('Faltan datos: nombre, fecha, tratamiento, monto y ausencia.');
      return;
    }

    // Pasar valores a paso 2
    if (confirmNombre) confirmNombre.value = nombrePaciente;
    if (confirmFecha)  confirmFecha.value  = fecha;
    if (confirmNum)    confirmNum.value    = numero;
    if (confirmTrat)   confirmTrat.value   = tratamiento;
    if (confirmMonto)  confirmMonto.textContent = monto || '0.00';
    if (confirmAus)    confirmAus.textContent   = ausenciaDias || '0';

    // Mostrar paso 2
    if (step1) step1.style.display = 'none';
    if (step2) step2.style.display = 'block';
    ind1?.classList.remove('active');
    ind2?.classList.add('active');
  };

  window.showDoctorStep = function showDoctorStep() {
    if (step2) step2.style.display = 'none';
    if (step1) step1.style.display = 'block';
    ind2?.classList.remove('active');
    ind1?.classList.add('active');
  };

  // --- submit: guardar en BD (SIN firma)
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nombrePaciente = confirmNombre?.value || nombreVis?.value || '';
    const fecha = confirmFecha?.value || fechaInput?.value || todayISO();
    const numero = confirmNum?.value || numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = confirmTrat?.value || tratInput?.value || '';
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
      fecha,
      numero_paciente: numero,
      tratamiento,
      monto,
      ausencia_dias: ausenciaDias,
      autorizacion,
      economico,
      ausencia
      // sin firma en BD por ahora
    };

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-odont`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      await ok('Guardado', `Folio ${json.formulario_id ?? '—'} creado correctamente`);
    } catch (err) {
      console.error('Error al guardar consentimiento:', err);
      await err('Error', 'No se pudo guardar el consentimiento.');
    }
  });

  // --- Descargar PDF (con firma SOLO para el PDF): abrir en otra pestaña + botón de descarga
  document.querySelector('.btn-info')?.addEventListener('click', async () => {
    const nombre = confirmNombre?.value || nombreVis?.value || '';
    const fecha  = confirmFecha?.value  || fechaInput?.value || todayISO();
    const numero = confirmNum?.value    || numeroPacienteInput?.value || String(pacienteId);
    const tratamiento = confirmTrat?.value || tratInput?.value || '';
    const monto = (confirmMonto?.textContent ?? montoInput?.value ?? '').trim();
    const ausencia = (confirmAus?.textContent ?? ausenInput?.value ?? '').trim();

    // firma del paciente SOLO para PDF
    const firmaPaciente = sigPaciente.getB64();

    if (!nombre || !fecha || !tratamiento || monto === '' || ausencia === '') {
      await warn('Faltan datos', 'Completa la información para el PDF.');
      return;
    }

    // Aviso: se abrirá en otra pestaña
    await info('Se abrirá el PDF en otra pestaña', 'Al regresar, podrás descargarlo con un nombre sugerido.');

    try {
      const res = await fetch('/api/pdf/consentimiento/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paciente: { nombre, fecha, numeroPaciente: numero },
          tratamiento,
          monto,
          ausencia,
          firmaPaciente // no se guarda en BD
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // Abrir para visualizar
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // Sugerir descarga con nombre: YYYYMMDD_consent-odont_Nombre_Apellido.pdf
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
      await err('Error', 'No se pudo generar el PDF.');
    }
  });

  // botón limpiar firma (por si SweetAlert/firma.js no lo gestiona)
  clearFirmaBtn?.addEventListener('click', sigPaciente.clear);

  // GO
  cargarPacienteYPrefill();
});
