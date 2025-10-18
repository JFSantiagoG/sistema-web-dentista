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
    const colAcciones = document.querySelector('.col-acciones');
    if (colAcciones) colAcciones.style.display = 'none';
    const btnEliminar = document.getElementById('btn-eliminar');
    const btnReenviar = document.getElementById('btn-reenviar');
    if (btnEliminar) btnEliminar.style.display = 'none';
    if (btnReenviar) btnReenviar.style.display = 'none';
  }

  if (rol === 'asistente') {
    const btnEliminar = document.getElementById('btn-eliminar');
    if (btnEliminar) btnEliminar.style.display = 'none';
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

// 🔎 Devuelve el nombre del paciente con todos los fallbacks posibles
function getNombrePaciente(c) {
  // aliases típicos que puede mandar el backend
  const alias =
    c.nombre_paciente ??
    c.paciente ??
    c.paciente_nombre ??
    c.nombrePaciente ??
    (c.pac_nombre || c.pac_apellido
      ? `${c.pac_nombre ?? ''} ${c.pac_apellido ?? ''}`.trim()
      : null) ??
    (c.nombre || c.apellido
      ? `${c.nombre ?? ''} ${c.apellido ?? ''}`.trim()
      : null);

  return alias && alias.trim() ? alias : '—';
}


// ---------- Helpers de formato ----------
function fmtHora(h) {
  if (!h) return '';
  return String(h).slice(0, 5); // '10:00:00' -> '10:00'
}
function fmtFechaISO(fechaStr) {
  // admite 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:mm:ss'
  if (!fechaStr) return '';
  return String(fechaStr).split('T')[0];
}

// 🧱 Renderizar tabla (ACTUALIZADO para hora_inicio/hora_fin)
function renderizarCitas(citas) {
  const tbody = document.getElementById('citas-body');
  tbody.innerHTML = '';

  citas.forEach(cita => {
    const fila = document.createElement('tr');

    const horaInicio = fmtHora(cita.hora_inicio || cita.hora || '');
    const horaFin    = fmtHora(cita.hora_fin || '');

    const acciones = `
      <button class="btn btn-primary" onclick="reenviar(${cita.id})">📤 Reenviar</button>
      <button class="btn btn-warning" onclick="posponer(${cita.id})">⏳ Posponer</button>
      <button class="btn btn-danger" onclick="cancelar(${cita.id})">❌ Cancelar</button>
    `;

    fila.innerHTML = `
      <td><input type="checkbox" class="check-cita" value="${cita.id}" onchange="actualizarAcciones()"></td>
      <td>${cita.id}</td>
      <td>${getNombrePaciente(cita)}</td>   <!-- 👈 aquí el fix -->
      <td>${fmtFechaISO(cita.fecha)}</td>
      <td>${horaInicio}</td>
      <td>${horaFin}</td>
      <td>${cita.motivo || ''}</td>
      <td class="col-acciones">${acciones}</td>
    `;

    tbody.appendChild(fila);
  });

  actualizarAcciones();
}


// ✅ Acciones masivas
function seleccionarTodos(master) {
  document.querySelectorAll('.check-cita').forEach(c => (c.checked = master.checked));
  actualizarAcciones();
}

function actualizarAcciones() {
  const seleccionadas = document.querySelectorAll('.check-cita:checked');
  const cont = document.getElementById('acciones-masivas');
  if (cont) cont.style.display = seleccionadas.length > 0 ? 'block' : 'none';
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

    // 1) Seleccionar nueva fecha
    const { value: nuevaFecha } = await Swal.fire({
      title: 'Selecciona nueva fecha',
      input: 'date',
      inputAttributes: { min: hoy },
      showCancelButton: true,
      confirmButtonText: 'Siguiente'
    });
    if (!nuevaFecha) return;

    // 2) Cargar horas libres de ese día
    const respHoras = await fetch(`/api/appointments/available-hours/${nuevaFecha}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const libres = await respHoras.json();
    if (!Array.isArray(libres) || libres.length === 0) {
      return Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
    }

    // Helper para construir finales contiguos (30m)
    const toMin = s => { const [H,M]=s.split(':').map(Number); return H*60+M; };
    const toStr = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    const setLibres = new Set(libres.map(h => String(h).slice(0,5)));

    const construirFines = (hi) => {
      const out = [];
      let m = toMin(hi) + 30; // primer fin posible: +30
      // mientras cada bloque previo esté libre y el bloque siguiente exista
      while (true) {
        const fin = toStr(m);
        const inicioPrev = toStr(m - 30);
        if (!setLibres.has(inicioPrev)) break; // el bloque [m-30, m) no está libre
        out.push(fin);
        if (!setLibres.has(fin)) break; // para extender, el siguiente bloque debe existir libre
        m += 30;
      }
      return out;
    };

    // 3) Elegir hora de inicio
    const { value: horaInicio } = await Swal.fire({
      title: 'Hora de inicio',
      input: 'select',
      inputOptions: Object.fromEntries(libres.map(h => [h, h])),
      showCancelButton: true,
      confirmButtonText: 'Siguiente'
    });
    if (!horaInicio) return;

    // 4) Elegir hora de fin (en función de contigüidad)
    const finales = construirFines(horaInicio);
    if (finales.length === 0) {
      return Swal.fire('Duración no disponible', 'Solo hay 30 minutos o no hay bloques contiguos libres.', 'info');
    }

    const { value: horaFin } = await Swal.fire({
      title: 'Hora de fin',
      input: 'select',
      inputOptions: Object.fromEntries(finales.map(h => [h, h])),
      showCancelButton: true,
      confirmButtonText: 'Confirmar'
    });
    if (!horaFin) return;

    // 5) Confirmación
    const confirm = await Swal.fire({
      title: 'Confirmar cambio',
      html: `¿Mover la cita <b>#${id}</b> a <b>${nuevaFecha}</b> de <b>${horaInicio}</b> a <b>${horaFin}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar'
    });
    if (!confirm.isConfirmed) return;

    // 6) Llamada al backend (nuevo cuerpo)
    const putRes = await fetch(`/api/appointments/${id}/postpone`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fecha: nuevaFecha, horaInicio, horaFin })
    });

    const json = await putRes.json().catch(() => ({}));

    if (putRes.status === 409 && json.conflictos) {
      return Swal.fire('Conflicto de horario', `Bloques ocupados: ${json.conflictos.join(', ')}`, 'warning');
    }
    if (!putRes.ok) {
      throw new Error(json.error || `Status ${putRes.status}`);
    }

    Swal.fire('Pospuesta', `La cita #${id} fue movida a ${nuevaFecha} ${horaInicio}–${horaFin}.`, 'success');
    recargarCitas();
  } catch (err) {
    console.error('Error al posponer cita:', err);
    Swal.fire('Error', 'No se pudo posponer la cita.', 'error');
  }
}