const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');
if (!token || roles.length === 0) location.href = '/login.html';

const rol = roles[0]; // asumimos un solo rol por sesión

document.addEventListener('DOMContentLoaded', () => {
  configurarVistaPorRol();
  cargarCitas();
});

// 🔧 Adaptar vista por rol
function configurarVistaPorRol() {
  if (rol === 'medico') {
    document.querySelector('.col-acciones').style.display = 'none';
    document.getElementById('btn-eliminar').style.display = 'none';
    document.getElementById('btn-reenviar').style.display = 'none';
  }

  if (rol === 'asistente') {
    document.getElementById('btn-eliminar').style.display = 'none';
  }
}

// 📥 Cargar citas
async function cargarCitas() {
  try {
    const res = await fetch('/api/appointments/today', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const citas = await res.json();
    renderizarCitas(citas);
  } catch (err) {
    console.error('Error al cargar citas:', err);
  }
}

async function filtrarPorFecha() {
  const fecha = document.getElementById('filtro-fecha').value;
  if (!fecha) return;

  try {
    const res = await fetch(`/api/appointments/by-date/${fecha}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const citas = await res.json();
    renderizarCitas(citas);
  } catch (err) {
    console.error('Error al filtrar por fecha:', err);
  }
}

function recargarCitas() {
  const fecha = document.getElementById('filtro-fecha').value;
  fecha ? filtrarPorFecha() : cargarCitas();
}

// 🧱 Renderizar tabla
function renderizarCitas(citas) {
  const tbody = document.getElementById('citas-body');
  tbody.innerHTML = '';

  citas.forEach(cita => {
    const fila = document.createElement('tr');

    let acciones = `
      <button class="btn btn-primary" onclick="reenviar(${cita.id})">📤 Reenviar</button>
      <button class="btn btn-warning" onclick="posponer(${cita.id})">⏳ Posponer</button>
      <button class="btn btn-danger" onclick="cancelar(${cita.id})">❌ Cancelar</button>
    `;


    fila.innerHTML = `
      <td><input type="checkbox" class="check-cita" value="${cita.id}" onchange="actualizarAcciones()"></td>
      <td>${cita.id}</td>
      <td>${cita.nombre}</td>
      <td>${cita.fecha.split('T')[0]}</td>
      <td>${cita.hora}</td>
      <td>${cita.motivo}</td>
      <td class="col-acciones">${acciones}</td>
    `;

    tbody.appendChild(fila);
  });

  actualizarAcciones();
}

// ✅ Acciones masivas
function seleccionarTodos(master) {
  document.querySelectorAll('.check-cita').forEach(c => c.checked = master.checked);
  actualizarAcciones();
}

function actualizarAcciones() {
  const seleccionadas = document.querySelectorAll('.check-cita:checked');
  document.getElementById('acciones-masivas').style.display = seleccionadas.length > 0 ? 'block' : 'none';
}

async function eliminarSeleccionadas() {
  if (rol === 'medico') return;

  const ids = Array.from(document.querySelectorAll('.check-cita:checked')).map(c => c.value);
  if (!ids.length) return;

  const result = await Swal.fire({
    title: '¿Eliminar citas seleccionadas?',
    text: `Se eliminarán ${ids.length} citas.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  for (const id of ids) {
    await fetch(`/api/appointments/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  Swal.fire('Eliminadas', 'Las citas fueron eliminadas correctamente.', 'success');
  recargarCitas();
}

function reenviarSeleccionadas() {
  if (rol === 'medico') return;
  const ids = Array.from(document.querySelectorAll('.check-cita:checked')).map(c => c.value);
  if (!ids.length) return;
  Swal.fire('📤 Reenvío masivo', `Se reenviará información de las citas: ${ids.join(', ')}`, 'info');
}

// 🔁 Funciones individuales
async function reenviar(id) {
  const result = await Swal.fire({
    title: '¿Reenviar información?',
    text: `Esto notificará al paciente de la cita #${id}.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, reenviar',
    cancelButtonText: 'Cancelar'
  });

  if (!result.isConfirmed) return;

  await fetch(`/api/appointments/${id}/resend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });

  Swal.fire('Reenviado', `Información enviada para la cita #${id}`, 'success');
}

async function cancelar(id) {
  const result = await Swal.fire({
    title: '¿Cancelar cita?',
    text: `La cita #${id} será eliminada permanentemente.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, cancelar',
    cancelButtonText: 'No'
  });

  if (!result.isConfirmed) return;

  await fetch(`/api/appointments/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  Swal.fire('Cancelada', `La cita #${id} fue cancelada.`, 'success');
  recargarCitas();
}

async function posponer(id) {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    const { value: nuevaFecha } = await Swal.fire({
      title: 'Selecciona nueva fecha',
      input: 'date',
      inputAttributes: { min: hoy },
      showCancelButton: true,
      confirmButtonText: 'Siguiente'
    });

    if (!nuevaFecha) return;

    const horasRes = await fetch(`/api/appointments/available-hours/${nuevaFecha}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const horas = await horasRes.json();
    if (!horas.length) {
      Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
      return;
    }

    const { value: nuevaHora } = await Swal.fire({
      title: 'Selecciona nueva hora',
      input: 'select',
      inputOptions: Object.fromEntries(horas.map(h => [h, h])),
      showCancelButton: true,
      confirmButtonText: 'Confirmar'
    });

    if (!nuevaHora) return;

    const nuevaFechaHora = `${nuevaFecha} ${nuevaHora}`;

    const confirm = await Swal.fire({
      title: 'Confirmar cambio',
      html: `¿Mover la cita <b>#${id}</b> a <b>${nuevaFechaHora}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar'
    });

    if (!confirm.isConfirmed) return;

    const putRes = await fetch(`/api/appointments/${id}/postpone`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ nuevaFecha: nuevaFechaHora })
    });

    if (putRes.ok) {
      Swal.fire('Pospuesta', `La cita #${id} fue movida a ${nuevaFechaHora}.`, 'success');
      recargarCitas();
    } else {
      Swal.fire('Error', 'No se pudo posponer la cita.', 'error');
    }
  } catch (err) {
    console.error('Error al posponer cita:', err);
    Swal.fire('Error', 'No se pudo posponer la cita.', 'error');
  }
}
