// public/js/receta.js
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('recetaForm');
  if (!form) return console.error('❌ No se encontró #recetaForm');

  // --- refs del DOM
  const nombreEl   = form.querySelector('[name="nombrePaciente"]');
  const fechaEl    = form.querySelector('[name="fecha"]'); // fecha de emisión (HOY)
  const edadEl     = form.querySelector('[name="edad"]');
  const hiddenId   = document.getElementById('pacienteId');
  const tablaBody  = document.querySelector('#tablaMedicamentos tbody');
  const addBtn     = document.getElementById('addMedicamentoBtn');
  const btnGuardar = document.getElementById('btnGuardar');
  const btnEnviar  = document.getElementById('btnEnviar');
  const canvas     = document.getElementById('signature-pad'); // firma (solo para PDF)

  // --- paciente_id desde la URL
  const qs = new URLSearchParams(location.search);
  const pacienteId = qs.get('paciente_id') || qs.get('id');
  if (hiddenId && pacienteId) hiddenId.value = pacienteId;

  // --- estado local: folio (formulario_id) guardado
  const SS_KEY   = (pid) => `receta:formId:${pid}`;
  const SAVE_KEY = (pid) => `receta:saved:${pid}`;
  let formularioId = pacienteId ? Number(sessionStorage.getItem(SS_KEY(pacienteId))) || null : null;

  // --- canal para avisar al perfil (paciente.html) que refresque
  const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('recetas') : null;
  function notificarRecetaGuardada(pid, folio) {
    try {
      localStorage.setItem(SAVE_KEY(pid), String(Date.now())); // dispara 'storage' en otras pestañas
      if (bc) bc.postMessage({ type: 'receta-saved', pacienteId: String(pid), formularioId: folio });
    } catch {}
  }

  // --- bloquear edición de nombre/edad y fijar HOY
  [nombreEl, edadEl].forEach(el => el && (el.readOnly = true));
  const hoyISO = (() => {
    const now = new Date();
    const iso = new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return iso;
  })();
  if (fechaEl) {
    fechaEl.value = hoyISO;              // siempre hoy
    fechaEl.readOnly = true;
    fechaEl.min = hoyISO;
    fechaEl.max = hoyISO;
  }

  // --- auth headers (JWT)
  const token = localStorage.getItem('token');
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // --- helpers varios
  const buildNombre = (p) =>
    [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno].filter(Boolean).join(' ');

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

  const buildData = () => {
    const data = {
      pacienteId,
      nombrePaciente: nombreEl?.value || '',
      fecha: fechaEl?.value || '',    // SOLO fecha de emisión
      edad:  edadEl?.value || '',
      nombreMedico: form.nombreMedico.value,
      cedula:       form.cedula.value,
      medicamentos: []
      // ❌ SIN firma para guardar en BD
    };
    tablaBody.querySelectorAll('tr').forEach(fila => {
      data.medicamentos.push({
        nombre:       fila.querySelector('[name="medicamento[]"]').value,
        dosis:        fila.querySelector('[name="dosis[]"]').value,
        frecuencia:   fila.querySelector('[name="frecuencia[]"]').value,
        duracion:     fila.querySelector('[name="duracion[]"]').value,
        indicaciones: fila.querySelector('[name="indicaciones[]"]').value
      });
    });
    return data;
  };

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

  // Firma SOLO para PDF
  function getFirmaBase64() {
    if (!canvas) return null;
    try {
      // Si usas firma.js para dibujar, esto funciona. Si no, será canvas en blanco y retornará null.
      const blank = document.createElement('canvas');
      blank.width = canvas.width; blank.height = canvas.height;
      const isBlank = canvas.toDataURL() === blank.toDataURL();
      if (isBlank) return null;
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('No se pudo leer la firma:', e);
      return null;
    }
  }

  // --- cargar paciente (nombre/edad)
  async function cargarPaciente() {
    if (!pacienteId) {
      await Swal.fire({
        title: 'ID no encontrado',
        text: 'La URL debe incluir ?paciente_id=<id> (o ?id=).',
        icon: 'warning',
        confirmButtonText: 'Ok'
      });
      return;
    }
    try {
      const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const p = await res.json();
      if (nombreEl) nombreEl.value = buildNombre(p) || '';
      if (edadEl)   edadEl.value   = (p?.edad != null) ? `${p.edad} años` : '';
    } catch (e) {
      console.error('Error al cargar paciente:', e);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar la información del paciente.' });
    }
  }
  await cargarPaciente();

  // --- agregar/eliminar medicamentos
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
    if (!pacienteId) {
      await Swal.fire({ icon:'warning', title:'ID no encontrado', text:'La URL debe incluir ?paciente_id=<id>' });
      return null;
    }
    if (!data.medicamentos.length) {
      await Swal.fire({ icon:'warning', title:'Faltan datos', text:'Agrega al menos un medicamento.' });
      return null;
    }

    // Si ya existe folio, confirma si deseas crear OTRA receta nueva
    if (formularioId) {
      const r = await Swal.fire({
        title: `Esta receta ya fue guardada (folio ${formularioId}).`,
        text: '¿Deseas guardar otra receta nueva con estos datos?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear otra',
        cancelButtonText: 'Cancelar'
      });
      if (!r.isConfirmed) return null;
      // se creará un nuevo registro (no re-usa el folio anterior)
    }

    // Anti doble clic durante la petición
    btnGuardar && (btnGuardar.disabled = true);

    try {
      const res = await fetch(`/api/patients/${pacienteId}/recetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(data) // <-- SIN firma
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      formularioId = Number(json.formulario_id) || null;

      if (formularioId && pacienteId) {
        sessionStorage.setItem(SS_KEY(pacienteId), String(formularioId));
        notificarRecetaGuardada(pacienteId, formularioId); // 🔔 avisa al perfil
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

  // --- botones
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

    // 👉 NO guardamos automáticamente:
    if (!formularioId) {
      await Swal.fire({
        title: 'Primero guarda la receta',
        text: 'Para generar el PDF necesitas guardar la receta y obtener un folio.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    // Aviso previo como en quirúrgico
    const pre = await Swal.fire({
      icon: 'info',
      title: 'Se abrirá el PDF en otra pestaña',
      text: 'Al regresar, podrás descargarlo desde aquí con un nombre sugerido.',
      confirmButtonText: 'Entendido'
    });
    if (!pre.isConfirmed) return;

    const data = buildData();
    const firma = getFirmaBase64(); // 👈 solo para PDF (no se guarda)
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

      // Sugerir descarga con nombre: YYYYMMDD_receta_Nombre_Apellido.pdf
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
});
