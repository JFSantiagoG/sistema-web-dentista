document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('justificanteForm');
  const canvas = document.getElementById('signature-pad-justificante');

  // Cursor tipo X al activar firma
  if (canvas) {
    canvas.addEventListener("click", () => {
      canvas.style.cursor = "crosshair";
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const data = {
      fechaEmision:       form.fechaEmision.value,
      nombrePaciente:     form.nombrePaciente.value,
      procedimiento:      form.procedimiento.value,
      fechaProcedimiento: form.fechaProcedimiento.value,
      diasReposo:         form.diasReposo.value,
      firmaMedico:        canvas ? canvas.toDataURL("image/png") : null
    };

    const { firmaMedico, ...dataSinFirma } = data;
    console.log('Datos a enviar (sin firma):', dataSinFirma);

    if (firmaMedico) {
      const bytes = Math.round((firmaMedico.length * 3 / 4) / 1024);
      console.log(`🖊️ Firma presente (aprox. ${bytes} KB)`);
    } else {
      console.log('❌ Firma no presente');
    }

    try {
      const res = await fetch('/api/pdf/justificante/generate', {
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

  document.getElementById('descargarPDF')?.addEventListener('click', async () => {
  const canvas = document.getElementById('signature-pad-justificante');

  const data = {
    fechaEmision:       form.fechaEmision.value,
    nombrePaciente:     form.nombrePaciente.value,
    procedimiento:      form.procedimiento.value,
    fechaProcedimiento: form.fechaProcedimiento.value,
    diasReposo:         form.diasReposo.value,
    firmaMedico:        canvas ? canvas.toDataURL("image/png") : null
  };

  try {
    const res = await fetch('/api/pdf/justificante/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data)
    });

    if (!res.ok) throw new Error(`Status ${res.status}`);

    const blob = await res.blob();
    const url  = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Error al generar PDF desde botón:', err);
    alert('No se pudo generar el PDF. Revisa la consola.');
  }
});

});
