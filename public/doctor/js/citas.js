const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');
if (!token || !roles.includes('doctor')) location.href = '/login.html';

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
    if (!Array.isArray(citas)) throw new Error('Respuesta inválida');
    renderizarCitas(citas);
  } catch (err) {
    console.error('Error al filtrar por fecha:', err);
  }
}

function recargarCitas() {
  const fecha = document.getElementById('filtro-fecha').value;
  if (fecha) {
    filtrarPorFecha();
  } else {
    cargarCitas();
  }
}

function renderizarCitas(citas) {
  const tbody = document.getElementById('citas-body');
  tbody.innerHTML = '';

  citas.forEach(cita => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td><input type="checkbox" class="check-cita" value="${cita.id}" onchange="actualizarAcciones()"></td>
      <td>${cita.id}</td>
      <td>${cita.nombre}</td>
      <td>${cita.fecha.split('T')[0]}</td>
      <td>${cita.hora}</td>
      <td>${cita.motivo}</td>
      <td>
        <button class="btn btn-primary" onclick="reenviar(${cita.id})">📤</button>
        <button class="btn btn-danger" onclick="cancelar(${cita.id})">❌</button>
        <button class="btn btn-warning" onclick="posponer(${cita.id})">⏳</button>
      </td>
    `;

    tbody.appendChild(fila);
  });

  actualizarAcciones();
}

function seleccionarTodos(master) {
  const checks = document.querySelectorAll('.check-cita');
  checks.forEach(c => c.checked = master.checked);
  actualizarAcciones();
}

function actualizarAcciones() {
  const seleccionadas = document.querySelectorAll('.check-cita:checked');
  document.getElementById('acciones-masivas').style.display = seleccionadas.length > 0 ? 'block' : 'none';
}

async function eliminarSeleccionadas() {
  const ids = Array.from(document.querySelectorAll('.check-cita:checked')).map(c => c.value);
  if (ids.length === 0) return;

  const result = await Swal.fire({
    title: '¿Eliminar citas seleccionadas?',
    text: `Se eliminarán ${ids.length} citas. Esta acción no se puede deshacer.`,
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
  const ids = Array.from(document.querySelectorAll('.check-cita:checked')).map(c => c.value);
  if (ids.length === 0) return;

  Swal.fire('📤 Reenvío masivo', `Se reenviará información de las citas: ${ids.join(', ')}`, 'info');
}

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
    const toLocalISODate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    // === 1. No permitir días anteriores ===
    const hoyLocal = new Date();
    const minDate = toLocalISODate(hoyLocal);

    const { value: fechaSeleccionada, isConfirmed: fechaConfirmada } = await Swal.fire({
      title: 'Selecciona nueva fecha',
      html: `<input type="date" id="fecha-nueva" class="swal2-input" min="${minDate}" />`,
      didOpen: () => {
        const input = document.getElementById('fecha-nueva');
        input.min = minDate;
        input.value = minDate;
      },
      focusConfirm: false,
      preConfirm: () => {
        const seleccionada = document.getElementById('fecha-nueva').value;
        if (!seleccionada) {
          Swal.showValidationMessage('Selecciona una fecha');
          return false;
        }
        if (seleccionada < minDate) {
          Swal.showValidationMessage('No puedes elegir días anteriores al día actual');
          return false;
        }
        return seleccionada;
      },
      showCancelButton: true,
      confirmButtonText: 'Siguiente',
      cancelButtonText: 'Cancelar'
    });

    if (!fechaConfirmada || !fechaSeleccionada) return; // salir completamente

    // === 2. Cargar horas disponibles filtradas ===
    const ts = () => `?ts=${Date.now()}`;
    const normH = (h) => {
      if (!h) return '';
      const [HH, MM] = String(h).split(':');
      return `${String(HH).padStart(2, '0')}:${String((MM || '00')).padStart(2, '0')}`;
    };

    const [horasRes, citasRes] = await Promise.all([
      fetch(`/api/appointments/available-hours/${fechaSeleccionada}${ts()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      }),
      fetch(`/api/appointments/by-date/${fechaSeleccionada}${ts()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      })
    ]);

    if (!horasRes.ok || !citasRes.ok) {
      Swal.fire('Error', 'No se pudieron obtener los horarios disponibles.', 'error');
      return;
    }

    let horas = await horasRes.json();
    const citasDelDia = await citasRes.json();

    const ocupadas = new Set(
      Array.isArray(citasDelDia) ? citasDelDia.map(c => normH(c.hora)).filter(Boolean) : []
    );

    horas = Array.isArray(horas)
      ? Array.from(new Set(horas.map(normH))).filter(h => !ocupadas.has(h))
      : [];

    if (!horas.length) {
      Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
      return;
    }

    // === 3. Elegir hora ===
    const { value: horaSeleccionada, isConfirmed: horaConfirmada } = await Swal.fire({
      title: 'Selecciona nueva hora',
      html: `
        <select id="hora-nueva" class="swal2-input">
          ${horas.map(h => `<option value="${h}">${h}</option>`).join('')}
        </select>
      `,
      focusConfirm: false,
      preConfirm: () => document.getElementById('hora-nueva').value,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar'
    });

    if (!horaConfirmada || !horaSeleccionada) return; // salir si cancela

    const nuevaFecha = `${fechaSeleccionada} ${horaSeleccionada}`;

    // === 4. Confirmar cambio ===
    const confirm = await Swal.fire({
      title: 'Confirmar cambio',
      html: `¿Deseas mover la cita <b>#${id}</b> a <b>${fechaSeleccionada}</b> a las <b>${horaSeleccionada}</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'No, cancelar'
    });

    if (!confirm.isConfirmed) return; // salir si cancela

    // === 5. Enviar al backend ===
    const putRes = await fetch(`/api/appointments/${id}/postpone${ts()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ nuevaFecha }),
      cache: 'no-store'
    });

    if (putRes.ok) {
      Swal.fire('Pospuesta', `La cita #${id} fue movida a ${nuevaFecha}.`, 'success');
      recargarCitas();
      return;
    }

    if (putRes.status === 409) {
      Swal.fire('Horario ocupado', 'Ese horario acaba de ocuparse. Intenta con otro.', 'warning');
      return;
    }

    Swal.fire('Error', 'No se pudo posponer la cita.', 'error');

  } catch (err) {
    console.error('Error al posponer cita:', err);
    Swal.fire('Error', 'No se pudo posponer la cita.', 'error');
  }
}



cargarCitas();