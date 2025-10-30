// public/js/receta.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('recetaForm');
  if (!form) return console.error('❌ No se encontró #recetaForm');

  // --- refs del DOM
  const nombreEl   = form.querySelector('[name="nombrePaciente"]');
  const fechaEl    = form.querySelector('[name="fecha"]'); // fecha de emisión (YYYY-MM-DD)
  const edadEl     = form.querySelector('[name="edad"]');
  const hiddenId   = document.getElementById('pacienteId');
  const tablaBody  = document.querySelector('#tablaMedicamentos tbody');
  const addBtn     = document.getElementById('addMedicamentoBtn');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnEnviar  = document.getElementById('btnEnviar');
  const canvas     = document.getElementById('signature-pad'); // firma (para PDF y visualizar)
  const btnClear   = document.getElementById('clearSignature-pad');

  // --- QueryString (nuevo o visualizar)
  const qs = new URLSearchParams(location.search);
  const pacienteIdQS   = qs.get('paciente_id') || qs.get('id');
  const formularioIdQS = qs.get('formulario_id');

  if (hiddenId && pacienteIdQS) hiddenId.value = pacienteIdQS;

  // --- Estado local: folio (formulario_id) guardado por paciente
  const SS_KEY   = (pid) => `receta:formId:${pid}`;
  const SAVE_KEY = (pid) => `receta:saved:${pid}`;
  let formularioId = formularioIdQS
    ? Number(formularioIdQS)
    : (pacienteIdQS ? Number(sessionStorage.getItem(SS_KEY(pacienteIdQS))) || null : null);

  // --- Canal para avisar al perfil (paciente.html) que refresque
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('recetas') : null;
  function notificarRecetaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now())); // dispara 'storage' en otras pestañas
      if (bc) bc.postMessage({ type: 'receta-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- Helpers de fecha
  const hoyISO = (() => {
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return iso;
  })();

  // --- auth headers (JWT)
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- Helpers varios
  function setInput(el, val) { if (el) el.value = val ?? ''; }

  // nombre desde objeto paciente (evita [object Object])
  function nombreDesdePaciente(p) {
    return [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim();
  }

  // Construye nombre desde respuesta /api/patients/:id (puede traer más apellidos)
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ').trim();

  const crearFila = () => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="form-control" name="medicamento[]"></td>
      <td><input type="text" class="form-control" name="dosis[]"></td>
      <td><input type="text" class="form-control" name="frecuencia[]"></td>
      <td><input type="text" class="form-control" name="duracion[]"></td>
      <td><input type="text" class="form-control" name="indicaciones[]"></td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-danger btn-delete-row">🗑️</button>
      </td>`;
    return tr;
  };

  // --- Firma: limpiar y leer base64 (para PDF)
  function clearCanvas(cnv = canvas) {
    if (!cnv) return;
    const ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
  }
  btnClear?.addEventListener('click', () => clearCanvas());

  function getFirmaBase64() {
    if (!canvas) return null;
    try {
      // Si está en blanco, retorna null
      const blank = document.createElement('canvas');
      blank.width = canvas.width; blank.height = canvas.height;
      if (canvas.toDataURL() === blank.toDataURL()) return null;
      return canvas.toDataURL('image/png');
    } catch { return null; }
  }

  // --- helpers nombre de archivo + descarga
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

  // --- Construir payload desde la UI (para guardar/pdf)
  const buildData = () => {
    const data = {
      pacienteId: pacienteIdQS || null,
      nombrePaciente: nombreEl?.value || '',
      fecha: fechaEl?.value || '',    // SOLO fecha de emisión YYYY-MM-DD
      edad:  edadEl?.value || '',
      nombreMedico: form.nombreMedico.value,
      cedula:       form.cedula.value,
      medicamentos: []
      // firmaMedico se agrega sólo al generar PDF
    };
    tablaBody.querySelectorAll('tr').forEach(fila => {
      data.medicamentos.push({
        nombre:       fila.querySelector('[name="medicamento[]"]')?.value || '',
        dosis:        fila.querySelector('[name="dosis[]"]')?.value || '',
        frecuencia:   fila.querySelector('[name="frecuencia[]"]')?.value || '',
        duracion:     fila.querySelector('[name="duracion[]"]')?.value || '',
        indicaciones: fila.querySelector('[name="indicaciones[]"]')?.value || ''
      });
    });
    return data;
  };

  // =========================================================
  //                 MODO NUEVO (paciente_id)
  // =========================================================
  async function cargarPaciente() {
    if (!pacienteIdQS) return;
    try {
      const res = await fetch(`/api/patients/${pacienteIdQS}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      if (nombreEl) nombreEl.value = buildNombre(p) || '';
      if (edadEl)   edadEl.value   = (p?.edad != null) ? `${p.edad} años` : '— años';
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la información del paciente.' });
    }
  }

  // Inicializa fecha para modo NUEVO (hoy). En visualizar se sobrescribe.
  if (fechaEl && !formularioIdQS) {
    fechaEl.value = hoyISO;
    fechaEl.readOnly = true;
    fechaEl.min = hoyISO;
    fechaEl.max = hoyISO;
  }

  // Bloquea edición de nombre/edad (siempre son de sólo lectura en tu flujo)
  [nombreEl, edadEl].forEach(el => el && (el.readOnly = true));

  // =========================================================
  //                 MODO VISUALIZAR (formulario_id)
  // =========================================================
  async function drawSignatureIfAny(cnv, firmaPath) {
    if (!cnv) return;
    const ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    if (!firmaPath) return; // queda en blanco si no hay firma
    await new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(cnv.width / img.width, cnv.height / img.height);
        const w = img.width * scale, h = img.height * scale;
        const x = (cnv.width - w)/2, y = (cnv.height - h)/2;
        ctx.drawImage(img, x, y, w, h);
        resolve();
      };
      img.src = firmaPath.startsWith('/') ? firmaPath : `/visualizador/uploads/${firmaPath}`;
    });
  }
  // ✅ Normaliza un renglón de medicamento a un mismo esquema
  function normMed(m = {}) {
    return {
      medicamento: m.medicamento ?? m.nombre ?? m.nombre_medicamento ?? m.drug ?? '',
      dosis:       m.dosis ?? m.dose ?? '',
      frecuencia:  m.frecuencia ?? m.freq ?? m.frecuencia_texto ?? '',
      duracion:    m.duracion ?? m.dias ?? m.duracion_dias ?? '',
      indicaciones:m.indicaciones ?? m.indicacion ?? m.notas ?? ''
    };
  }
  // ✅ Pinta la tabla usando el esquema normalizado
  function renderMedicamentos(tbody, meds = []) {
    tbody.innerHTML = '';

    if (!Array.isArray(meds) || meds.length === 0) {
      tbody.appendChild(crearFila());
      return;
    }

    meds.forEach(raw => {
      const m = normMed(raw);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><input type="text" class="form-control" name="medicamento[]" value="${m.medicamento}"></td>
        <td><input type="text" class="form-control" name="dosis[]" value="${m.dosis}"></td>
        <td><input type="text" class="form-control" name="frecuencia[]" value="${m.frecuencia}"></td>
        <td><input type="text" class="form-control" name="duracion[]" value="${m.duracion}"></td>
        <td><input type="text" class="form-control" name="indicaciones[]" value="${m.indicaciones}"></td>
        <td class="text-center">
          <button type="button" class="btn btn-sm btn-outline-danger btn-delete-row">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }


  async function populateFromDetalle(raw) {
    // Nombre (evita [object Object])
    const nombre =
      nombreDesdePaciente(raw.paciente) ||
      (typeof raw.nombrePaciente === 'string' ? raw.nombrePaciente : '') ||
      '—';
    setInput(nombreEl, nombre);

    // Fecha sólo YYYY-MM-DD
    const fecha = (raw.fecha || '').slice(0, 10);
    setInput(fechaEl, fecha);

    // Edad: usa edad_anios o paciente.edad
    const edadNum = (raw.edad_anios ?? raw?.paciente?.edad ?? null);
    setInput(edadEl, (edadNum != null) ? `${edadNum} años` : '— años');

    // Medicamentos
    renderMedicamentos(tablaBody, raw.medicamentos || []);

    // Firma
    await drawSignatureIfAny(canvas, raw.firma_path);
  }

  async function cargarParaVisualizar(formId) {
    try {
      const res = await fetch(`/api/patients/forms/receta/${encodeURIComponent(formId)}`, {
        headers: { 'Accept':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await populateFromDetalle(json);
    } catch (e) {
      console.error('No se pudo visualizar la receta:', e);
      Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la receta para visualizar.' });
    }
  }

  // =========================================================
  //                   LISTENERS DE LA UI
  // =========================================================
  addBtn?.addEventListener('click', () => {
    tablaBody.appendChild(crearFila());
    Swal.fire({ icon:'success', title:'Medicamento agregado', timer:900, showConfirmButton:false });
  });

  tablaBody.addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete-row')) {
      const tr = e.target.closest('tr');
      if (tablaBody.rows.length === 1) tr.querySelectorAll('input').forEach(i => (i.value = ''));
      else tr.remove();
      Swal.fire({ icon:'info', title:'Fila eliminada', timer:800, showConfirmButton:false });
    }
  });

  // --- guardar receta en BD (SIN firma)
  async function guardarRecetaEnBD() {
    const data = buildData();
    const pacienteId = pacienteIdQS;

    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID no encontrado', text:'La URL debe incluir ?paciente_id=<id>' });
      return null;
    }
    if (!data.medicamentos.length || !data.medicamentos.some(m => m.nombre?.trim())) {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'Agrega al menos un medicamento.' });
      return null;
    }

    // Si ya existe folio, confirma si deseas crear OTRA receta nueva
    if (formularioId && !formularioIdQS) {
      const r = await Swal.fire({
        title: `Esta receta ya fue guardada (folio ${formularioId}).`,
        text: '¿Deseas guardar otra receta nueva con estos datos?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear otra',
        cancelButtonText: 'Cancelar'
      });
      if (!r.isConfirmed) return null;
    }

    btnGuardar && (btnGuardar.disabled = true);

    try {
      const res = await fetch(`/api/patients/${pacienteId}/recetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data) // SIN firma
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;

      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarRecetaGuardada(pacienteId, formularioId);
      }

      await Swal.fire({ icon:'success', title:'Guardado', text:`Folio: ${formularioId ?? '—'}` });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar receta:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar la receta.' });
      return null;
    } finally {
      btnGuardar && (btnGuardar.disabled = false);
    }
  }

  btnGuardar?.addEventListener('click', guardarRecetaEnBD);

  btnEnviar?.addEventListener('click', async () => {
    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la receta',
        text: 'Para poder enviar, guarda la receta y obtén un folio.',
        icon: 'info',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    // Simulación de envío (ajusta a tu endpoint cuando lo tengas)
    await new Promise(r => setTimeout(r, 500));
    await Swal.fire({ icon:'success', title:'Receta enviada', text:`Folio ${formularioId}` });
  });

  // --- Generar PDF (usa datos actuales; añade firma SOLO para PDF)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la receta',
        text: 'Para generar el PDF necesitas guardar la receta y obtener un folio.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo desde aquí con un nombre sugerido.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const data = buildData();
    const firma = getFirmaBase64(); // sólo para PDF (puede ser null si está en blanco)
    if (firma) data.firmaMedico = firma;
    data.formularioId = formularioId; // folio para el PDF

    try {
      const res = await fetch('/api/pdf/receta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();

      // Ver en otra pestaña
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      // Sugerir descarga
      const fullName = (nombreEl?.value || '').trim();
      const fecha    = fechaEl?.value || hoyISO;
      const filename = buildFilename({ fecha, formKey: 'receta', fullName });

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
    } catch (err) {
      console.error('Error al generar PDF:', err);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo generar el PDF.' });
    }
  });

  // =========================================================
  //        Flujo de inicio según QS (nuevo vs visualizar)
  // =========================================================
  if (formularioIdQS) {
    // Ocultar botones para no editar ni agregar
    btnGuardar?.classList.add("d-none");
    addBtn?.classList.add("d-none");
    btnClear?.classList.add("d-none");

    // Bloquear inputs del formulario (incluye edad, nombre, cedula, medico)
    form.querySelectorAll("input, textarea, select").forEach(el => {
      el.setAttribute("readonly", true);
      el.setAttribute("disabled", true);
    });

    // PERMITIR SOLO botones de Enviar y Generar PDF
    btnEnviar?.removeAttribute("disabled");
    form.querySelector('[type="submit"]')?.removeAttribute("disabled");

    // Bloquear tabla de medicamentos después de pintar filas
    await cargarParaVisualizar(formularioIdQS);

    // Ahora sí, deshabilitar inputs de medicamentos
    tablaBody.querySelectorAll("input").forEach(input => {
      input.setAttribute("readonly", true);
      input.classList.add("bg-light");
    });

    // Ocultar botones eliminar fila
    tablaBody.querySelectorAll(".btn-delete-row").forEach(btn => btn.style.display = "none");
  }else if (pacienteIdQS) {
    // Nuevo (precarga paciente y deja fecha=HOY)
    await cargarPaciente();
  }
});
