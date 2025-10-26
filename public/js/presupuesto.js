// Variables globales
const tratamientosPorDiente = {};
const tratamientosGenerales = [];
let totalCosto = 0;
let dienteActual = null;

// Inicializar modal de Bootstrap
const tratamientoModal = new bootstrap.Modal(document.getElementById("tratamientoModal"));

// Mostrar modal al hacer clic en un diente
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

// Mostrar campo "Otro"
document.getElementById("tratamientoSelect").addEventListener("change", function () {
  const otroDiv = document.getElementById("otroTratamientoDiv");
  otroDiv.style.display = this.value === "Otro" ? "block" : "none";
});

// Guardar tratamiento
document.getElementById("guardarTratamientoBtn").addEventListener("click", function () {
  const dienteId = document.getElementById("dienteSeleccionado").value;
  const tratamientoSelect = document.getElementById("tratamientoSelect");
  const otroInput = document.getElementById("otroTratamientoInput");
  const costoInput = document.getElementById("costoInput");

  let tratamientoNombre = tratamientoSelect.value;
  const costo = parseFloat(costoInput.value) || 0;

  if (!tratamientoNombre) {
    alert("❌ Por favor, seleccione un tratamiento");
    return;
  }

  if (tratamientoNombre === "Otro") {
    tratamientoNombre = otroInput.value.trim();
    if (!tratamientoNombre) {
      alert("❌ Por favor, especifique el nombre del tratamiento");
      return;
    }
  }

  if (costo <= 0) {
    alert("❌ Por favor, ingrese un costo válido");
    return;
  }

  tratamientosPorDiente[dienteId] = { nombre: tratamientoNombre, costo: costo };

  const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
  if (dienteElement) {
    dienteElement.classList.add("tratamiento-asignado");
  }

  actualizarTablaTratamientos();
  actualizarCalculadora();

  tratamientoModal.hide();
});

// Actualizar tabla de tratamientos
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

// Actualizar calculadora
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

  const meses = parseInt(document.getElementById("mesesInput").value) || 1;
  const mensualidad = totalCosto / meses;
  document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
}

// Checkbox de tratamientos generales
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

// Validación del formulario
document.getElementById("presupuestoForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const pacienteSelect = document.getElementById("pacienteSelect");
  const fechaInput = document.getElementById("fechaInput");

  if (!pacienteSelect.value || !fechaInput.value) {
    alert("❌ Por favor, complete todos los campos requeridos antes de enviar.");
    return;
  }

  alert("✅ Formulario enviado correctamente!\n(En una implementación real, aquí se guardarían los datos)");
});

// Calcular mensualidad en tiempo real
document.getElementById("mesesInput").addEventListener("input", function () {
  if (totalCosto > 0) {
    const meses = parseInt(this.value) || 1;
    const mensualidad = totalCosto / meses;
    document.getElementById("mensualidad").textContent = `$${mensualidad.toFixed(2)}`;
  }
});


// Generar PDF
async function generarPDFPresupuesto() {
  const pacienteSelect = document.getElementById('pacienteSelect');
  const nombrePaciente = pacienteSelect.options[pacienteSelect.selectedIndex].text;

  // Validación básica
  if (!pacienteSelect.value || nombrePaciente === 'Seleccionar paciente...') {
    alert('❌ Por favor selecciona un paciente válido.');
    return;
  }

  // Captura visual del odontograma
  const odontogramaContainer = document.querySelector('.dientes-container');
  if (!odontogramaContainer) {
    alert('❌ No se encontró el contenedor del odontograma.');
    return;
  }

  const odontogramaCanvas = await html2canvas(document.querySelector('.dientes-container'), {
    backgroundColor: null,
    useCORS: true // por si hay imágenes externas
  });
  const odontogramaImg = odontogramaCanvas.toDataURL('image/png');

  const data = {
    paciente: {
      nombre: nombrePaciente,
      numeroPaciente: document.getElementById('numeroPacienteInput').value,
      fechaRegistro: document.getElementById('fechaInput').value
    },
    odontograma: obtenerTratamientosPorDiente(),
    tratamientosGenerales: obtenerTratamientosGenerales(),
    presupuesto: calcularPresupuesto(),
    odontogramaVisual: odontogramaImg // ← imagen base64 del odontograma
  };

  try {
    const res = await fetch('/api/pdf/presupuesto/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ Error al generar PDF:', errorText);
      alert('No se pudo generar el PDF.');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('❌ Error de conexión al generar PDF:', err);
    alert('Hubo un problema al generar el PDF.');
  }
}
//end generarPDFPresupuesto


function obtenerTratamientosPorDiente() {//Función para obtener los tratamientos por diente desde la tabla
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
function obtenerTratamientosGenerales() {//Función para obtener los tratamientos generales seleccionados
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
  const meses = parseInt(document.getElementById('mesesInput').value);

  return {
    total: parseFloat(totalTexto),
    mensualidad: parseFloat(mensualTexto),
    meses
  };
}