const token = localStorage.getItem('token');
if (!token) location.href = '/login.html';

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}

// Simulación de pacientes
const pacientes = [
  { nombre: 'Juan Pérez', edad: 34, telefono: '555-1234' },
  { nombre: 'Ana Gómez', edad: 28, telefono: '555-5678' },
  { nombre: 'Luis Torres', edad: 42, telefono: '555-9012' }
];

const tbody = document.querySelector('#tabla-pacientes tbody');
pacientes.forEach(p => {
  const fila = document.createElement('tr');
  fila.innerHTML = `<td>${p.nombre}</td><td>${p.edad}</td><td>${p.telefono}</td>`;
  tbody.appendChild(fila);
});
