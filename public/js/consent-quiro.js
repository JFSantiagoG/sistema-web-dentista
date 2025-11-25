// public/js/consent-quiro.js
document.addEventListener('DOMContentLoaded', () => {
  // --- Auth básica
  const token  = localStorage.getItem('token');
  const roles  = JSON.parse(localStorage.getItem('roles') || '[]');
  if (!token || roles.length === 0) { location.href = '/login.html'; return; }
  const authHeaders = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

  // 🔹 Prefijo PÚBLICO donde sirves las firmas (mismo que uses en receta)
  const FIRMAS_BASE_URL = '/api/patients/uploads';

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
  const historiaCheck        = document.getElementById('historiaCheck');
  const anestesiaCheck       = document.getElementById('anestesiaCheck');
  const pronosticoCheck      = document.getElementById('pronosticoCheck');
  const recuperacionCheck    = document.getElementById('recuperacionCheck');
  const responsabilidadCheck = document.getElementById('responsabilidadCheck');
  const economicoCheck       = document.getElementById('economicoCheck');

  // Firmas (para BD + PDF)
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

  // QS
  const qs = new URLSearchParams(location.search);
  const pacienteId     = qs.get('paciente_id') || qs.get('id');
  const formularioIdQS = qs.get('formulario_id') || null;

  // Fecha hoy (ISO)
  const hoyISO = (() => {
    const now = new Date();
    const tzo = now.getTimezoneOffset() * 60000;
    return new Date(now - tzo).toISOString().slice(0, 10);
  })();

  // Helpers nombre/filename
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

  // ====== Firma simple con leyenda (clic para dibujar) ======
  function initSignaturePad(canvasEl) {
    if (!canvasEl) {
      return {
        getB64: () => null,
        clear: () => {},
        loadFromUrl: () => {},
        setReadOnly: () => {}
      };
    }
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

    let drawing = false;
    let started = false;
    let last = { x: 0, y: 0 };
    let readOnly = false; // 👈 modo sólo lectura

    function pos(evt) {
      const r = canvasEl.getBoundingClientRect();
      const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - r.left;
      const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - r.top;
      return { x, y };
    }
    function down(e) {
      if (readOnly) return;              // ⛔ no permitir dibujar en modo visualización
      e.preventDefault?.();
      drawing = true;
      if (!started) {
        started = true;
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      }
      last = pos(e);
    }
    function move(e) {
      if (readOnly) return;              // ⛔ no permitir dibujar
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

    canvasEl.addEventListener('touchstart', down, { passive: false });
    canvasEl.addEventListener('touchmove',  move, { passive: false });
    canvasEl.addEventListener('touchend',   up,   { passive: false });

    canvasEl.style.cursor = 'crosshair';

    function isBlank() {
      const { data } = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false;
      }
      return true;
    }
    function getB64() {
      // Si tiene algo dibujado (mano o imagen), regresamos base64
      if (!started && isBlank()) return null;
      if (isBlank()) return null;
      return canvasEl.toDataURL('image/png');
    }
    function clear() {
      if (readOnly) return; // ⛔ no permitir borrar en modo visualización
      started = false;
      drawLegend();
    }

    // cargar imagen desde URL y marcar started = true
    function loadFromUrl(url) {
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        const scale = Math.min(canvasEl.width / img.width, canvasEl.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvasEl.width - w) / 2;
        const y = (canvasEl.height - h) / 2;
        ctx.drawImage(img, x, y, w, h);
        started = true; // 👈 importante para que getB64 no devuelva null
      };
      img.onerror = () => {
        console.error('No se pudo cargar la firma desde:', url);
      };
      img.src = url;
    }

    function setReadOnly(v) {
      readOnly = !!v;
      canvasEl.style.cursor = readOnly ? 'default' : 'crosshair';
    }

    return { getB64, clear, loadFromUrl, setReadOnly };
  }

  const sigPac = initSignaturePad(canvasPac);
  const sigMed = initSignaturePad(canvasMed);
  clearPac?.addEventListener('click', sigPac.clear);
  clearMed?.addEventListener('click', sigMed.clear);

  // --- Carga paciente por ID (modo nuevo)
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
      const nombre = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
        .filter(Boolean).join(' ').trim();
      pacienteNombreEl.value = nombre || '—';
    } catch (err) {
      console.error('Error cargando paciente:', err);
      pacienteNombreEl.value = '(no disponible)';
    }
  }
  function setFechaHoy() {
    fechaInput.value = hoyISO;
    fechaInput.readOnly = true;
    fechaInput.min = hoyISO;
    fechaInput.max = hoyISO;
  }

  // ====== Navegación de pasos
  function goStep2() {
    if (!pacienteNombreEl.value || !fechaInput.value || !numeroPacienteEl.value) {
      Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa nombre, fecha y número de paciente.' });
      return;
    }
    if (!pronosticoInput.value || !condicionesInput.value || !recuperacionInput.value || !acuerdoInput.value) {
      Swal.fire({ icon:'warning', title:'Faltan datos', text:'Completa pronóstico, condiciones, recuperación y acuerdo.' });
      return;
    }
    confirmNombreEl.value          = pacienteNombreEl.value;
    confirmFechaEl.value           = fechaInput.value;
    confirmNumeroEl.value          = numeroPacienteEl.value;
    confirmPronEl.value            = pronosticoInput.value;
    confirmCondEl.value            = condicionesInput.value;
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

  // ====== Payload BD (incluye firmas ahora) ======
  function buildPayloadBD() {
    const payload = {
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

    // 🔥 Firmas para BD (el backend decide si las guarda)
    const b64Pac = (typeof sigPac.getB64 === 'function') ? sigPac.getB64() : null;
    if (b64Pac) payload.firmaPacienteBase64 = b64Pac;

    const b64Med = (typeof sigMed.getB64 === 'function') ? sigMed.getB64() : null;
    if (b64Med) payload.firmaMedicoBase64 = b64Med;

    return payload;
  }

  // ====== Guardar (borrador) → BD
  btnDraft?.addEventListener('click', async () => {
    if (!pacienteId) {
      return Swal.fire({ icon:'warning', title:'Falta paciente', text:'?paciente_id en URL' });
    }
    const body = buildPayloadBD();
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-quiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${json.formulario_id}` });
    } catch (err) {
      console.error('Error guardando consentimiento:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar (ver consola).' });
    }
  });

  // ====== Submit (simulado; no re-guarda en visualizar)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formularioIdQS) {
      await Swal.fire({ icon:'success', title:'Formulario enviado', text:'(Simulado) Enviado al paciente.' });
      return;
    }
    if (!pacienteId) {
      return Swal.fire({ icon:'warning', title:'Falta paciente', text:'?paciente_id en URL' });
    }
    const body = buildPayloadBD();
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/consent-quiro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await Swal.fire({ icon:'success', title:'Formulario enviado', text:'(Simulado) Enviado al paciente.' });
    } catch (err) {
      console.error('Error en enviar (guardar primero):', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo enviar (ver consola).' });
    }
  });

  // ====== PDF (con firmas base64 solo para PDF)
  btnPDF?.addEventListener('click', async () => {
    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo con nombre sugerido.',
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

      // 🔥 Aquí ya funciona tanto si viene de canvas como de archivo cargado
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
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

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
      }).then((r) => { if (r.isConfirmed) downloadBlob(blob, filename); });

      URL.revokeObjectURL(viewUrl);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  });

  // ====== VISUALIZAR (solo lectura, pero mostrando firmas guardadas)
  async function cargarParaVisualizar(formularioId) {
    const url = `/api/patients/forms/consent-quiro/${encodeURIComponent(formularioId)}`;
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', Authorization: `Bearer ${token}` }
      });
      const raw = await res.text();
      if (!res.ok) {
        console.error('[Visualizar] HTTP ' + res.status, raw);
        let msg = `HTTP ${res.status}`;
        try {
          const jErr = JSON.parse(raw);
          msg += ` – ${jErr.error || jErr.message || 'Error'}`;
        } catch {}
        await Swal.fire({ icon:'error', title:'No se pudo cargar', text: msg });
        return;
      }

      let j = {};
      try { j = JSON.parse(raw); } catch {
        await Swal.fire({icon:'error',title:'Error',text:'Respuesta inválida del servidor.'});
        return;
      }

      const nombre = j?.paciente?.nombre_completo || '(Sin nombre)';
      const fecha  = (j?.fecha || '').slice(0,10) || hoyISO;
      const numero = j?.numero_paciente || (j?.paciente?.id ? String(j.paciente.id) : '');

      // Paso 1 visibles
      pacienteNombreEl.value = nombre;
      fechaInput.value       = fecha;
      numeroPacienteEl.value = numero;

      // Paso 2
      confirmNombreEl.value = nombre;
      confirmFechaEl.value  = fecha;
      confirmNumeroEl.value = numero;

      confirmPronEl.value   = j?.pronostico || '';
      confirmCondEl.value   = j?.condiciones_posop || '';
      confirmRecupSpan.textContent   = (j?.recuperacion_dias != null ? String(j.recuperacion_dias) : '0');
      confirmAcuerdoSpan.textContent = j?.acuerdo_economico || '';

      // Checkboxes
      historiaCheck.checked        = !!j?.historia_aceptada;
      anestesiaCheck.checked       = !!j?.anestesia_consentida;
      pronosticoCheck.checked      = !!j?.pronostico_entendido;
      recuperacionCheck.checked    = !!j?.recuperacion_entendida;
      responsabilidadCheck.checked = !!j?.responsabilidad_aceptada;
      economicoCheck.checked       = !!j?.economico_aceptado;

      // 🔥 Cargar firmas guardadas en los canvas (si existen)
      if (j.firma_path_paciente) {
        const urlFirmaPac = `${FIRMAS_BASE_URL}/${j.firma_path_paciente}`;
        sigPac.loadFromUrl?.(urlFirmaPac);
      }
      if (j.firma_path_medico) {
        const urlFirmaMed = `${FIRMAS_BASE_URL}/${j.firma_path_medico}`;
        sigMed.loadFromUrl?.(urlFirmaMed);
      }

      // 👉 Poner firmas en SOLO LECTURA y ocultar botones de limpiar
      sigPac.setReadOnly?.(true);
      sigMed.setReadOnly?.(true);
      if (clearPac) {
        clearPac.classList.add('d-none');
        clearPac.setAttribute('disabled', 'true');
      }
      if (clearMed) {
        clearMed.classList.add('d-none');
        clearMed.setAttribute('disabled', 'true');
      }

      // Mostrar paso 2
      step1.style.display = 'none';
      step2.style.display = 'block';
      ind1.classList.remove('active');
      ind2.classList.add('active');

      // Bloquear controles de captura/edición...
      btnDraft?.classList.add('d-none'); // ocultar Guardar Borrador
      btnNext?.classList.add('d-none');  // ocultar Siguiente
      btnBack?.classList.add('d-none');  // ocultar Volver

      // Deshabilitar inputs/checkboxes/selects y botones "step" (no PDF ni submit)
      form.querySelectorAll('input, textarea, select, button.btn-step').forEach(el => {
        if (el === btnPDF) return;               // permitir PDF
        if (el.type === 'submit') return;        // permitir Enviar (simulado)
        el.setAttribute('readonly', 'true');
        el.setAttribute('disabled', 'true');
      });

    } catch (e) {
      console.error('No se pudo visualizar consent-quiro:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el consentimiento para visualizar.' });
    }
  }

  // ====== Init (nuevo vs visualizar)
  (function init() {
    if (formularioIdQS) {
      cargarParaVisualizar(formularioIdQS);
    } else {
      setFechaHoy();
      cargarPaciente();
    }
  })();

});
