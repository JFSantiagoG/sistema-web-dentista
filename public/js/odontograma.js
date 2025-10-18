document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('odontogramaForm');

  // 🦷 Interacción visual con los dientes
  document.querySelectorAll('.diente').forEach(diente => {
    diente.addEventListener('click', () => {
      diente.classList.toggle('tratamiento-asignado');
      diente.classList.remove('pendiente');
    });
  });

  // 🔄 Sincronizar tabla con dientes
  document.querySelectorAll('.tratamientos-tabla input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
      const dienteId = this.getAttribute('data-diente');
      const dienteElement = document.querySelector(`.diente[data-diente="${dienteId}"]`);
      if (dienteElement) {
        dienteElement.classList.toggle('tratamiento-asignado', this.checked);
      }
    });
  });

  // 🖨️ Botón "Descargar PDF"
  document.querySelector('.btn-info').addEventListener('click', () => {
    form.requestSubmit();
  });

  // 📤 Envío del formulario
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // ✅ Captura datos del paciente
    const nombrePaciente = form.querySelector('[name="nombrePaciente"]')?.value.trim();
    const fechaTermino   = form.querySelector('[name="fechaTermino"]')?.value.trim();

    if (!nombrePaciente || !fechaTermino) {
      alert('❌ Por favor completa el nombre y la fecha.');
      return;
    }

    // ✅ Captura tratamientos por diente
    const tratamientosPorDiente = {};
    document.querySelectorAll('.tratamientos-tabla tbody tr').forEach(fila => {
      const nombreTratamiento = fila.querySelector('td')?.textContent.trim();
      fila.querySelectorAll('input[type="checkbox"][data-diente]').forEach(checkbox => {
        const dienteId = checkbox.getAttribute('data-diente');
        if (checkbox.checked) {
          if (!tratamientosPorDiente[dienteId]) tratamientosPorDiente[dienteId] = [];
          tratamientosPorDiente[dienteId].push(nombreTratamiento);
        }
      });
    });

    // ✅ Captura estado de la encía
    const estadoEncia = {};
    document.querySelectorAll('.encia-table tbody tr').forEach(fila => {
      const condicion = fila.querySelector('td')?.textContent.trim();
      const valor     = fila.querySelector('input')?.value.trim();
      if (condicion && valor) estadoEncia[condicion] = valor;
    });

    // ✅ Captura visual del odontograma
    const odontogramaContainer = document.querySelector('.dientes-container');
    const odontogramaCanvas = await html2canvas(odontogramaContainer, {
      backgroundColor: null,
      useCORS: true
    });
    const odontogramaImg = odontogramaCanvas.toDataURL('image/png');

    // ✅ Arma el objeto final
    const data = {
      paciente: {
        nombre: nombrePaciente,
        fechaTermino
      },
      tratamientosPorDiente,
      estadoEncia,
      odontogramaVisual: odontogramaImg
    };

    console.log('📋 Datos del odontograma final:', data);

    // ✅ Envío al backend
    try {
      const res = await fetch('/api/pdf/odontograma/generate', {
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
});
