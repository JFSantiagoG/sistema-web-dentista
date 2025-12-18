// ======================= presupuesto.js (flujo corregido) =======================

// ===== Helpers de fecha/nombre/descarga =====
const hoyYYYYMMDD = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

function toYYYYMMDD(val) {
  if (!val) return hoyYYYYMMDD();
  if (val instanceof Date) {
    const yyyy = val.getFullYear();
    const mm = String(val.getMonth() + 1).padStart(2, '0');
    const dd = String(val.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.slice(0, 10);
  return s;
}

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
    .trim()
    .split(/\s+/).filter(Boolean)
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
const pacienteId   = qs.get('paciente_id') || qs.get('id');
const formularioId = qs.get('formulario_id');

const token = localStorage.getItem('token');
const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

const nombreInput = document.getElementById('nombrePacienteInput');
const fechaInput  = document.getElementById('fechaInput');
const numeroInput = document.getElementById('numeroPacienteInput');

const btnGuardar = document.getElementById('btnGuardar');
const btnPdf     = document.getElementById('btnPdf');
const btnEnviar  = document.getElementById('btnEnviar');
const form       = document.getElementById('presupuestoForm');

const generalChecks = Array.from(document.querySelectorAll('.general-treatment-checkbox'));

// ===== Estado =====
const tratamientosPorDiente = {};
const tratamientosGenerales = [];
let totalCosto = 0;
let dienteActual = null;

// ===== Modal =====
const tratamientoModalEl = document.getElementById("tratamientoModal");
const tratamientoModal = tratamientoModalEl ? new bootstrap.Modal(tratamientoModalEl) : null;

// ===== Modo crear: cargar paciente =====
async function cargarPaciente() {
  if (!pacienteId) {
    await Swal.fire({ icon:'warning', title:'Falta ID', text:'Incluye ?paciente_id=<id> en la URL.' });
    return;
  }
  try {
    const res = await fetch(`/api/patients/${pacienteId}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    // ✅ Construir nombre completo
    const nombreCompleto = [p?.nombre, p?.apellido, p?.apellido_paterno, p?.apellido_materno]
      .filter(Boolean).join(' ').trim();

    nombreInput.value = nombreCompleto || '(Sin nombre)';
    nombreInput.readOnly = true;

    fechaInput.value = hoyYYYYMMDD();
    fechaInput.readOnly = true;

    numeroInput.value = String(pacienteId);
    numeroInput.readOnly = true;

    // ✅ Guardar el teléfono del paciente (ajusta el campo según tu API)
    // Campos comunes: 'telefono', 'tel1', 'celular', 'telefono_principal', etc.
    const telefono = p?.telefono || p?.tel1 || p?.telefono_principal || p?.celular || null;
    window.telefonoPaciente = telefono; // lo hacemos accesible globalmente

  } catch (err) {
    console.error('Error al cargar paciente:', err);
    await Swal.fire({ icon:'error', title:'Error', text:'No se pudo cargar el paciente.' });
    window.telefonoPaciente = null; // por seguridad
  }
}

// ===== Interacción con dientes =====
function marcarDiente(dienteId) {
  const el = document.querySelector(`.diente[data-diente="${dienteId}"]`);
  if (el) el.classList.add('tratamiento-asignado');
}

function enableTeethClicks(enable) {
  document.querySelectorAll(".diente").forEach(original => {
    const clone = original.cloneNode(true);
    original.replaceWith(clone);
  });
  if (enable) {
    document.querySelectorAll(".diente").forEach(diente => {
      diente.style.cursor = 'pointer';
      diente.addEventListener("click", () => {
        const dienteId = diente.getAttribute("data-diente");
        dienteActual = dienteId;

        document.getElementById("dienteSeleccionado").value = dienteId;
        document.getElementById("dienteNumero").value = dienteId;
        document.getElementById("tratamientoSelect").value = "";
        document.getElementById("costoInput").value = "";
        document.getElementById("otroTratamientoInput").value = "";
        document.getElementById("otroTratamientoDiv").style.display = "none";

        if (tratamientoModal) tratamientoModal.show();
      });
    });
  } else {
    document.querySelectorAll(".diente").forEach(diente => diente.style.cursor = 'default');
  }
}

// ===== Modal listeners =====
const selectTrat = document.getElementById("tratamientoSelect");
if (selectTrat) {
  selectTrat.addEventListener("change", function () {
    document.getElementById("otroTratamientoDiv").style.display = this.value === "Otro" ? "block" : "none";
  });
}

const btnGuardarTrat = document.getElementById("guardarTratamientoBtn");
if (btnGuardarTrat) {
  btnGuardarTrat.addEventListener("click", function () {
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
    marcarDiente(dienteId);

    actualizarTablaTratamientos();
    actualizarCalculadora();
    if (tratamientoModal) tratamientoModal.hide();
  });
}

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

  totalCosto = Object.values(tratamientosPorDiente)
    .reduce((acc, t) => acc + parseFloat(t.costo || 0), 0);
  tratamientosGenerales.forEach(t => (totalCosto += parseFloat(t.costo)));

  document.getElementById("totalCosto").textContent = `$${totalCosto.toFixed(2)}`;

  const mesesEl = document.getElementById("mesesInput");
  const meses = Math.max(1, parseInt(mesesEl.value) || 1);
  const mensualidad = totalCosto / meses;
  document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
}

generalChecks.forEach(check => {
  check.addEventListener("change", () => {
    const costo = parseFloat(check.dataset.costo);
    const nombre = check.nextElementSibling.textContent.trim();

    if (check.checked) {
      if (!tratamientosGenerales.some(t => t.nombre === nombre)) {
        tratamientosGenerales.push({ nombre, costo });
      }
    } else {
      const idx = tratamientosGenerales.findIndex(t => t.nombre === nombre);
      if (idx > -1) tratamientosGenerales.splice(idx, 1);
    }
    actualizarCalculadora();
  });
});

const mesesInputEl = document.getElementById("mesesInput");
if (mesesInputEl) {
  mesesInputEl.addEventListener("input", function () {
    const meses = Math.max(1, parseInt(this.value) || 1);
    this.value = meses;
    if (totalCosto >= 0) {
      const mensualidad = totalCosto / meses;
      document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
    }
  });
}

// ===== Payloads =====
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
  const generales = [];
  generalChecks.forEach(cb => {
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

// ===== Guardar (borrador) =====
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
    odontograma: obtenerTratamientosPorDiente(),
    tratamientosGenerales: obtenerTratamientosGenerales(),
    presupuesto: calcularPresupuesto()
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

// ===== Enviar (SIEMPRE simulado, NO guarda) =====
async function enviarPorWhatsApp() {
  const totalTexto = document.getElementById('totalCosto').textContent.replace('$', '').trim();
  const mensualTexto = document.getElementById('mensualidad').textContent.replace('$', '').trim();

  const total = parseFloat(totalTexto) || 0;
  const mensual = parseFloat(mensualTexto) || 0;

  const telefono = window.telefonoPaciente;
  if (!telefono) {
    await Swal.fire({
      icon: 'warning',
      title: 'Teléfono no disponible',
      text: 'No se encontró el número de teléfono del paciente para enviar el mensaje.'
    });
    return;
  }

  // Validar formato MX (10 dígitos)
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.length !== 10) {
    await Swal.fire({
      icon: 'warning',
      title: 'Teléfono inválido',
      text: 'El número de teléfono del paciente debe tener 10 dígitos (formato MX).'
    });
    return;
  }

  const mensaje = `Hola, aquí está tu presupuesto dental:\n\n` +
    ` *Presupuesto Total:* $${total.toFixed(2)}\n` +
    ` *Pago Mensual:* $${mensual.toFixed(2)}\n\n` +
    `¡Gracias por confiar en nuestro consultorio!`;

  // URL de WhatsApp (formato internacional: +52 + número sin 0 ni 1 al inicio)
  const url = `https://wa.me/52${soloDigitos}?text=${encodeURIComponent(mensaje)}`;

  // Confirmar antes de abrir
  const confirm = await Swal.fire({
    title: '¿Enviar presupuesto por WhatsApp?',
    html: `Se abrirá WhatsApp con el siguiente mensaje:<br><br><pre style="text-align:left;background:#f8f9fa;padding:10px;border-radius:5px;">${mensaje}</pre>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: '✅ Sí, enviar',
    cancelButtonText: 'Cancelar'
  });

  if (confirm.isConfirmed) {
    window.open(url, '_blank');
  }
}

// ===== PDF =====
async function generarPDFPresupuesto() {
  const odontogramaContainer = document.querySelector('.dientes-container');
  if (!odontogramaContainer) {
    await Swal.fire({ icon:'error', title:'Error', text:'No se encontró el odontograma visual.' });
    return;
  }

  const pre = await Swal.fire({
    icon:'info',
    title:'Se abrirá el PDF en otra pestaña',
    text:'Al volver verás la opción para descargar con nombre sugerido.',
    confirmButtonText:'Entendido'
  });
  if (!pre.isConfirmed) return;

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
    const viewUrl = URL.createObjectURL(blob);
    window.open(viewUrl, '_blank');

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
    if (post.isConfirmed) downloadBlob(blob, filename);

    URL.revokeObjectURL(viewUrl);
  } catch (err) {
    console.error('❌ Conexión PDF:', err);
    await Swal.fire({ icon:'error', title:'PDF', text:'No se pudo generar el PDF (conexión).' });
  }
}

// ===== Visualización desde formularioId =====
function setSoloLecturaUI() {
  // Oculta Guardar, deja Enviar (simulado) y PDF
  if (btnGuardar) btnGuardar.style.display = 'none';

  // Bloquea edición
  enableTeethClicks(false);
  const mesesInput = document.getElementById('mesesInput');
  if (mesesInput) mesesInput.readOnly = true;

  // Deshabilita campos del modal
  ['tratamientoSelect','costoInput','otroTratamientoInput','guardarTratamientoBtn']
    .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });

  // Deshabilita checkboxes generales (después de marcarlos desde backend)
  generalChecks.forEach(cb => { cb.disabled = true; });
}

function marcarGeneralesDesdeBackend(generalesArr) {
  const nombres = new Set((generalesArr || []).map(g => String(g.nombre).trim()));
  generalChecks.forEach(cb => {
    const nombre = cb.nextElementSibling.textContent.trim();
    cb.checked = nombres.has(nombre);
  });

  tratamientosGenerales.length = 0;
  generalChecks.forEach(cb => {
    if (cb.checked) {
      tratamientosGenerales.push({
        nombre: cb.nextElementSibling.textContent.trim(),
        costo: parseFloat(cb.dataset.costo)
      });
    }
  });
}

async function cargarPresupuestoDesdeServidor() {
  try {
    const res = await fetch(`/api/patients/forms/presupuesto/${formularioId}`, { headers: authHeaders });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.ok) throw new Error('Respuesta inválida');

    // Identificación
    nombreInput.value = json.paciente || '(Sin nombre)';
    nombreInput.readOnly = true;

    fechaInput.value = toYYYYMMDD(json.fecha || json.datos?.fecha || hoyYYYYMMDD());
    fechaInput.readOnly = true;

    numeroInput.value = String(json.paciente_id || '');
    numeroInput.readOnly = true;

    // Reset estado local
    Object.keys(tratamientosPorDiente).forEach(k => delete tratamientosPorDiente[k]);
    tratamientosGenerales.length = 0;

    // Detalle por diente
    (json.datos?.odontograma || []).forEach(item => {
      const d = String(item.diente);
      tratamientosPorDiente[d] = {
        nombre: item.tratamiento || 'Sin tratamiento',
        costo: Number(item.costo || 0)
      };
      marcarDiente(d);
    });

    // Generales marcados + bloquear edición
    marcarGeneralesDesdeBackend(json.datos?.tratamientosGenerales || []);

    // Meses/totales
    if (json.datos?.meses) {
      const m = document.getElementById('mesesInput');
      if (m) m.value = Number(json.datos.meses);
    }

    actualizarTablaTratamientos();
    actualizarCalculadora();

    if (typeof json.datos?.total === 'number') {
      document.getElementById('totalCosto').textContent = `$${Number(json.datos.total).toFixed(2)}`;
    }
    if (typeof json.datos?.mensualidad === 'number') {
      document.getElementById('mensualidad').textContent = `$${Number(json.datos.mensualidad).toFixed(2)}`;
    }

    setSoloLecturaUI();
  } catch (err) {
    console.error('❌ Error al cargar presupuesto:', err);
    await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el presupuesto.' });
  }
}

// ===== Submit & botones =====
// IMPORTANTE: "Enviar" siempre es simulado (NO guarda) en ambos modos.
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await enviarPorWhatsApp();
  });
}

if (btnEnviar) {
  btnEnviar.addEventListener('click', async (e) => {
    e.preventDefault();
    await enviarPorWhatsApp();
  });
}

// Guardar solo en modo crear (paciente_id)
if (btnGuardar) {
  btnGuardar.addEventListener('click', async (e) => {
    e.preventDefault();
    if (formularioId) {
      await Swal.fire({ icon:'info', title:'Sólo visualización', text:'Este folio es de sólo lectura.' });
      return;
    }
    await guardarBorrador();
  });
}

if (btnPdf) btnPdf.addEventListener('click', generarPDFPresupuesto);

// ===== Arranque =====
document.addEventListener('DOMContentLoaded', () => {
  if (formularioId) {
    cargarPresupuestoDesdeServidor(); // Visualizar
  } else {
    cargarPaciente();
    enableTeethClicks(true);                  // ← activa los clicks en los dientes
    document.querySelectorAll('.general-treatment-checkbox')
      .forEach(cb => { cb.disabled = false; });// ← asegúrate que los generales son editables
  }
});

document.getElementById('anio-actual').textContent = new Date().getFullYear();