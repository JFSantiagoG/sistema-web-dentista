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
  const canvas     = document.getElementById('signature-pad'); // firma
  const btnClear   = document.getElementById('clearSignature-pad');
  const firmaImg   = document.getElementById('firmaRecetaImg'); // <img> para modo visualizar

  // 👇 base para archivos de firma a través del gateway
  const FIRMA_BASE_URL = '/api/patients/uploads';

  // --- QueryString (nuevo o visualizar)
  const qs = new URLSearchParams(location.search);
  const pacienteIdQS   = qs.get('paciente_id') || qs.get('id');
  const formularioIdQS = qs.get('formulario_id');

  if (hiddenId && pacienteIdQS) hiddenId.value = pacienteIdQS;

  // --- Estado local: folio
  const SS_KEY   = (pid) => `receta:formId:${pid}`;
  const SAVE_KEY = (pid) => `receta:saved:${pid}`;
  let formularioId = formularioIdQS
    ? Number(formularioIdQS)
    : (pacienteIdQS ? Number(sessionStorage.getItem(SS_KEY(pacienteIdQS))) || null : null);

  // --- Canal para avisar al perfil
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('recetas') : null;
  function notificarRecetaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now()));
      if (bc) bc.postMessage({ type: 'receta-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- Helpers fecha
  const hoyISO = (() => {
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return iso;
  })();

  // --- auth headers
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- Helpers varios
  function setInput(el, val) { if (el) el.value = val ?? ''; }

  function nombreDesdePaciente(p) {
    return [p?.nombre, p?.apellido].filter(Boolean).join(' ').trim();
  }

  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
      .filter(Boolean)
      .join(' ')
      .trim();

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

// --- Firma (para guardar / PDF)
async function getFirmaBase64() {
  // 1) INTENTAR PRIMERO DESDE LA IMAGEN (modo VISUALIZAR)
  if (firmaImg && firmaImg.src && firmaImg.style.display !== 'none') {
    try {
      console.log('[receta] intentando firma desde <img>', firmaImg.src);

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

        console.log('[receta] firma desde <img> (base64)', String(base64).slice(0, 80) + '...');
        return base64; // data:image/png;base64,...
      }
    } catch (e) {
      console.error('[getFirmaBase64] Error convirtiendo imagen:', e);
    }
  }

  // 2) Luego intentar desde un signaturePad global (modo NUEVO)
  if (typeof window.getSignaturePad === 'function') {
    const fromPad = window.getSignaturePad();
    if (fromPad) {
      console.log('[receta] firma desde signaturePad(global)', String(fromPad).slice(0, 80) + '...');
      return fromPad;
    }
  }

  // 3) Luego intentar desde el canvas (modo NUEVO, cuando no está oculto)
  if (canvas && !canvas.classList.contains('d-none')) {
    try {
      const dataUrl = canvas.toDataURL('image/png');
      console.log('[receta] firma desde canvas', dataUrl.slice(0, 80) + '...');
      return dataUrl;
    } catch (e) {
      console.warn('[getFirmaBase64] Error leyendo canvas:', e);
    }
  }

  console.log('[receta] getFirmaBase64 -> SIN firma');
  // 4) No hay firma
  return null;
}




  // --- helpers nombre archivo / descarga PDF
  function stripAccents(str = '') {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function firstAndLast(full = '') {
    const parts = (full || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { first: '', last: '' };
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

  // --- telefono helpers
  function normalizarTelefono(telefonoRaw) {
    if (!telefonoRaw) return null;
    const limpio = String(telefonoRaw).replace(/\D/g, '');
    if (limpio.length === 10) {
      return '52' + limpio; // MX nacional
    }
    if (limpio.length >= 11 && limpio.length <= 15) {
      return limpio; // ya con lada
    }
    return null;
  }

  function extraerTelefonoDeObjeto(p) {
    if (!p) return null;
    return (
      normalizarTelefono(p.telefono_principal) ||
      normalizarTelefono(p.telefono_secundario) ||
      normalizarTelefono(p.telefono) ||
      normalizarTelefono(p.celular) ||
      normalizarTelefono(p.whatsapp)
    );
  }

  async function setNumeroWhatsApp(btn, raw) {
    if (!btn) return;

    // 1) Intentar con datos del detalle
    let numero =
      extraerTelefonoDeObjeto(raw?.paciente) ||
      extraerTelefonoDeObjeto(raw) ||
      null;

    // 2) Si no hay, intentar con pacienteId del detalle o de la URL
    if (!numero) {
      const pid = raw?.paciente_id || pacienteIdQS || raw?.paciente?.id;
      if (pid) {
        try {
          const res = await fetch(`/api/patients/${pid}`, { headers: authHeaders });
          if (res.ok) {
            const p = await res.json();
            numero = extraerTelefonoDeObjeto(p);
          }
        } catch (e) {
          console.warn('No se pudo obtener teléfono desde /api/patients/', e);
        }
      }
    }

    if (numero) {
      btn.setAttribute('data-numero-paciente', numero);
    } else {
      btn.removeAttribute('data-numero-paciente');
    }
  }

  // --- Construir payload desde la UI (para guardar/pdf)
  const buildData = () => {
    const data = {
      pacienteId: pacienteIdQS || null,
      nombrePaciente: nombreEl?.value || '',
      fecha: fechaEl?.value || '',
      edad: edadEl?.value || '',
      nombreMedico: form.nombreMedico.value,
      cedula: form.cedula.value,
      medicamentos: []
    };
    tablaBody.querySelectorAll('tr').forEach(fila => {
      data.medicamentos.push({
        nombre: fila.querySelector('[name="medicamento[]"]')?.value || '',
        dosis: fila.querySelector('[name="dosis[]"]')?.value || '',
        frecuencia: fila.querySelector('[name="frecuencia[]"]')?.value || '',
        duracion: fila.querySelector('[name="duracion[]"]')?.value || '',
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
      if (edadEl) edadEl.value = (p?.edad != null) ? `${p.edad} años` : '— años';

      // Número WhatsApp en NUEVO
      await setNumeroWhatsApp(btnEnviar, p);
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la información del paciente.' });
    }
  }

  // Inicializa fecha para modo NUEVO (hoy). En visualizar se sobrescribe.
  if (fechaEl && !formularioIdQS) {
    fechaEl.value = hoyISO;
    fechaEl.readOnly = true;
    fechaEl.min = hoyISO;
    fechaEl.max = hoyISO;
  }

  // Nombre/edad siempre solo lectura
  [nombreEl, edadEl].forEach(el => el && (el.readOnly = true));

  // =========================================================
  //                 MODO VISUALIZAR (formulario_id)
  // =========================================================
  function normMed(m = {}) {
    return {
      medicamento: m.medicamento ?? m.nombre ?? m.nombre_medicamento ?? m.drug ?? '',
      dosis: m.dosis ?? m.dose ?? '',
      frecuencia: m.frecuencia ?? m.freq ?? m.frecuencia_texto ?? '',
      duracion: m.duracion ?? m.dias ?? m.duracion_dias ?? '',
      indicaciones: m.indicaciones ?? m.indicacion ?? m.notas ?? ''
    };
  }

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
    console.log('Detalle receta recibido:', raw);

    // Nombre
    const nombre =
      nombreDesdePaciente(raw.paciente) ||
      (typeof raw.nombrePaciente === 'string' ? raw.nombrePaciente : '') ||
      '—';
    setInput(nombreEl, nombre);

    // Fecha
    const fecha = (raw.fecha || '').slice(0, 10);
    setInput(fechaEl, fecha);

    // Edad
    const edadNum = (raw.edad_anios ?? raw?.paciente?.edad ?? null);
    setInput(edadEl, (edadNum != null) ? `${edadNum} años` : '— años');

    // Medicamentos
    renderMedicamentos(tablaBody, raw.medicamentos || []);

    // ==============================
    //        FIRMA GUARDADA
    // ==============================
    const firmaWrap = document.querySelector('.firma-wrap');

    // 🔍 intentamos varios nombres posibles del campo
    const firmaPath =
      raw.firma_path ||
      raw.firmaPath ||
      raw.firma_archivo ||
      raw.firmaArchivo ||
      raw.firma_file ||
      raw.firmaFile ||
      raw.firma;

    console.log('Campos de firma detectados:', {
      firma_path: raw.firma_path,
      firmaPath: raw.firmaPath,
      firma_archivo: raw.firma_archivo,
      firmaArchivo: raw.firmaArchivo,
      firma_file: raw.firma_file,
      firmaFile: raw.firmaFile,
      firma: raw.firma
    });

    // En modo visualizar NO queremos que se vea el canvas
    if (canvas) {
      canvas.classList.add('d-none');
    }
    if (btnClear) {
      btnClear.classList.add('d-none');
    }

    if (firmaImg) {
      if (firmaPath) {
        const url = `${FIRMA_BASE_URL}/${encodeURIComponent(firmaPath)}`;
        console.log('Mostrando firma en <img> desde:', url);
        firmaImg.src = url;
        firmaImg.style.display = 'block';
      } else {
        console.warn('No se encontró ruta de firma en el detalle.');
        firmaImg.style.display = 'none';
      }
    }

    // Número WhatsApp en VISUALIZAR (detalle + fetch si hace falta)
    await setNumeroWhatsApp(btnEnviar, raw);
  }

  async function cargarParaVisualizar(formId) {
    try {
      const res = await fetch(`/api/patients/forms/receta/${encodeURIComponent(formId)}`, {
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      await populateFromDetalle(json);
    } catch (e) {
      console.error('No se pudo visualizar la receta:', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar la receta para visualizar.' });
    }
  }

  // =========================================================
  //                   LISTENERS DE LA UI
  // =========================================================
  addBtn?.addEventListener('click', () => {
    tablaBody.appendChild(crearFila());
    Swal.fire({
      icon: 'success',
      title: 'Medicamento agregado',
      timer: 900,
      showConfirmButton: false
    });
  });

  tablaBody.addEventListener('click', (e) => {
    if (e.target.closest('.btn-delete-row')) {
      const tr = e.target.closest('tr');
      if (tablaBody.rows.length === 1) {
        tr.querySelectorAll('input').forEach(i => (i.value = ''));
      } else {
        tr.remove();
      }
      Swal.fire({
        icon: 'info',
        title: 'Fila eliminada',
        timer: 800,
        showConfirmButton: false
      });
    }
  });

  // --- guardar receta en BD (con firma base64)
  async function guardarRecetaEnBD() {
    const data = buildData();
    const pacienteId = pacienteIdQS;

    if (!pacienteId) {
      await Swal.fire({
        icon: 'warning',
        title: 'ID no encontrado',
        text: 'La URL debe incluir ?paciente_id=<id>'
      });
      return null;
    }

    const firma = await getFirmaBase64();
    if (firma) {
      data.firmaBase64 = firma;
    }


    if (!data.medicamentos.length || !data.medicamentos.some(m => m.nombre?.trim())) {
      await Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Agrega al menos un medicamento.'
      });
      return null;
    }

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
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;

      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarRecetaGuardada(pacienteId, formularioId);
      }

      await Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: `Folio: ${formularioId ?? '—'}`
      });
      return formularioId;
    } catch (e) {
      console.error('Error al guardar receta:', e);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo guardar la receta.'
      });
      return null;
    } finally {
      btnGuardar && (btnGuardar.disabled = false);
    }
  }

  btnGuardar?.addEventListener('click', guardarRecetaEnBD);

  // --- Enviar por WhatsApp
  btnEnviar?.addEventListener('click', async () => {
    const numero = btnEnviar.getAttribute('data-numero-paciente');

    if (!numero || !/^\d{10,15}$/.test(numero)) {
      await Swal.fire({
        icon: 'warning',
        title: 'Número no disponible',
        text: 'El paciente no tiene un número de WhatsApp válido registrado.'
      });
      return;
    }

    const mensaje = encodeURIComponent('Hola, adjunto su receta médica.');
    const url = `https://wa.me/${numero}?text=${mensaje}`;
    window.open(url, '_blank');
  });

  // --- Generar PDF
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
    const firma = await getFirmaBase64();
    if (firma) data.firmaMedico = firma;
    data.formularioId = formularioId;

    try {
      const res = await fetch('/api/pdf/receta/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, '_blank');

      const fullName = (nombreEl?.value || '').trim();
      const fecha = fechaEl?.value || hoyISO;
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
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo generar el PDF.'
      });
    }
  });

  // =========================================================
  //        Flujo de inicio según QS (nuevo vs visualizar)
  // =========================================================
  if (formularioIdQS) {
    // Ocultar botones edición
    btnGuardar?.classList.add('d-none');
    addBtn?.classList.add('d-none');
    btnClear?.classList.add('d-none');

    // Cargar datos receta existente
    await cargarParaVisualizar(formularioIdQS);

    // Bloquear campos pero permitir acciones
    form.querySelectorAll('input, textarea, select, button').forEach(el => {
      const id = el.id || '';
      const type = el.type || '';
      const tag = el.tagName;

      const isEnviar = id === 'btnEnviar';
      const isSubmit = type === 'submit';
      const isActionButton = isEnviar || isSubmit;

      if (isActionButton) {
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        return;
      }

      if (type === 'hidden') return;

      if (tag === 'SELECT') {
        el.setAttribute('disabled', 'true');
        return;
      }

      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        el.setAttribute('readonly', 'true');
        el.classList.add('bg-light');
      }
    });

    tablaBody.querySelectorAll('input').forEach(input => {
      input.setAttribute('readonly', 'true');
      input.classList.add('bg-light');
    });

    tablaBody.querySelectorAll('.btn-delete-row').forEach(btn => {
      btn.style.display = 'none';
    });

  } else if (pacienteIdQS) {
    await cargarPaciente();
  }
});
