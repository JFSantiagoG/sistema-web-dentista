// public/js/consent-quiro.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Auth básica
  const token  = localStorage.getItem('token');
  const roles  = JSON.parse(localStorage.getItem('roles') || '[]');
  if (!token || roles.length === 0) { location.href = '/login.html'; return; }
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // --- Refs DOM
  const form = document.getElementById('consentForm');

  // Paso 1 (captura)
  const pacienteNombreEl  = document.getElementById('pacienteNombre');
  const pacienteIdEl      = document.getElementById('pacienteId');
  const fechaInput        = document.getElementById('fechaRegistroInput');
  const numeroPacienteEl  = document.getElementById('numeroPacienteInput');

  const pronosticoInput   = document.getElementById('pronosticoInput');
  const condicionesInput  = document.getElementById('condicionesInput');
  const recuperacionInput = document.getElementById('recuperacionInput');
  const acuerdoInput      = document.getElementById('acuerdoInput');

  // Paso 2 (confirmación)
  const confirmNombreEl    = document.getElementById('confirmNombrePaciente');
  const confirmFechaEl     = document.getElementById('confirmFecha');
  const confirmNumeroEl    = document.getElementById('confirmNumeroPaciente');
  const confirmPronEl      = document.getElementById('confirmPronostico');
  const confirmCondEl      = document.getElementById('confirmCondiciones');
  const confirmRecupSpan   = document.getElementById('confirmRecuperacion');
  const confirmAcuerdoSpan = document.getElementById('confirmAcuerdo');

  // Checkboxes
  const historiaCheck       = document.getElementById('historiaCheck');
  const anestesiaCheck      = document.getElementById('anestesiaCheck');
  const pronosticoCheck     = document.getElementById('pronosticoCheck');
  const recuperacionCheck   = document.getElementById('recuperacionCheck');
  const responsabilidadCheck= document.getElementById('responsabilidadCheck');
  const economicoCheck      = document.getElementById('economicoCheck');

  // Firmas
  const canvasPac = document.getElementById('signature-pad-paciente');
  const canvasMed = document.getElementById('signature-pad-medico');
  const clearPac  = document.getElementById('clearSignature-pad-paciente');
  const clearMed  = document.getElementById('clearSignature-pad-medico');

  // Botones
  const btnNext  = document.getElementById('btnNext');
  const btnBack  = document.getElementById('btnBack');
  const btnDraft = document.getElementById('btnBorrador');
  const btnPDF   = document.getElementById('btnPDF');

  // Secciones
  const step1 = document.getElementById('doctor-step');
  const step2 = document.getElementById('patient-step');
  const ind1  = document.getElementById('step1-indicator');
  const ind2  = document.getElementById('step2-indicator');

  // --- Utils
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');

  const hoyISO = (() => {
    const now = new Date();
    const tzo = now.getTimezoneOffset() * 60000;
    return new Date(now - tzo).toISOString().slice(0, 10);
  })();

  // Helpers nombre/filename
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
    const now = new Date();
    const tzo = now.getTimezoneOffset() * 60000;
    return new Date(now - tzo).toISOString().slice(0,10).replaceAll('-', '');
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

  // --- Carga paciente por ID
  async function cargarPaciente() {
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'Falta paciente', text:'La URL debe incluir ?paciente_id=<id>' });
      return;
    }
    try {
      pacienteIdEl.value = pacienteId;
      numeroPacienteEl.value = pacienteId;
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      const nombre = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');
      pacienteNombreEl.value = nombre || '—';
    } catch (err) {
      console.error('Error cargando paciente:', err);
      pacienteNombreEl.value = '(no disponible)';
    }
  }

  function setFechaHoy() {
    fechaInput.value = hoyISO;
    fechaInput.min   = hoyISO;
    fechaInput.max   = hoyISO;
  }

  // --- Firmas (leyenda dentro del canvas)
  function initSignaturePad(canvas) {
    if (!canvas) return { getB64: () => null, clear: () => {} };
    const ctx = canvas.getContext('2d');
    let drawing = false, started = false;
    let last = { x: 0, y: 0 };

    function drawLegend() {
      ctx.save();
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      const txt = 'Haz click aquí para firmar';
      ctx.fillStyle = '#6c757d';
      ctx.font = '14px sans-serif';
      const tw = ctx.measureText(txt).width;
      ctx.fillText(txt, (canvas.width - tw) / 2, canvas.height / 2);
      ctx.restore();
    }
    drawLegend();

    function pos(evt) {
      const r = canvas.getBoundingClientRect();
      const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left;
      const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - r.top;
      return { x, y };
    }
    function down(e) {
      e.preventDefault?.();
      if (!started) { ctx.clearRect(0,0,canvas.width,canvas.height); started = true; }
      drawing = true;
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
      ctx.strokeStyle = '#000';
      ctx.stroke();
      last = p;
    }
    function up() { drawing = false; }

    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup',   up);
    canvas.addEventListener('mouseleave',up);

    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove',  move, { passive: false });
    canvas.addEventListener('touchend',   up,   { passive: false });

    function isBlank() {
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
      return true;
    }
    function getB64() {
      if (!started || isBlank()) return null;
      return canvas.toDataURL('image/png');
    }
    function clear() {
      started = false;
      drawLegend();
    }
    canvas.style.cursor = 'crosshair';
    return { getB64, clear };
  }

  const sigPac = initSignaturePad(canvasPac);
  const sigMed = initSignaturePad(canvasMed);
  clearPac?.addEventListener('click', sigPac.clear);
  clearMed?.addEventListener('click', sigMed.clear);

  // --- Navegación pasos
  function goStep2() {
    if (!pacienteNombreEl.value || !fechaInput.value || !numeroPacienteEl.value) {
      Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa nombre, fecha y número de paciente.' });
      return;
    }
    if (!pronosticoInput.value || !condicionesInput.value || !recuperacionInput.value || !acuerdoInput.value) {
      Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa pronóstico, condiciones, recuperación y acuerdo.' });
      return;
    }

    // Copy → Confirmación
    confirmNombreEl.value     = pacienteNombreEl.value;
    confirmFechaEl.value      = fechaInput.value;
    confirmNumeroEl.value     = numeroPacienteEl.value;
    confirmPronEl.value       = pronosticoInput.value;
    confirmCondEl.value       = condicionesInput.value;
    confirmRecupSpan.textContent   = recuperacionInput.value;
    confirmAcuerdoSpan.textContent = acuerdoInput.value;

    step1.style.display = 'none';
    step2.style.display = 'block';
    ind1.classList.remove('active');
    ind2.classList.add('active');
  }
  function backStep1() {
    step2.style.display = 'none';
    step1.style.display = 'block';
    ind2.classList.remove('active');
    ind1.classList.add('active');
  }
  btnNext?.addEventListener('click', goStep2);
  btnBack?.addEventListener('click', backStep1);

  // --- Armado payload BD (sin firmas)
  function buildPayloadBD() {
    return {
      fecha: fechaInput.value,
      numero_paciente: numeroPacienteEl.value || String(pacienteId),
      pronostico: pronosticoInput.value,
      condiciones_posop: condicionesInput.value,
      recuperacion_dias: Number(recuperacionInput.value || 0),

      historia_aceptada:        !!historiaCheck.checked,
      anestesia_consentida:     !!anestesiaCheck.checked,
      pronostico_entendido:     !!pronosticoCheck.checked,
      recuperacion_entendida:   !!recuperacionCheck.checked,
      responsabilidad_aceptada: !!responsabilidadCheck.checked,
      economico_aceptado:       !!economicoCheck.checked,

      acuerdo_economico: acuerdoInput.value
    };
  }

  // --- Guardar (borrador) → BD
  btnDraft?.addEventListener('click', async () => {
    if (!pacienteId) return Swal.fire({ icon:'warning', title:'Falta paciente', text:'?paciente_id en URL' });
    const body = buildPayloadBD();

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-quiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      console.log('📩 POST /patients/:id/consent-quiro');
      console.log('Body:', body);
      console.log('✔️ Guardado BD (consent-quiro):', json);

      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${json.formulario_id}` });
    } catch (err) {
      console.error('Error guardando consentimiento:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar (ver consola).' });
    }
  });

  // --- Submit (por ahora: guarda y simula envío)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pacienteId) return Swal.fire({ icon:'warning', title:'Falta paciente', text:'?paciente_id en URL' });
    const body = buildPayloadBD();

    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-quiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      console.log('✔️ Enviar (guardado previo):', json);
      await Swal.fire({ icon:'success', title:'Formulario enviado', text:'(Simulado) Enviado al paciente.' });
    } catch (err) {
      console.error('Error en enviar (guardar primero):', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo enviar (ver consola).' });
    }
  });

  // --- Generar PDF (con firmas base64; no se guardan en BD)
  btnPDF?.addEventListener('click', async () => {
    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo desde aquí.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const dataPDF = {
      paciente: {
        nombre: (confirmNombreEl.value || pacienteNombreEl.value || ''),
        fecha:  (confirmFechaEl.value  || fechaInput.value || hoyISO),
        numeroPaciente: (confirmNumeroEl.value || numeroPacienteEl.value || String(pacienteId || ''))
      },
      historiaClinica:      !!historiaCheck.checked,
      anestesia:            !!anestesiaCheck.checked,
      pronostico:            (confirmPronEl.value || pronosticoInput.value || ''),
      condiciones:           (confirmCondEl.value || condicionesInput.value || ''),
      pronosticoAceptado:   !!pronosticoCheck.checked,
      recuperacion:          (confirmRecupSpan.textContent || recuperacionInput.value || ''),
      recuperacionAceptada: !!recuperacionCheck.checked,
      responsabilidad:      !!responsabilidadCheck.checked,
      acuerdo:               (confirmAcuerdoSpan.textContent || acuerdoInput.value || ''),
      acuerdoAceptado:      !!economicoCheck.checked,

      firmaPaciente: (typeof sigPac.getB64 === 'function') ? sigPac.getB64() : null,
      firmaMedico:   (typeof sigMed.getB64 === 'function') ? sigMed.getB64() : null
    };

    try {
      const res = await fetch('/api/pdf/quirurgico/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataPDF)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // Ver en otra pestaña
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // Botón para descargar con nombre sugerido
      const fullName = dataPDF.paciente.nombre || '';
      const fecha    = dataPDF.paciente.fecha || hoyISO;
      const filename = buildFilename({ fecha, formKey: 'consent_quiro', fullName });

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

      URL.revokeObjectURL(viewUrl);

      // Logs de tamaños de firmas (KB)
      const sizePac = dataPDF.firmaPaciente ? Math.round((dataPDF.firmaPaciente.length * 3 / 4) / 1024) : 0;
      const sizeMed = dataPDF.firmaMedico ? Math.round((dataPDF.firmaMedico.length * 3 / 4) / 1024) : 0;
      console.log(`🖊️ Firma paciente: ${sizePac} KB | 🖊️ Firma médico: ${sizeMed} KB`);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  });

  // --- Init
  setFechaHoy();
  cargarPaciente();
});
