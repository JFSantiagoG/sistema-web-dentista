// ======================= presupuesto.js (completo) =======================

// ===== Helpers de fecha/nombre/descarga =====
const hoyYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function yyyymmddCompact(dateStrOrDate) {
  const d = dateStrOrDate ? new Date(dateStrOrDate) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// "ana maría lópez" -> "Ana_Maria_Lopez"
function nombreTitulo(str = '') {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}

function buildPresupuestoPdfName({ nombre, fecha }) {
  const f = yyyymmddCompact(fecha || new Date());
  const n = nombreTitulo(nombre || 'Paciente');
  return `${f}_presupuesto_${n}.pdf`;
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

// ===== Contexto & refs =====
const qs = new URLSearchParams(location.search);
const pacienteId = qs.get('paciente_id') || qs.get('id'); // ?paciente_id=15
const token = localStorage.getItem('token');
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

const nombreInput = document.getElementById('nombrePacienteInput');
const fechaInput  = document.getElementById('fechaInput');
const numeroInput = document.getElementById('numeroPacienteInput');

const btnGuardar = document.getElementById('btnGuardar');
const btnPdf     = document.getElementById('btnPdf');
const form       = document.getElementById('presupuestoForm');

// ===== Estado =====
const tratamientosPorDiente = {};   // { "11": { nombre, costo }, ... }
const tratamientosGenerales = [];   // [ { nombre, costo }, ... ]
let totalCosto = 0;
let dienteActual = null;

const tratamientoModal = new bootstrap.Modal(document.getElementById("tratamientoModal"));

// ===== Auto-carga de datos del paciente (nombre/fecha/id readonly) =====
async function cargarPaciente() {
  if (!pacienteId) {
    await Swal.fire({ icon:'warning', title:'Falta ID', text:'Incluye ?paciente_id=<id> en la URL.' });
    return;
  }

  try {
    const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    // Nombre completo
    const nombreCompleto = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
      .filter(Boolean).join(' ').trim();

    nombreInput.value = nombreCompleto || '(Sin nombre)';
    nombreInput.readOnly = true;

    // Fecha de hoy (readonly)
    fechaInput.value = hoyYYYYMMDD();
    fechaInput.readOnly = true;

    // Número de paciente (ID)
    numeroInput.value = String(pacienteId);
    numeroInput.readOnly = true;

  } catch (err) {
    console.error('Error al cargar paciente:', err);
    await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
  }
}

// ===== Interacción con dientes / modal =====
document.querySelectorAll(".diente").forEach(diente => {
  diente.addEventListener("click", () => {
    const dienteId = diente.getAttribute("data-diente");
    dienteActual = dienteId;

    document.getElementById("dienteSeleccionado").value = dienteId;
    document.getElementById("dienteNumero").value = dienteId;
    document.getElementById("tratamientoSelect").value = "";
    document.getElementById("costoInput").value = "";
    document.getElementById("otroTratamientoInput").value = "";
    document.getElementById("otroTratamientoDiv").style.display = "none";

    tratamientoModal.show();
  });
});

document.getElementById("tratamientoSelect").addEventListener("change", function () {
  document.getElementById("otroTratamientoDiv").style.display = this.value === "Otro" ? "block" : "none";
});

document.getElementById("guardarTratamientoBtn").addEventListener("click", function () {
  const dienteId = document.getElementById("dienteSeleccionado").value;
  const tratamientoSelect = document.getElementById("tratamientoSelect");
  const otroInput = document.getElementById("otroTratamientoInput");
  const costoInput = document.getElementById("costoInput");

  let tratamientoNombre = tratamientoSelect.value;
  const costo = parseFloat(costoInput.value) || 0;

  if (!tratamientoNombre) {
    Swal.fire('Falta tratamiento', 'Selecciona un tratamiento.', 'warning');
    return;
  }
  if (tratamientoNombre === "Otro") {
    tratamientoNombre = otroInput.value.trim();
    if (!tratamientoNombre) {
      Swal.fire('Falta especificar', 'Especifica el nombre del tratamiento.', 'warning');
      return;
    }
  }
  if (costo <= 0) {
    Swal.fire('Costo inválido', 'Ingresa un costo mayor a 0.', 'warning');
    return;
  }

  tratamientosPorDiente[dienteId] = { nombre: tratamientoNombre, costo: costo };

  const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
  if (dienteElement) dienteElement.classList.add("tratamiento-asignado");

  actualizarTablaTratamientos();
  actualizarCalculadora();
  tratamientoModal.hide();
});

// ===== Tablas y cálculo =====
function actualizarTablaTratamientos() {
  const tbody = document.getElementById("tratamientosTablaBody");
  tbody.innerHTML = "";

  Object.entries(tratamientosPorDiente).forEach(([dienteId, tratamiento]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${dienteId}</td>
      <td>${tratamiento.nombre || "Sin tratamiento"}</td>
      <td>$${parseFloat(tratamiento.costo || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
}

function actualizarCalculadora() {
  const costosTablaBody = document.getElementById("costosTablaBody");
  costosTablaBody.innerHTML = "";

  Object.entries(tratamientosPorDiente).forEach(([dienteId, tratamiento]) => {
    if (tratamiento.costo > 0) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${tratamiento.nombre} (Diente ${dienteId})</td>
        <td>$${parseFloat(tratamiento.costo).toFixed(2)}</td>
      `;
      costosTablaBody.appendChild(row);
    }
  });

  tratamientosGenerales.forEach(tratamiento => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${tratamiento.nombre}</td>
      <td>$${parseFloat(tratamiento.costo).toFixed(2)}</td>
    `;
    costosTablaBody.appendChild(row);
  });

  totalCosto = Object.values(tratamientosPorDiente).reduce((acc, t) => acc + parseFloat(t.costo || 0), 0);
  tratamientosGenerales.forEach(t => (totalCosto += parseFloat(t.costo)));

  document.getElementById("totalCosto").textContent = `$${totalCosto.toFixed(2)}`;

  const meses = Math.max(1, parseInt(document.getElementById("mesesInput").value) || 1);
  const mensualidad = totalCosto / meses;
  document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
}

document.querySelectorAll(".general-treatment-checkbox").forEach(check => {
  check.addEventListener("change", () => {
    const costo = parseFloat(check.dataset.costo);
    const nombre = check.nextElementSibling.textContent.trim();

    if (check.checked) {
      tratamientosGenerales.push({ nombre, costo });
    } else {
      const index = tratamientosGenerales.findIndex(t => t.nombre === nombre);
      if (index > -1) tratamientosGenerales.splice(index, 1);
    }

    actualizarCalculadora();
  });
});

document.getElementById("mesesInput").addEventListener("input", function () {
  const meses = Math.max(1, parseInt(this.value) || 1);
  this.value = meses;
  if (totalCosto >= 0) {
    const mensualidad = totalCosto / meses;
    document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
  }
});

// ===== Construcción de payloads =====
function obtenerTratamientosPorDiente() {
  const filas = document.querySelectorAll('#tratamientosTablaBody tr');
  const tratamientos = [];
  filas.forEach(fila => {
    const diente = fila.querySelector('td:nth-child(1)').textContent.trim();
    const tratamiento = fila.querySelector('td:nth-child(2)').textContent.trim();
    const costoTexto = fila.querySelector('td:nth-child(3)').textContent.trim();
    const costo = parseFloat(costoTexto.replace('$', '').trim()) || 0;
    tratamientos.push({ diente, tratamiento, costo });
  });
  return tratamientos;
}

function obtenerTratamientosGenerales() {
  const checkboxes = document.querySelectorAll('.general-treatment-checkbox');
  const generales = [];
  checkboxes.forEach(cb => {
    if (cb.checked) {
      generales.push({
        nombre: cb.nextElementSibling.textContent.trim(),
        costo: parseFloat(cb.dataset.costo)
      });
    }
  });
  return generales;
}

function calcularPresupuesto() {
  const totalTexto = document.getElementById('totalCosto').textContent.replace('$', '').trim();
  const mensualTexto = document.getElementById('mensualidad').textContent.replace('$', '').trim();
  const meses = Math.max(1, parseInt(document.getElementById('mesesInput').value) || 1);
  return {
    total: parseFloat(totalTexto) || 0,
    mensualidad: parseFloat(mensualTexto) || 0,
    meses
  };
}

// ===== Guardar Borrador (POST /patients/:id/presupuesto) =====
async function guardarBorrador() {
  if (!pacienteId) {
    await Swal.fire({ icon:'warning', title:'Falta ID', text:'Incluye ?paciente_id=<id> en la URL.' });
    return;
  }
  if (!numeroInput.value || !fechaInput.value || !nombreInput.value) {
    await Swal.fire({ icon:'warning', title:'Datos incompletos', text:'Verifica nombre, fecha y número de paciente.' });
    return;
  }

  const payload = {
    paciente: {
      nombre: nombreInput.value,
      numeroPaciente: numeroInput.value,
      fechaRegistro: fechaInput.value
    },
    odontograma: obtenerTratamientosPorDiente(),          // [{diente, tratamiento, costo}]
    tratamientosGenerales: obtenerTratamientosGenerales(),// [{nombre, costo}]
    presupuesto: calcularPresupuesto()                    // { total, mensualidad, meses }
  };

  try {
    const resp = await fetch(`/api/patients/${pacienteId}/presupuesto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error('❌ Error al guardar:', txt);
      await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar el presupuesto.' });
      return;
    }

    const json = await resp.json();
    await Swal.fire({
      icon:'success',
      title:'Guardado',
      text:`Presupuesto guardado. Folio: ${json?.formulario_id ?? '—'}`
    });
  } catch (err) {
    console.error('❌ Conexión fallida:', err);
    await Swal.fire({ icon:'error', title:'Error', text:'No se pudo guardar (conexión).' });
  }
}

// ===== PDF (POST /api/pdf/presupuesto/generate) =====
async function generarPDFPresupuesto() {
  if (!pacienteId) {
    await Swal.fire({ icon:'warning', title:'Falta ID', text:'Incluye ?paciente_id=<id> en la URL.' });
    return;
  }

  const odontogramaContainer = document.querySelector('.dientes-container');
  if (!odontogramaContainer) {
    await Swal.fire({ icon:'error', title:'Error', text:'No se encontró el odontograma visual.' });
    return;
  }

  // Aviso previo
  const pre = await Swal.fire({
    icon:'info',
    title:'Se abrirá el PDF en otra pestaña',
    text:'Al volver verás la opción para descargar con nombre sugerido.',
    confirmButtonText:'Entendido'
  });
  if (!pre.isConfirmed) return;

  // Captura visual
  const odontogramaCanvas = await html2canvas(odontogramaContainer, { backgroundColor: null, useCORS: true });
  const odontogramaImg = odontogramaCanvas.toDataURL('image/png');

  const data = {
    paciente: {
      nombre: nombreInput.value,
      numeroPaciente: numeroInput.value,
      fechaRegistro: fechaInput.value
    },
    odontograma: obtenerTratamientosPorDiente(),
    tratamientosGenerales: obtenerTratamientosGenerales(),
    presupuesto: calcularPresupuesto(),
    odontogramaVisual: odontogramaImg
  };

  try {
    const res = await fetch('/api/pdf/presupuesto/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('❌ Error PDF:', t);
      await Swal.fire({ icon:'error', title:'PDF', text:'No se pudo generar el PDF.' });
      return;
    }

    const blob = await res.blob();

    // 1) Abrir vista en nueva pestaña
    const viewUrl = URL.createObjectURL(blob);
    window.open(viewUrl, '_blank');

    // 2) Sugerir descarga con nombre
    const filename = buildPresupuestoPdfName({
      nombre: nombreInput.value,
      fecha: fechaInput.value
    });

    const post = await Swal.fire({
      icon:'success',
      title:'PDF listo',
      html: `
        <p>El PDF se abrió en otra pestaña.</p>
        <p class="mb-1"><small>Nombre sugerido:</small></p>
        <code style="user-select:all">${filename}</code>
      `,
      showCancelButton: true,
      confirmButtonText: '⬇️ Descargar PDF',
      cancelButtonText: 'Cerrar'
    });
    if (post.isConfirmed) {
      downloadBlob(blob, filename);
    }

    URL.revokeObjectURL(viewUrl);
  } catch (err) {
    console.error('❌ Conexión PDF:', err);
    await Swal.fire({ icon:'error', title:'PDF', text:'No se pudo generar el PDF (conexión).' });
  }
}

// ===== Submit & botones =====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  await guardarBorrador();
});

if (btnGuardar) btnGuardar.addEventListener('click', guardarBorrador);
if (btnPdf)     btnPdf.addEventListener('click', generarPDFPresupuesto);

// ===== Arranque =====
document.addEventListener('DOMContentLoaded', () => {
  cargarPaciente();
});
