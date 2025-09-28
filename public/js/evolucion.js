// Variables globales
let contadorFilas = 0;

// Inicializar fecha de registro
document.addEventListener('DOMContentLoaded', function () {
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('fechaRegistroInput').value = hoy;

  // Agregar primera fila vacía
  agregarFila();
});

// Agregar nueva fila
function agregarFila() {
  contadorFilas++;
  const tbody = document.getElementById('evolucionTableBody');
  const filaId = `fila-${contadorFilas}`;

  const row = document.createElement('tr');
  row.id = filaId;
  row.innerHTML = `
    <td><input type="date" name="fecha" class="form-control form-control-sm required-field" required></td>
    <td>
        <select name="tratamiento" class="form-select form-select-sm tratamiento-select">
          <option value="">Seleccionar tratamiento...</option>
          <option value="Limpieza">Limpieza</option>
          <option value="Resina">Resina</option>
          <option value="Ortodoncia">Ortodoncia</option>
          <option value="Cirugía">Cirugía</option>
          <option value="Endodoncia">Endodoncia</option>
          <option value="Corona">Corona</option>
          <option value="Extracción">Extracción</option>
          <option value="Blanqueamiento">Blanqueamiento</option>
          <option value="Otro">Otro (especificar)</option>
        </select>
        <input type="text" name="otro" class="form-control form-control-sm mt-1 otro-tratamiento" 
               placeholder="Especificar tratamiento..." style="display: none;">
    </td>
    <td><input type="number" name="costo" class="form-control form-control-sm costo-input" placeholder="0.00" min="0" step="0.01"></td>
    <td><input type="text" name="ac" class="form-control form-control-sm" placeholder="Antecedentes/Comentarios"></td>
    <td><textarea name="proxima" class="form-control form-control-sm" rows="2" placeholder="Próxima cita y tratamiento a realizar..."></textarea></td>
    <td class="text-center">
        <button type="button" class="btn btn-remove-row" onclick="eliminarFila('${filaId}')" title="Eliminar entrada">🗑️</button>
    </td>
  `;

  tbody.appendChild(row);

  // Mostrar campo "Otro"
  const tratamientoSelect = row.querySelector('.tratamiento-select');
  const otroInput = row.querySelector('.otro-tratamiento');
  tratamientoSelect.addEventListener('change', function () {
    otroInput.style.display = this.value === 'Otro' ? 'block' : 'none';
  });
}

// Eliminar fila
function eliminarFila(filaId) {
  if (confirm('¿Está seguro de que desea eliminar esta entrada de evolución?')) {
    document.getElementById(filaId)?.remove();
  }
}

// Guardar evoluciones
function guardarEvoluciones() {
  const requiredFields = document.querySelectorAll('.required-field');
  let allValid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      allValid = false;
      field.classList.add('is-invalid');
    } else {
      field.classList.remove('is-invalid');
    }
  });

  if (!allValid) {
    alert('❌ Por favor, complete todos los campos requeridos (fecha).');
    return;
  }

  const filas = document.querySelectorAll('#evolucionTableBody tr');
  const evolucionesData = [];

  filas.forEach(fila => {
    const fecha = fila.querySelector('input[type="date"]').value;
    const tratamientoSelect = fila.querySelector('.tratamiento-select');
    const otroTratamiento = fila.querySelector('.otro-tratamiento');
    const costo = fila.querySelector('.costo-input').value;
    const ac = fila.querySelector('input[placeholder="Antecedentes/Comentarios"]').value;
    const proximaCita = fila.querySelector('textarea').value;

    let tratamiento = tratamientoSelect.value;
    if (tratamiento === 'Otro' && otroTratamiento.value.trim()) {
      tratamiento = otroTratamiento.value.trim();
    }

    evolucionesData.push({ fecha, tratamiento, costo: costo || 0, ac, proximaCita });
  });

  console.log('Evoluciones guardadas:', evolucionesData);
  alert('✅ Hoja de evolución guardada correctamente!');
}

// Generar PDF apuntando al gateway
async function generarPDFEvolucion() {
  const pacienteSelect = document.getElementById('pacienteSelect');
  const selectedOption = pacienteSelect.options[pacienteSelect.selectedIndex];

  const nombrePaciente = selectedOption.text;
  const idPaciente = selectedOption.value;
  const canvas = document.getElementById('signature-pad'); // 👈 reutilizamos firma.js

  if (!idPaciente) {
    alert('❌ Selecciona un paciente válido antes de generar el PDF.');
    return;
  }

  const data = {
    idPaciente,
    nombrePaciente,
    numeroPaciente: document.getElementById('numeroPacienteInput').value,
    fechaRegistro: document.getElementById('fechaRegistroInput').value,
    evoluciones: [],
    firmaPaciente: canvas ? canvas.toDataURL("image/png") : null // 👈 aquí se adjunta la firma
  };

  document.querySelectorAll('#evolucionTableBody tr').forEach(row => {
    data.evoluciones.push({
      fecha: row.querySelector('[name="fecha"]').value,
      tratamiento: row.querySelector('[name="tratamiento"]').value,
      costo: row.querySelector('[name="costo"]').value,
      ac: row.querySelector('[name="ac"]').value,
      proxima: row.querySelector('[name="proxima"]').value
    });
  });

  try {
    const res = await fetch('/api/pdf/evolucion/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Error al generar PDF de evolución:', err);
    alert('No se pudo generar el PDF.');
  }
}