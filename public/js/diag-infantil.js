// ===============================
// diag-infantil.js
// ===============================

// -- Helpers básicos --
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

// === Helpers para nombre de PDF ===
function yyyymmdd(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}
// "ana maría lópez pérez" -> "Ana_Maria_Lopez_Perez"
function nombreTitulo(str = '') {
  return (str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('_');
}
// Nombre final para el archivo PDF de diagnóstico infantil (SIN ID)
function buildDiagInfantilPdfName({ pacienteNombre, fecha }) {
  const f = (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    ? fecha.replaceAll('-', '')
    : yyyymmdd(new Date());
  const nombre = nombreTitulo(pacienteNombre || 'Paciente');
  return `${f}_infantil_${nombre}.pdf`;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// -- Auth / paciente_id (igual que presupuesto) --
const token = localStorage.getItem('token');
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
const qs = new URLSearchParams(location.search);
const pacienteId = qs.get('paciente_id') || qs.get('id');

// -- DOM refs --
const form = document.getElementById('presupuestoForm');
const pacienteSelect = document.getElementById('pacienteSelect');
const fechaInput = document.getElementById('fechaInput');
const numeroPacienteInput = document.getElementById('numeroPacienteInput');

// Botones (tu HTML no trae ids; ubicamos por clases)
const btnGuardar = document.querySelector('.btn-outline-secondary.btn-lg'); // "💾 Guardar Borrador"
const btnPdf     = document.querySelector('.btn-info.btn-lg');              // "🖨️ Descargar PDF"

// -- Estado odontograma / calculadora --
const tratamientosPorDiente = {}; // { "13": {nombre,costo}, ...}
const tratamientosGenerales = []; // [{nombre,costo}]
let totalCosto = 0;
let dienteActual = null;

// -- Modal Bootstrap --
const tratamientoModal = new bootstrap.Modal(document.getElementById('tratamientoModal'));

// ===============================
// Auto-carga de datos del paciente
// ===============================
async function cargarPacienteInfantil() {
  try {
    if (!pacienteId) {
      msg.warn('Falta el paciente', 'Incluye ?paciente_id=<id> en la URL.');
      return;
    }

    const res = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    // Nombre completo (usa los campos que tengas)
    const nombreCompleto = [
      p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno
    ].filter(Boolean).join(' ').trim() || '(Sin nombre)';

    // Llenar el <select> con una opción fija (readonly virtual)
    pacienteSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = String(pacienteId);
    opt.textContent = nombreCompleto;
    opt.selected = true;
    pacienteSelect.appendChild(opt);
    pacienteSelect.disabled = true;

    // Fecha de hoy
    fechaInput.value = hoyYYYYMMDD();
    fechaInput.readOnly = true;

    // Número de paciente (id)
    numeroPacienteInput.value = String(pacienteId);
    numeroPacienteInput.readOnly = true;

  } catch (err) {
    console.error('Error al cargar paciente infantil:', err);
    msg.error('Error', 'No se pudo cargar el paciente.');
  }
}

// ===============================
// Interacción con dientes / modal
// ===============================
document.querySelectorAll('.diente').forEach(diente => {
  diente.addEventListener('click', () => {
    const dienteId = diente.getAttribute('data-diente');
    dienteActual = dienteId;

    // Reset modal
    document.getElementById('dienteSeleccionado').value = dienteId;
    document.getElementById('dienteNumero').value = dienteId;
    document.getElementById('tratamientoSelect').value = '';
    document.getElementById('costoInput').value = '';
    document.getElementById('otroTratamientoInput').value = '';
    document.getElementById('otroTratamientoDiv').style.display = 'none';

    tratamientoModal.show();
  });
});

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

  if (!tratamientoNombre) {
    msg.warn('Falta tratamiento', 'Selecciona un tratamiento.');
    return;
  }
  if (tratamientoNombre === 'Otro') {
    tratamientoNombre = (otroInput.value || '').trim();
    if (!tratamientoNombre) {
      msg.warn('Falta especificar', 'Especifica el nombre del tratamiento.');
      return;
    }
  }
  if (costo <= 0) {
    msg.warn('Costo inválido', 'Ingresa un costo mayor a 0.');
    return;
  }

  tratamientosPorDiente[dienteId] = { nombre: tratamientoNombre, costo: costo };

  const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
  if (dienteElement) dienteElement.classList.add('tratamiento-asignado');

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

  Object.entries(tratamientosPorDiente).forEach(([dienteId, tratamiento]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${dienteId}</td>
      <td>${tratamiento.nombre || 'Sin tratamiento'}</td>
      <td>$${parseFloat(tratamiento.costo || 0).toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
}

function actualizarCalculadora() {
  const costosTablaBody = document.getElementById('costosTablaBody');
  costosTablaBody.innerHTML = '';

  // Por diente
  Object.entries(tratamientosPorDiente).forEach(([dienteId, t]) => {
    if (t.costo > 0) {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${t.nombre} (Diente ${dienteId})</td>
        <td>$${parseFloat(t.costo).toFixed(2)}</td>
      `;
      costosTablaBody.appendChild(row);
    }
  });

  // Generales
  tratamientosGenerales.forEach(tratamiento => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tratamiento.nombre}</td>
      <td>$${parseFloat(tratamiento.costo).toFixed(2)}</td>
    `;
    costosTablaBody.appendChild(row);
  });

  // Totales
  totalCosto = Object.values(tratamientosPorDiente)
    .reduce((acc, t) => acc + (parseFloat(t.costo || 0)), 0);

  tratamientosGenerales.forEach(t => (totalCosto += parseFloat(t.costo || 0)));

  document.getElementById('totalCosto').textContent = `$${totalCosto.toFixed(2)}`;

  const meses = Math.max(1, parseInt(document.getElementById('mesesInput').value) || 1);
  const mensualidad = totalCosto / meses;
  document.getElementById('mensualidad').textContent = `$${mensualidad.toFixed(2)}`;
}

document.querySelectorAll('.general-treatment-checkbox').forEach(check => {
  check.addEventListener('change', () => {
    const costo = parseFloat(check.dataset.costo);
    const nombre = check.nextElementSibling.textContent.trim();

    if (check.checked) {
      // Evita duplicados
      if (!tratamientosGenerales.find(t => t.nombre === nombre)) {
        tratamientosGenerales.push({ nombre, costo });
      }
    } else {
      const idx = tratamientosGenerales.findIndex(t => t.nombre === nombre);
      if (idx > -1) tratamientosGenerales.splice(idx, 1);
    }

    actualizarCalculadora();
  });
});

document.getElementById('mesesInput').addEventListener('input', function () {
  let meses = parseInt(this.value) || 1;
  if (meses < 1) meses = 1;
  this.value = meses;
  const mensualidad = totalCosto / meses;
  document.getElementById('mensualidad').textContent = `$${mensualidad.toFixed(2)}`;
});

// ===============================
// Construcción de payloads
// ===============================
function obtenerTratamientosPorDiente() {
  // Leemos directo del estado para no depender del DOM
  return Object.entries(tratamientosPorDiente).map(([diente, t]) => ({
    diente,
    tratamiento: t.nombre,
    costo: Number(t.costo) || 0
  }));
}
function obtenerTratamientosGenerales() {
  return tratamientosGenerales.map(t => ({
    nombre: t.nombre,
    costo: Number(t.costo) || 0
  }));
}
function calcularPresupuesto() {
  const meses = Math.max(1, parseInt(document.getElementById('mesesInput').value) || 1);
  const mensualidad = totalCosto / meses;
  return {
    total: Number(totalCosto) || 0,
    mensualidad: Number(mensualidad) || 0,
    meses
  };
}

// ===============================
// Guardar Borrador
// ===============================
async function guardarBorradorInfantil() {
  try {
    if (!pacienteId) {
      msg.warn('Falta ID', 'Incluye ?paciente_id=<id> en la URL.');
      return;
    }
    if (!fechaInput.value || !pacienteSelect.value) {
      msg.warn('Datos incompletos', 'Verifica nombre y fecha.');
      return;
    }

    const payload = {
      paciente: {
        nombre: pacienteSelect.selectedOptions[0]?.textContent?.trim() || '',
        numeroPaciente: numeroPacienteInput.value || String(pacienteId),
        fechaRegistro: fechaInput.value
      },
      odontograma: obtenerTratamientosPorDiente(),        // [{diente,tratamiento,costo}]
      tratamientosGenerales: obtenerTratamientosGenerales(), // [{nombre,costo}]
      presupuesto: calcularPresupuesto()
    };

    const resp = await fetch(`/api/patients/${encodeURIComponent(pacienteId)}/diag-infantil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('❌ Error al guardar diag-infantil:', t);
      msg.error('Error', 'No se pudo guardar el diagnóstico infantil.');
      return;
    }

    const json = await resp.json();
    msg.success('Guardado', `Formulario guardado. Folio: ${json?.formulario_id ?? '—'}`);
  } catch (err) {
    console.error('❌ Conexión fallida:', err);
    msg.error('Error', 'No se pudo guardar (conexión).');
  }
}

// ===============================
// Generar PDF
// ===============================
async function generarPDFInfantil() {
  try {
    if (!pacienteId) {
      msg.warn('Falta ID', 'Incluye ?paciente_id=<id> en la URL.');
      return;
    }
    if (!pacienteSelect.value || !fechaInput.value) {
      msg.warn('Datos incompletos', 'Verifica nombre y fecha.');
      return;
    }

    // Captura visual del odontograma
    const odontogramaContainer = document.querySelector('.dientes-container');
    if (!odontogramaContainer) {
      msg.error('PDF', 'No se encontró el odontograma visual.');
      return;
    }
    const canvas = await html2canvas(odontogramaContainer, { backgroundColor: null, useCORS: true });
    const odontogramaVisual = canvas.toDataURL('image/png');

    const data = {
      paciente: {
        nombre: pacienteSelect.selectedOptions[0]?.textContent?.trim() || '',
        numeroPaciente: numeroPacienteInput.value || String(pacienteId),
        fechaRegistro: fechaInput.value
      },
      odontograma: obtenerTratamientosPorDiente(),
      tratamientosGenerales: obtenerTratamientosGenerales(),
      presupuesto: calcularPresupuesto(),
      odontogramaVisual
    };

    const res = await fetch('/api/pdf/diag-infantil/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const t = await res.text();
      console.error('❌ Error PDF infantil:', t);
      msg.error('PDF', 'No se pudo generar el PDF.');
      return;
    }

    const blob = await res.blob();

    // Abrir vista en nueva pestaña
    const viewUrl = URL.createObjectURL(blob);
    window.open(viewUrl, '_blank');

    // Nombre sugerido: YYYYMMDD_infantil_Nombre_Apellido.pdf
    const pacienteNombre = pacienteSelect.selectedOptions[0]?.textContent?.trim() || '';
    const nombreArchivo = buildDiagInfantilPdfName({
      pacienteNombre,
      fecha: fechaInput.value
    });

    sessionStorage.setItem('last_pdf_name', nombreArchivo);

    if (hasSwal()) {
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
    } else {
      downloadBlob(blob, nombreArchivo);
    }

    URL.revokeObjectURL(viewUrl);
  } catch (err) {
    console.error('❌ Conexión PDF:', err);
    msg.error('PDF', 'No se pudo generar el PDF (conexión).');
  }
}

// ===============================
// Submit del formulario
// ===============================
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarBorradorInfantil();
  });
}

// ===============================
// Botones de acción
// ===============================
if (btnGuardar) btnGuardar.addEventListener('click', guardarBorradorInfantil);
if (btnPdf)     btnPdf.addEventListener('click', generarPDFInfantil);

// ===============================
// Arranque
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  cargarPacienteInfantil();
});
