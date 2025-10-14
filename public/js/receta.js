document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('recetaForm');
  const canvas = document.getElementById('signature-pad');

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const data = {
      nombrePaciente: form.nombrePaciente.value,
      fecha:           form.fecha.value,
      edad:            form.edad.value,
      nombreMedico:    form.nombreMedico.value,
      cedula:          form.cedula.value,
      medicamentos:    [],
      firmaMedico:     canvas ? canvas.toDataURL("image/png") : null
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

    // ✅ Log limpio (sin firma)
    const { firmaMedico, ...dataSinFirma } = data;
    console.log('Datos a enviar (sin firma):', dataSinFirma);

    if (firmaMedico) {
      const bytes = Math.round((firmaMedico.length * 3 / 4) / 1024);
      console.log(`🖊️ Firma presente (aprox. ${bytes} KB)`);
    } else {
      console.log('❌ Firma no presente');
    }

    try {
      const res = await fetch('/api/pdf/receta/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data)
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);

      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('No se pudo generar el PDF. Revisa la consola.');
    }
  });
});