// Mostrar paso 2
function showPatientStep() {
  const pacienteSelect = document.getElementById("pacienteSelect");
  const nombrePaciente =
    pacienteSelect.options[pacienteSelect.selectedIndex].text;
  const fechaRegistro = document.getElementById("fechaRegistroInput").value;
  const numeroPaciente = document.getElementById("numeroPacienteInput").value;
  const tratamiento = document.getElementById("tratamientoInput").value;
  const monto = document.getElementById("montoInput").value;
  const ausenciaDias = document.getElementById("ausenciaInput").value;

  // Pasar datos al Paso 2
  document.getElementById("confirmNombrePaciente").value = nombrePaciente;
  document.getElementById("confirmFecha").value = fechaRegistro;
  document.getElementById("confirmNumeroPaciente").value = numeroPaciente;
  document.getElementById("confirmTratamiento").value = tratamiento;
  document.getElementById("confirmMonto").textContent = monto || "0.00";
  document.getElementById("confirmAusencia").textContent = ausenciaDias || "0";

  // Cambiar vista
  document.getElementById("doctor-step").style.display = "none";
  document.getElementById("patient-step").style.display = "block";

  document.getElementById("step1-indicator").classList.remove("active");
  document.getElementById("step2-indicator").classList.add("active");
}

// Volver a paso 1
function showDoctorStep() {
  document.getElementById("patient-step").style.display = "none";
  document.getElementById("doctor-step").style.display = "block";

  document.getElementById("step2-indicator").classList.remove("active");
  document.getElementById("step1-indicator").classList.add("active");
}

// Captura final
document.getElementById("consentForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const pacienteSelect = document.getElementById("pacienteSelect");
  const nombrePaciente =
    pacienteSelect.options[pacienteSelect.selectedIndex].text;

  const data = {
    nombrePaciente: nombrePaciente,
    numeroPaciente: document.getElementById("numeroPacienteInput").value,
    fechaRegistro: document.getElementById("fechaRegistroInput").value,
    tratamiento: document.getElementById("tratamientoInput").value,
    monto: document.getElementById("montoInput").value,
    ausenciaDias: document.getElementById("ausenciaInput").value,
  };

  console.log("📄 Datos capturados:", data);
  alert("Formulario enviado (simulación). Revisa la consola.");
});


//Generar PDF
//Generar PDF
document.querySelector('.btn-info').addEventListener('click', async () => {
  const nombrePaciente = document.getElementById('confirmNombrePaciente').value;
  const fecha = document.getElementById('confirmFecha').value;
  const numeroPaciente = document.getElementById('confirmNumeroPaciente').value;
  const tratamiento = document.getElementById('confirmTratamiento').value;
  const monto = document.getElementById('confirmMonto').textContent;
  const ausencia = document.getElementById('confirmAusencia').textContent;

  // 👇 Capturar firma del paciente
  const canvas = document.getElementById('signature-pad');
  const firmaPaciente = canvas ? canvas.toDataURL("image/png") : null;

  const data = {
    paciente: { nombre: nombrePaciente, fecha, numeroPaciente },
    tratamiento,
    monto,
    ausencia,
    firmaPaciente // 👈 enviamos la firma al backend
  };

  const res = await fetch('/api/pdf/consentimiento/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});