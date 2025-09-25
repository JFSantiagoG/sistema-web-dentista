// Ir al paso 2
function showPatientStep() {
  const pacienteSelect = document.getElementById("pacienteSelect");
  const nombrePaciente = pacienteSelect.options[pacienteSelect.selectedIndex].text;
  const fechaRegistro = document.getElementById("fechaRegistroInput").value;
  const numeroPaciente = document.getElementById("numeroPacienteInput").value;
  const pronostico = document.getElementById("pronosticoInput").value;
  const condiciones = document.getElementById("condicionesInput").value;
  const recuperacion = document.getElementById("recuperacionInput").value;
  const acuerdo = document.getElementById("acuerdoInput").value;

  // Pasar datos a confirmación
  document.getElementById("confirmNombrePaciente").value = nombrePaciente;
  document.getElementById("confirmFecha").value = fechaRegistro;
  document.getElementById("confirmNumeroPaciente").value = numeroPaciente;
  document.getElementById("confirmPronostico").value = pronostico;
  document.getElementById("confirmCondiciones").value = condiciones;
  document.getElementById("confirmRecuperacion").textContent = recuperacion;
  document.getElementById("confirmAcuerdo").textContent = acuerdo;

  // Cambiar vista
  document.getElementById("doctor-step").style.display = "none";
  document.getElementById("patient-step").style.display = "block";
  document.getElementById("step1-indicator").classList.remove("active");
  document.getElementById("step2-indicator").classList.add("active");
}

// Volver al paso 1
function showDoctorStep() {
  document.getElementById("patient-step").style.display = "none";
  document.getElementById("doctor-step").style.display = "block";
  document.getElementById("step2-indicator").classList.remove("active");
  document.getElementById("step1-indicator").classList.add("active");
}

// Enviar formulario
document.getElementById("consentForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const data = {
    nombrePaciente: document.getElementById("confirmNombrePaciente").value,
    fechaRegistro: document.getElementById("confirmFecha").value,
    numeroPaciente: document.getElementById("confirmNumeroPaciente").value,
    pronostico: document.getElementById("confirmPronostico").value,
    condiciones: document.getElementById("confirmCondiciones").value,
    recuperacion: document.getElementById("confirmRecuperacion").textContent,
    acuerdo: document.getElementById("confirmAcuerdo").textContent,
  };

  console.log("📄 Datos capturados:", data);
  alert("Formulario enviado (simulación). Revisa la consola.");
});

//Generar PDF
document.querySelector('.btn-info').addEventListener('click', async () => {
  const data = {
    paciente: {
      nombre: document.getElementById('confirmNombrePaciente').value,
      fecha: document.getElementById('confirmFecha').value,
      numeroPaciente: document.getElementById('confirmNumeroPaciente').value
    },
    historiaClinica: document.getElementById('historiaCheck').checked,
    anestesia: document.getElementById('anestesiaCheck').checked,
    pronostico: document.getElementById('confirmPronostico').value,
    condiciones: document.getElementById('confirmCondiciones').value,
    pronosticoAceptado: document.getElementById('pronosticoCheck').checked,
    recuperacion: document.getElementById('confirmRecuperacion').textContent,
    recuperacionAceptada: document.getElementById('recuperacionCheck').checked,
    responsabilidad: document.getElementById('responsabilidadCheck').checked,
    acuerdo: document.getElementById('confirmAcuerdo').textContent,
    acuerdoAceptado: document.getElementById('economicoCheck').checked
  };

  const res = await fetch('/api/pdf/quirurgico/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
});
