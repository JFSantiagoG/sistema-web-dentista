        // Variables globales
        const tratamientosPorDiente = {};
        const tratamientosGenerales = [];
        let totalCosto = 0;
        let dienteActual = null;

        // Inicializar modal de Bootstrap
        const tratamientoModal = new bootstrap.Modal(document.getElementById('tratamientoModal'));

        // Mostrar modal al hacer clic en un diente
        document.querySelectorAll('.diente').forEach(diente => {
            diente.addEventListener('click', () => {
                const dienteId = diente.getAttribute('data-diente');
                dienteActual = dienteId;
                
                // Limpiar campos del modal
                document.getElementById('dienteSeleccionado').value = dienteId;
                document.getElementById('dienteNumero').value = dienteId;
                document.getElementById('tratamientoSelect').value = '';
                document.getElementById('costoInput').value = '';
                document.getElementById('otroTratamientoInput').value = '';
                document.getElementById('otroTratamientoDiv').style.display = 'none';
                
                // Mostrar modal
                tratamientoModal.show();
            });
        });

        // Mostrar campo "Otro" cuando se selecciona esa opción
        document.getElementById('tratamientoSelect').addEventListener('change', function() {
            const otroDiv = document.getElementById('otroTratamientoDiv');
            if (this.value === 'Otro') {
                otroDiv.style.display = 'block';
            } else {
                otroDiv.style.display = 'none';
            }
        });

        // Guardar tratamiento
        document.getElementById('guardarTratamientoBtn').addEventListener('click', function() {
            const dienteId = document.getElementById('dienteSeleccionado').value;
            const tratamientoSelect = document.getElementById('tratamientoSelect');
            const otroInput = document.getElementById('otroTratamientoInput');
            const costoInput = document.getElementById('costoInput');
            
            let tratamientoNombre = tratamientoSelect.value;
            const costo = parseFloat(costoInput.value) || 0;
            
            // Validar selección de tratamiento
            if (!tratamientoNombre) {
                alert('❌ Por favor, seleccione un tratamiento');
                return;
            }
            
            // Si es "Otro", usar el valor del input
            if (tratamientoNombre === 'Otro') {
                tratamientoNombre = otroInput.value.trim();
                if (!tratamientoNombre) {
                    alert('❌ Por favor, especifique el nombre del tratamiento');
                    return;
                }
            }
            
            // Validar costo
            if (costo <= 0) {
                alert('❌ Por favor, ingrese un costo válido');
                return;
            }
            
            // Guardar tratamiento
            tratamientosPorDiente[dienteId] = { 
                nombre: tratamientoNombre, 
                costo: costo 
            };
            
            // Actualizar visualización del diente
            const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
            if (dienteElement) {
                dienteElement.classList.add('tratamiento-asignado');
            }
            
            // Actualizar tablas
            actualizarTablaTratamientos();
            actualizarCalculadora();
            
            // Cerrar modal
            tratamientoModal.hide();
        });

        // Función para actualizar la tabla de tratamientos
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

        // Función para actualizar la calculadora de presupuesto
        function actualizarCalculadora() {
            const costosTablaBody = document.getElementById('costosTablaBody');
            costosTablaBody.innerHTML = '';

            // Agregar tratamientos por diente
            Object.values(tratamientosPorDiente).forEach(tratamiento => {
                if (tratamiento.costo > 0) {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${tratamiento.nombre} (Diente ${Object.keys(tratamientosPorDiente).find(key => tratamientosPorDiente[key] === tratamiento)})</td>
                        <td>$${parseFloat(tratamiento.costo).toFixed(2)}</td>
                    `;
                    costosTablaBody.appendChild(row);
                }
            });

            // Agregar tratamientos generales
            tratamientosGenerales.forEach(tratamiento => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${tratamiento.nombre}</td>
                    <td>$${parseFloat(tratamiento.costo).toFixed(2)}</td>
                `;
                costosTablaBody.appendChild(row);
            });

            // Calcular el total
            totalCosto = Object.values(tratamientosPorDiente)
                .filter(t => t.costo > 0)
                .reduce((acc, t) => acc + parseFloat(t.costo), 0);

            tratamientosGenerales.forEach(t => {
                totalCosto += parseFloat(t.costo);
            });

            document.getElementById('totalCosto').textContent = `$${totalCosto.toFixed(2)}`;

            // Calcular mensualidad
            const meses = parseInt(document.getElementById('mesesInput').value) || 1;
            const mensualidad = totalCosto / meses;
            document.getElementById('mensualidad').textContent = `$${mensualidad.toFixed(2)}`;
        }

        // Manejar checkboxes de tratamientos generales
        document.querySelectorAll('.general-treatment-checkbox').forEach(check => {
            check.addEventListener('change', () => {
                const costo = parseFloat(check.dataset.costo);
                const nombre = check.nextElementSibling.textContent.trim();

                if (check.checked) {
                    tratamientosGenerales.push({ nombre, costo });
                } else {
                    const index = tratamientosGenerales.findIndex(t => t.nombre === nombre);
                    if (index > -1) {
                        tratamientosGenerales.splice(index, 1);
                    }
                }

                actualizarCalculadora();
            });
        });

        // Validación del formulario
        document.getElementById('presupuestoForm').addEventListener('submit', function(e) {
            e.preventDefault();

            // Validar campos requeridos
            const pacienteSelect = document.getElementById('pacienteSelect');
            const fechaInput = document.getElementById('fechaInput');

            if (!pacienteSelect.value || !fechaInput.value) {
                alert('❌ Por favor, complete todos los campos requeridos antes de enviar.');
                return;
            }

            // Mostrar mensaje de éxito
            alert('✅ Formulario enviado correctamente!\n(En una implementación real, aquí se guardarían los datos)');
        });

        // Calcular mensualidad cuando cambia el número de meses
        document.getElementById('mesesInput').addEventListener('input', function() {
            if (totalCosto > 0) {
                const meses = parseInt(this.value) || 1;
                const mensualidad = totalCosto / meses;
                document.getElementById('mensualidad').textContent = `$${mensualidad.toFixed(2)}`;
            }
        });
// Botón "🖨️ Descargar PDF"
document.querySelector('.btn-info').addEventListener('click', async () => {
  const pacienteSelect = document.getElementById('pacienteSelect');
  const fechaInput = document.getElementById('fechaInput');
  const numeroInput = document.getElementById('numeroPacienteInput');
  const mesesInput = document.getElementById('mesesInput');

  if (!pacienteSelect.value || !fechaInput.value) {
    alert('❌ Por favor, completa nombre y fecha antes de generar el PDF.');
    return;
  }

  const paciente = {
    nombre: pacienteSelect.selectedOptions[0].textContent.trim(),
    id: pacienteSelect.value,
    fecha: fechaInput.value,
    numero: numeroInput.value || '—'
  };

  const meses = parseInt(mesesInput.value) || 1;
  const mensualidad = totalCosto / meses;

  // Captura visual del odontograma
  const odontogramaContainer = document.querySelector('.dientes-container');
  const canvas = await html2canvas(odontogramaContainer, {
    backgroundColor: null,
    useCORS: true
  });
  const odontogramaVisual = canvas.toDataURL('image/png');

  const data = {
    paciente,
    odontograma: Object.entries(tratamientosPorDiente).map(([diente, t]) => ({
      diente,
      tratamiento: t.nombre,
      costo: t.costo
    })),
    tratamientosGenerales,
    presupuesto: {
      total: totalCosto,
      mensualidad,
      meses
    },
    odontogramaVisual
  };

  console.log('📤 Enviando datos para PDF infantil:', data);

  try {
    const res = await fetch('/api/pdf/diag-infantil/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error(`Error ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('❌ Error al generar PDF:', err);
    alert('No se pudo generar el PDF. Revisa la consola.');
  }
});
