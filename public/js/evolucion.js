// Variables globales
let evoluciones = [];
let contadorFilas = 0;
let filaFirmaActual = null;
const firmaModal = new bootstrap.Modal(document.getElementById('firmaModal'));

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
        <input type="text" name="otro" class="form-control form-control-sm mt-1 otro-tratamiento" placeholder="Especificar tratamiento..." style="display: none;">
    </td>
    <td><input type="number" name="costo" class="form-control form-control-sm costo-input" placeholder="0.00" min="0" step="0.01"></td>
    <td><input type="text" name="ac" class="form-control form-control-sm" placeholder="Antecedentes/Comentarios"></td>
    <td><textarea name="proxima" class="form-control form-control-sm" rows="2" placeholder="Próxima cita y tratamiento a realizar..."></textarea></td>
    <td>
        <button type="button" class="btn btn-outline-secondary btn-sm w-100 firma-btn" onclick="abrirModalFirma('${filaId}')">📝 Firmar</button>
        <div class="firma-indicador mt-1 text-success" style="display: none; font-size: 0.8rem;">✅ Firmado</div>
    </td>
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

// Modal firma
function abrirModalFirma(filaId) {
  filaFirmaActual = filaId;
  document.getElementById('filaFirmaActual').value = filaId;
  document.getElementById('imagenFirma').value = '';
  firmaModal.show();
}

function guardarFirma() {
  const imagenFirma = document.getElementById('imagenFirma');
  if (imagenFirma.files.length > 0 || confirm('¿Desea guardar la firma digital?')) {
    const fila = document.getElementById(filaFirmaActual);
    if (fila) {
      fila.querySelector('.firma-btn').style.display = 'none';
      fila.querySelector('.firma-indicador').style.display = 'block';
    }
    firmaModal.hide();
    alert('✅ Firma guardada correctamente');
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
    const tieneFirma = fila.querySelector('.firma-indicador').style.display !== 'none';

    let tratamiento = tratamientoSelect.value;
    if (tratamiento === 'Otro' && otroTratamiento.value.trim()) {
      tratamiento = otroTratamiento.value.trim();
    }

    evolucionesData.push({ fecha, tratamiento, costo: costo || 0, ac, proximaCita, tieneFirma });
  });

  if (!evolucionesData.length) {
    alert('❌ No hay entradas de evolución para guardar.');
    return;
  }

  evolucionesData.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  console.log('Evoluciones guardadas:', evolucionesData);
  alert('✅ Hoja de evolución guardada correctamente!');
}

// Filtrar por fechas
function filtrarPorFechas() {
  const fechaInicio = document.getElementById('fechaInicio').value;
  const fechaFin = document.getElementById('fechaFin').value;

  if (!fechaInicio || !fechaFin) {
    alert('❌ Seleccione ambas fechas para filtrar.');
    return;
  }
  if (new Date(fechaInicio) > new Date(fechaFin)) {
    alert('❌ La fecha de inicio no puede ser posterior a la fecha de fin.');
    return;
  }

  const filas = document.querySelectorAll('#evolucionTableBody tr');
  filas.forEach(fila => {
    const fechaFila = fila.querySelector('input[type="date"]').value;
    if (fechaFila) {
      const fecha = new Date(fechaFila);
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fila.style.display = fecha >= inicio && fecha <= fin ? '' : 'none';
    }
  });
}

// Limpiar filtros
function limpiarFiltros() {
  document.getElementById('fechaInicio').value = '';
  document.getElementById('fechaFin').value = '';
  document.querySelectorAll('#evolucionTableBody tr').forEach(fila => fila.style.display = '');
}

// Validación al enviar
document.addEventListener('submit', function (e) {
  e.preventDefault();
  guardarEvoluciones();
});


//Generar PDF apuntando a la nueva ruta en el gateway
async function generarPDFEvolucion() {
  if (!validarCamposEvolucion()) {
    alert('Por favor completa todos los campos antes de generar el PDF.');
    return;
  }

  const pacienteSelect = document.getElementById('pacienteSelect');
  const selectedOption = pacienteSelect.options[pacienteSelect.selectedIndex];

  const nombrePaciente = selectedOption.text;   // <-- Nombre visible
  const idPaciente = selectedOption.value;   

  if (!pacienteSelect.value || nombrePaciente === 'Seleccionar paciente...') {
    alert('❌ Por favor selecciona un paciente válido antes de generar el PDF.');
    return;
  }


  const data = {
    idPaciente: idPaciente,
    nombrePaciente: nombrePaciente,
    numeroPaciente: document.getElementById('numeroPacienteInput').value,
    fechaRegistro: document.getElementById('fechaRegistroInput').value,
    evoluciones: []
  };

  document.querySelectorAll('#evolucionTableBody tr').forEach(row => {
    const getValue = name => {
      const el = row.querySelector(`[name="${name}"]`);
      return el ? el.value.trim() : '';
    };

    data.evoluciones.push({
      fecha:     getValue('fecha'),
      tratamiento: getValue('tratamiento'),
      costo:     getValue('costo'),
      ac:        getValue('ac'),
      proxima:   getValue('proxima'),
      firma:     getValue('firma')
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



function validarCamposEvolucion() {
  let esValido = true;

  document.querySelectorAll('#evolucionTableBody tr').forEach((row, index) => {
    row.querySelectorAll('input, select, textarea').forEach(input => {
      const valor = input.value?.trim();
      const nombre = input.getAttribute('name') || 'sin nombre';

      // Ignorar campo "otro" si está oculto
      if (nombre === 'otro' && input.style.display === 'none') return;

      if (!valor) {
        input.classList.add('is-invalid');
        esValido = false;
        console.warn(`Fila ${index + 1}: Falta completar el campo "${nombre}"`);
      } else {
        input.classList.remove('is-invalid');
        input.classList.add('is-valid');
      }
    });
  });

  return esValido;
}


