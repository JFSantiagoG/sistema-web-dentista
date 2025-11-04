// ===============================
// diag-infantil.js (completo)
// ===============================

// ---- Helpers base ----
const hoyYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const hasSwal = () => typeof Swal !== 'undefined';
const msg = {
  success: (t, m) => hasSwal() ? Swal.fire({ icon: 'success', title: t, text: m }) : alert(`✅ ${t}\n${m}`),
  error:   (t, m) => hasSwal() ? Swal.fire({ icon: 'error',   title: t, text: m }) : alert(`❌ ${t}\n${m}`),
  warn:    (t, m) => hasSwal() ? Swal.fire({ icon: 'warning', title: t, text: m }) : alert(`⚠️ ${t}\n${m}`),
};

// ---- PDF helpers ----
function yyyymmddCompact(dateStrOrDate) {
  const d = dateStrOrDate ? new Date(dateStrOrDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
function nombreTitulo(str = '') {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().split(/\s+/).filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}
function buildDiagInfantilPdfName({ pacienteNombre, fecha }) {
  const f = (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) ? fecha.replaceAll('-', '') : yyyymmddCompact();
  const n = nombreTitulo(pacienteNombre || 'Paciente');
  return `${f}_infantil_${n}.pdf`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Contexto & refs ----
const qs = new URLSearchParams(location.search);
const pacienteId   = qs.get('paciente_id') || qs.get('id');           // crear
const formularioId = qs.get('formulario_id') || qs.get('formulario'); // visualizar

const token = localStorage.getItem('token');
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

const form = document.getElementById('diagInfantilForm');
const pacienteSelect = document.getElementById('pacienteSelect');
const fechaInput = document.getElementById('fechaInput');
const numeroPacienteInput = document.getElementById('numeroPacienteInput');

const btnGuardar = document.getElementById('btnGuardar');
const btnEnviar  = document.getElementById('btnEnviar');
const btnPdf     = document.getElementById('btnPdf');

// ---- Estado ----
const tratamientosPorDiente = {};   // { "11": { nombre, costo }, ... }
const tratamientosGenerales = [];   // [ { nombre, costo }, ... ]
let totalCosto = 0;
let dienteActual = null;

const tratamientoModal = new bootstrap.Modal(document.getElementById('tratamientoModal'));

// ===============================
// Carga paciente (modo crear)
// ===============================
async function cargarPacienteInfantil() {
  if (!pacienteId) return;
  try {
    const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    const nombreCompleto = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
      .filter(Boolean).join(' ').trim() || '(Sin nombre)';

    pacienteSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = String(pacienteId);
    opt.textContent = nombreCompleto;
    opt.selected = true;
    pacienteSelect.appendChild(opt);
    pacienteSelect.disabled = true;

    fechaInput.value = hoyYYYYMMDD();
    fechaInput.readOnly = true;

    numeroPacienteInput.value = String(pacienteId);
    numeroPacienteInput.readOnly = true;

    enableTeethClicks(true);
    document.querySelectorAll('.general-treatment-checkbox').forEach(cb => cb.disabled = false);
  } catch (err) {
    console.error('Error cargar paciente diag infantil:', err);
    msg.error('Error', 'No se pudo cargar el paciente.');
  }
}

// ===============================
// Visualización desde servidor
// GET /api/patients/forms/diag-infantil/:formularioId
// ===============================
async function cargarDiagInfantilDesdeServidor() {
  if (!formularioId) return;
  try {
    const res = await fetch(`/api/patients/forms/diag-infantil/${encodeURIComponent(formularioId)}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Campos paciente/fecha
    const nombre = data?.paciente?.nombre || data?.paciente || data?.nombre_paciente || '';
    const pid    = data?.paciente_id || data?.paciente?.id || '';
    const fecha  = (data?.fecha || data?.fecha_registro || data?.paciente?.fechaRegistro || '').substring(0,10);

    pacienteSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = String(pid || '');
    opt.textContent = (nombre || '(Sin nombre)').trim();
    opt.selected = true;
    pacienteSelect.appendChild(opt);
    pacienteSelect.disabled = true;

    numeroPacienteInput.value = String(pid || '');
    numeroPacienteInput.readOnly = true;

    fechaInput.value = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : hoyYYYYMMDD();
    fechaInput.readOnly = true;

    // Reconstruir odontograma por diente
    const porDiente = data?.odontograma || data?.datos?.odontograma || data?.datos?.tratamientos_por_diente || data?.tratamientos_por_diente || [];
    // puede venir como array [{diente,tratamiento,costo}] o como objeto { "11":[{...}], ...}
    if (Array.isArray(porDiente)) {
      porDiente.forEach(r => {
        if (!r) return;
        const d = String(r.diente);
        tratamientosPorDiente[d] = { nombre: r.tratamiento, costo: Number(r.costo || 0) };
        const el = document.querySelector(`.diente[data-diente="${d}"]`);
        if (el) el.classList.add('tratamiento-asignado');
      });
    } else if (porDiente && typeof porDiente === 'object') {
      Object.entries(porDiente).forEach(([d, arr]) => {
        const item = Array.isArray(arr) ? arr[0] : arr;
        const nombreT = item?.nombre || item?.tratamiento || '';
        const costoT  = Number(item?.costo || 0);
        tratamientosPorDiente[String(d)] = { nombre: nombreT, costo: costoT };
        const el = document.querySelector(`.diente[data-diente="${d}"]`);
        if (el) el.classList.add('tratamiento-asignado');
      });
    }

    // Generales
    const generales = data?.tratamientosGenerales || data?.generales || data?.datos?.tratamientos_generales || [];
    if (Array.isArray(generales)) {
      generales.forEach(g => {
        const nombreG = g?.nombre || g?.tratamiento || '';
        const costoG  = Number(g?.costo || 0);
        if (nombreG) tratamientosGenerales.push({ nombre: nombreG, costo: costoG });
        // marcar checkbox si coincide el label
        document.querySelectorAll('.general-treatment-checkbox').forEach(cb => {
          const label = cb.nextElementSibling?.textContent?.trim();
          if (label === nombreG) cb.checked = true;
        });
      });
    }

    // Presupuesto (meses, totales) si viene
    const presupuesto = data?.presupuesto || data?.datos?.presupuesto || null;
    if (presupuesto && typeof presupuesto === 'object') {
      const m = Number(presupuesto.meses || 1);
      document.getElementById('mesesInput').value = m > 0 ? m : 1;
    }

    actualizarTablaTratamientos();
    actualizarCalculadora();

    // Solo lectura UI + botones (sin guardar)
    setSoloLecturaUI(true);
  } catch (err) {
    console.error('Error cargar diag infantil:', err);
    msg.error('Error', 'No se pudo cargar el formulario.');
  }
}

function setSoloLecturaUI(soloLectura) {
  // Campos
  pacienteSelect.disabled = true;
  fechaInput.readOnly = true;
  numeroPacienteInput.readOnly = true;

  // Dientes sin clic
  enableTeethClicks(!soloLectura);

  // Generales deshabilitados
  document.querySelectorAll('.general-treatment-checkbox').forEach(cb => cb.disabled = soloLectura);

  // Botones: ocultar Guardar en visualizar, Enviar simulado
  if (soloLectura && btnGuardar) btnGuardar.classList.add('d-none');
}

// ===============================
// Interacción con dientes / modal
// ===============================
function enableTeethClicks(enable) {
  document.querySelectorAll('.diente').forEach(d => {
    d.style.cursor = enable ? 'pointer' : 'default';
  });
  if (!enable) {
    // quitar listeners previos: clonamos para limpieza
    document.querySelectorAll('.diente').forEach(d => {
      const c = d.cloneNode(true);
      d.parentNode.replaceChild(c, d);
    });
    return;
  }
  // attach listeners
  document.querySelectorAll('.diente').forEach(diente => {
    diente.addEventListener('click', () => {
      const dienteId = diente.getAttribute('data-diente');
      dienteActual = dienteId;
      document.getElementById('dienteSeleccionado').value = dienteId;
      document.getElementById('dienteNumero').value = dienteId;
      document.getElementById('tratamientoSelect').value = '';
      document.getElementById('costoInput').value = '';
      document.getElementById('otroTratamientoInput').value = '';
      document.getElementById('otroTratamientoDiv').style.display = 'none';
      tratamientoModal.show();
    });
  });
}

document.getElementById('tratamientoSelect').addEventListener('change', function () {
  document.getElementById('otroTratamientoDiv').style.display = (this.value === 'Otro') ? 'block' : 'none';
});

document.getElementById('guardarTratamientoBtn').addEventListener('click', function () {
  const dienteId = document.getElementById('dienteSeleccionado').value;
  const tratamientoSelect = document.getElementById('tratamientoSelect');
  const otroInput = document.getElementById('otroTratamientoInput');
  const costoInput = document.getElementById('costoInput');

  let tratamientoNombre = tratamientoSelect.value;
  const costo = parseFloat(costoInput.value) || 0;

  if (!tratamientoNombre) return msg.warn('Falta tratamiento', 'Selecciona un tratamiento.');
  if (tratamientoNombre === 'Otro') {
    tratamientoNombre = (otroInput.value || '').trim();
    if (!tratamientoNombre) return msg.warn('Falta especificar', 'Especifica el nombre del tratamiento.');
  }
  if (costo <= 0) return msg.warn('Costo inválido', 'Ingresa un costo mayor a 0.');

  tratamientosPorDiente[dienteId] = { nombre: tratamientoNombre, costo: costo };

  const el = document.querySelector(`.diente[data-diente="${dienteId}"]`);
  if (el) el.classList.add('tratamiento-asignado');

  actualizarTablaTratamientos();
  actualizarCalculadora();
  tratamientoModal.hide();
});

// ===============================
// Tablas y cálculo
// ===============================
function actualizarTablaTratamientos() {
  const tbody = document.getElementById('tratamientosTablaBody');
  tbody.innerHTML = '';
  Object.entries(tratamientosPorDiente).forEach(([dienteId, t]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dienteId}</td>
      <td>${t.nombre || 'Sin tratamiento'}</td>
      <td>$${parseFloat(t.costo || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarCalculadora() {
  const costosBody = document.getElementById('costosTablaBody');
  costosBody.innerHTML = '';

  Object.entries(tratamientosPorDiente).forEach(([dienteId, t]) => {
    if (t.costo > 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.nombre} (Diente ${dienteId})</td><td>$${parseFloat(t.costo).toFixed(2)}</td>`;
      costosBody.appendChild(tr);
    }
  });

  tratamientosGenerales.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.nombre}</td><td>$${parseFloat(t.costo).toFixed(2)}</td>`;
    costosBody.appendChild(tr);
  });

  totalCosto = 0;
  Object.values(tratamientosPorDiente).forEach(t => totalCosto += parseFloat(t.costo || 0));
  tratamientosGenerales.forEach(t => totalCosto += parseFloat(t.costo || 0));

  document.getElementById('totalCosto').textContent = `$${totalCosto.toFixed(2)}`;

  const meses = Math.max(1, parseInt(document.getElementById('mesesInput').value) || 1);
  document.getElementById('mensualidad').textContent = `$${(totalCosto / meses).toFixed(2)}`;
}

document.querySelectorAll('.general-treatment-checkbox').forEach(cb => {
  cb.addEventListener('change', () => {
    const nombre = cb.nextElementSibling?.textContent?.trim();
    const costo = parseFloat(cb.dataset.costo || '0');
    if (cb.checked) {
      if (!tratamientosGenerales.find(t => t.nombre === nombre)) {
        tratamientosGenerales.push({ nombre, costo });
      }
    } else {
      const i = tratamientosGenerales.findIndex(t => t.nombre === nombre);
      if (i > -1) tratamientosGenerales.splice(i, 1);
    }
    actualizarCalculadora();
  });
});

document.getElementById('mesesInput').addEventListener('input', function () {
  let m = parseInt(this.value) || 1;
  if (m < 1) m = 1;
  this.value = m;
  if (totalCosto >= 0) {
    document.getElementById('mensualidad').textContent = `$${(totalCosto / m).toFixed(2)}`;
  }
});

// ===============================
// Payloads
// ===============================
function obtenerTratamientosPorDiente() {
  return Object.entries(tratamientosPorDiente).map(([diente, t]) => ({
    diente, tratamiento: t.nombre, costo: Number(t.costo) || 0
  }));
}
function obtenerTratamientosGenerales() {
  return tratamientosGenerales.map(t => ({ nombre: t.nombre, costo: Number(t.costo) || 0 }));
}
function calcularPresupuesto() {
  const meses = Math.max(1, parseInt(document.getElementById('mesesInput').value) || 1);
  return { total: Number(totalCosto) || 0, mensualidad: Number(totalCosto / meses) || 0, meses };
}

// ===============================
// Guardar Borrador  (POST /api/patients/:id/diag-infantil)
// ===============================
async function guardarBorradorInfantil() {
  if (!pacienteId) return msg.warn('Falta ID', 'Incluye ?paciente_id=<id> en la URL.');
  if (!pacienteSelect.value || !fechaInput.value) return msg.warn('Datos incompletos', 'Verifica nombre y fecha.');

  const payload = {
    paciente: {
      nombre: pacienteSelect.selectedOptions[0]?.textContent?.trim() || '',
      numeroPaciente: numeroPacienteInput.value || String(pacienteId),
      fechaRegistro: fechaInput.value
    },
    odontograma: obtenerTratamientosPorDiente(),
    tratamientosGenerales: obtenerTratamientosGenerales(),
    presupuesto: calcularPresupuesto()
  };

  try {
    const resp = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/diag-infantil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('❌ Guardar diag-infantil:', t);
      return msg.error('Error', 'No se pudo guardar el diagnóstico infantil.');
    }
    const json = await resp.json();
    msg.success('Guardado', `Formulario guardado. Folio: ${json?.formulario_id ?? '—'}`);
  } catch (e) {
    console.error('❌ Conexión guardar:', e);
    msg.error('Error', 'No se pudo guardar (conexión).');
  }
}

// ===============================
// PDF (POST /api/pdf/diag-infantil/generate)
// ===============================
async function generarPDFInfantil() {
  if (!pacienteSelect.value || !fechaInput.value) return msg.warn('Datos incompletos', 'Verifica nombre y fecha.');
  const odontogramaContainer = document.querySelector('.dientes-container');
  if (!odontogramaContainer) return msg.error('PDF', 'No se encontró el odontograma visual.');

  // Captura
  const canvas = await html2canvas(odontogramaContainer, { backgroundColor: null, useCORS: true });
  const odontogramaVisual = canvas.toDataURL('image/png');

  const data = {
    paciente: {
      nombre: pacienteSelect.selectedOptions[0]?.textContent?.trim() || '',
      numeroPaciente: numeroPacienteInput.value || String(pacienteId || ''),
      fechaRegistro: fechaInput.value
    },
    odontograma: obtenerTratamientosPorDiente(),
    tratamientosGenerales: obtenerTratamientosGenerales(),
    presupuesto: calcularPresupuesto(),
    odontogramaVisual
  };

  try {
    const res = await fetch('/api/pdf/diag-infantil/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('❌ PDF infantil:', t);
      return msg.error('PDF', 'No se pudo generar el PDF.');
    }
    const blob = await res.blob();
    const viewUrl = URL.createObjectURL(blob);
    window.open(viewUrl, '_blank');

    const nombreArchivo = buildDiagInfantilPdfName({
      pacienteNombre: pacienteSelect.selectedOptions[0]?.textContent?.trim() || '',
      fecha: fechaInput.value
    });

    const post = await Swal.fire({
      icon: 'success',
      title: 'PDF listo',
      html: `
        <p>El PDF se abrió en otra pestaña.</p>
        <p class="mb-1"><small>Nombre sugerido:</small></p>
        <code style="user-select:all">${nombreArchivo}</code>
      `,
      showCancelButton: true,
      confirmButtonText: '⬇️ Descargar PDF',
      cancelButtonText: 'Cerrar'
    });
    if (post.isConfirmed) downloadBlob(blob, nombreArchivo);

    URL.revokeObjectURL(viewUrl);
  } catch (e) {
    console.error('❌ Conexión PDF:', e);
    msg.error('PDF', 'No se pudo generar el PDF (conexión).');
  }
}

// ===============================
// Envío SIMULADO (no guarda)
// ===============================
async function enviarSimulado() {
  await Swal.fire({
    icon: 'success',
    title: 'Enviado',
    html: `
      <p>Se simuló el envío del presupuesto al paciente.</p>
    `
  });
}

// ===============================
// Wire-up
// ===============================
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (formularioId) {
      // visualizar: solo simular
      await enviarSimulado();
    } else {
      // crear: enviar también es simulado (no guarda)
      await enviarSimulado();
    }
  });
}
if (btnGuardar) btnGuardar.addEventListener('click', guardarBorradorInfantil);
if (btnPdf)     btnPdf.addEventListener('click', generarPDFInfantil);

// ===============================
// Arranque
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  if (formularioId) {
    cargarDiagInfantilDesdeServidor();
  } else {
    if (!pacienteId) {
      msg.warn('Falta ID', 'Abre con ?paciente_id=<id> para crear nuevo.');
      // Deja los controles deshabilitados hasta que tenga paciente_id
      pacienteSelect.disabled = true;
      document.querySelectorAll('.general-treatment-checkbox').forEach(cb => cb.disabled = true);
    } else {
      cargarPacienteInfantil();
    }
  }
});
