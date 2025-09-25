document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recetaForm');
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // 1. Armar JSON
    const data = {
      nombrePaciente: form.nombrePaciente.value,
      fecha:           form.fecha.value,
      edad:            form.edad.value,
      nombreMedico:    form.nombreMedico.value,
      cedula:          form.cedula.value,
      medicamentos:    []
    };

    document.querySelectorAll('#tablaMedicamentos tbody tr')
      .forEach(fila => {
        data.medicamentos.push({
          nombre:      fila.querySelector('[name="medicamento[]"]').value,
          dosis:       fila.querySelector('[name="dosis[]"]').value,
          frecuencia:  fila.querySelector('[name="frecuencia[]"]').value,
          duracion:    fila.querySelector('[name="duracion[]"]').value,
          indicaciones:fila.querySelector('[name="indicaciones[]"]').value
        });
      });

    console.log('Datos a enviar:', data);

    try {
      // 2. Llamada al gateway
      const res = await fetch('/api/pdf/receta/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      // 3. Abrir PDF en nueva pestaña
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('No se pudo generar el PDF. Revisa la consola.');
    }
  });
});
