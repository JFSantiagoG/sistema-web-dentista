const token = localStorage.getItem('token');
if (!token) location.href = '/login.html';

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}

// Simulación de citas del día
const citas = [
  { hora: '09:00', paciente: 'Juan Pérez', motivo: 'Revisión general' },
  { hora: '10:30', paciente: 'Ana Gómez', motivo: 'Dolor molar' },
  { hora: '12:00', paciente: 'Luis Torres', motivo: 'Limpieza dental' }
];

const tbody = document.querySelector('#tabla-citas tbody');
citas.forEach(cita => {
  const fila = document.createElement('tr');
  fila.innerHTML = `<td>${cita.hora}</td><td>${cita.paciente}</td><td>${cita.motivo}</td>`;
  tbody.appendChild(fila);
});
