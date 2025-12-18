// 📁 Combined Agenda + Citas — Gestión unificada de citas y modal de creación
const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');

if (!token || roles.length === 0) {
  location.href = '/login.html';
}

const rol = roles[0]; // asumimos un solo rol por sesión

// =============== DOMContentLoaded ===============
document.addEventListener('DOMContentLoaded', () => {
  // Agenda
  configurarVistaPorRol();
  cargarCitas();

  // Modal "Nueva cita" (antes en citas.js)
  inicializarModalNuevaCita();
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
  const fecha = document.getElementById('filtro-fecha')?.value;
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
  const fecha = document.getElementById('filtro-fecha')?.value;
  fecha ? filtrarPorFecha() : cargarCitas();
}

// 🔎 Devuelve el nombre del paciente con todos los fallbacks posibles
function getNombrePaciente(c) {
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
  return String(h).slice(0, 5);
}
function fmtFechaISO(fechaStr) {
  if (!fechaStr) return '';
  return String(fechaStr).split('T')[0];
}
function getSelectedIds() {
  return Array.from(document.querySelectorAll('.check-cita:checked')).map(c => c.value);
}

// 🧱 Renderizar tabla
function renderizarCitas(citas) {
  const tbody = document.getElementById('citas-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  citas.forEach(cita => {
    const fila = document.createElement('tr');

    const horaInicio = fmtHora(cita.hora_inicio || cita.hora || '');
    const horaFin = fmtHora(cita.hora_fin || '');

    const acciones = `
      <button class="btn btn-primary" onclick="reenviar(${cita.id})">📤 Contactar</button>
      <button class="btn btn-warning" onclick="posponer(${cita.id})">⏳ Posponer</button>
      <button class="btn btn-danger" onclick="cancelar(${cita.id})">❌ Cancelar</button>
    `;

    fila.innerHTML = `
      <td><input type="checkbox" class="check-cita" value="${cita.id}" onchange="actualizarAcciones()"></td>
      <td>${cita.id}</td>
      <td>${getNombrePaciente(cita)}</td>
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

  const ids = getSelectedIds();
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
  const ids = getSelectedIds();
  if (!ids.length) return;
  Swal.fire('📤 Reenvío masivo', `Se reenviará información de las citas: ${ids.join(', ')}`, 'info');
}

// 🔁 Funciones individuales
async function reenviar(id) {
  // 1. Cargar los datos completos de la cita
  try {
    const res = await fetch(`/api/appointments/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Cita no encontrada: ${res.status}`);
    const cita = await res.json();

    // 2. Extraer datos
    const nombrePaciente = getNombrePaciente(cita);
    const fecha = fmtFechaISO(cita.fecha);
    const horaInicio = fmtHora(cita.hora_inicio || cita.hora || '');
    const horaFin = fmtHora(cita.hora_fin || '');
    const motivo = cita.motivo || 'Consulta dental';

    // 3. Obtener número del paciente
    const pacienteId = cita.pacienteId || cita.paciente?.id || cita.paciente_id;
    if (!pacienteId) {
      return Swal.fire('Error', 'No se encontró el ID del paciente.', 'error');
    }

    const pacienteRes = await fetch(`/api/patients/${pacienteId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!pacienteRes.ok) throw new Error('Paciente no encontrado');
    const paciente = await pacienteRes.json();

    // Normalizar teléfono (igual que en receta.js)
    const normalizarTelefono = (telefonoRaw) => {
      if (!telefonoRaw) return null;
      const limpio = String(telefonoRaw).replace(/\D/g, '');
      if (limpio.length === 10) return '52' + limpio; // MX
      if (limpio.length >= 11 && limpio.length <= 15) return limpio;
      return null;
    };

    const numero =
      normalizarTelefono(paciente.telefono_principal) ||
      normalizarTelefono(paciente.telefono_secundario) ||
      normalizarTelefono(paciente.telefono) ||
      normalizarTelefono(paciente.celular) ||
      normalizarTelefono(paciente.whatsapp);

    if (!numero || !/^\d{10,15}$/.test(numero)) {
      return Swal.fire({
        icon: 'warning',
        title: 'Número no disponible',
        text: 'El paciente no tiene un número de WhatsApp válido registrado.'
      });
    }

    const CAL = '\u{1F4C5}'; // 📅
    const CLK = '\u{1F557}'; // 🕗
    const TOOTH = '\u{1F9B7}'; // 🦷 (ojo: puede fallar en algunos equipos)

    const mensaje =
      `Hola ${nombrePaciente}, le recordamos su cita dental:\n\n` +
      ` Fecha: ${fecha}\n` +
      ` Hora: ${horaInicio} – ${horaFin}\n` +
      ` Motivo: ${motivo}\n\n` +
      `Por favor, confirme su asistencia. ¡Gracias!`;


    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');

  } catch (err) {
    console.error('Error al reenviar por WhatsApp:', err);
    Swal.fire('Error', 'No se pudo cargar la información de la cita o del paciente.', 'error');
  }
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

    const respHoras = await fetch(`/api/appointments/available-hours/${nuevaFecha}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const libres = await respHoras.json();
    if (!Array.isArray(libres) || libres.length === 0) {
      return Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
    }

    const toMin = s => { const [H,M]=s.split(':').map(Number); return H*60+M; };
    const toStr = m => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    const setLibres = new Set(libres.map(h => String(h).slice(0,5)));

    const construirFines = (hi) => {
      const out = [];
      let m = toMin(hi) + 30;
      while (true) {
        const fin = toStr(m);
        const inicioPrev = toStr(m - 30);
        if (!setLibres.has(inicioPrev)) break;
        out.push(fin);
        if (!setLibres.has(fin)) break;
        m += 30;
      }
      return out;
    };

    const { value: horaInicio } = await Swal.fire({
      title: 'Hora de inicio',
      html: `<div class="swal2-custom"><select id="swal-hi" class="swal2-select"></select></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Siguiente',
      didOpen: () => {
        const sel = document.getElementById('swal-hi');
        for (const h of libres) {
          const opt = document.createElement('option');
          opt.value = h;
          opt.textContent = h;
          sel.appendChild(opt);
        }
      },
      preConfirm: () => {
        const v = document.getElementById('swal-hi').value;
        if (!v) Swal.showValidationMessage('Selecciona una hora de inicio');
        return v;
      }
    });
    if (!horaInicio) return;

    const finales = construirFines(horaInicio);
    if (finales.length === 0) {
      return Swal.fire('Duración no disponible', 'Solo hay 30 minutos o no hay bloques contiguos libres.', 'info');
    }

    const { value: horaFin } = await Swal.fire({
      title: 'Hora de fin',
      html: `<div class="swal2-custom"><select id="swal-hf" class="swal2-select"></select></div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      didOpen: () => {
        const sel = document.getElementById('swal-hf');
        for (const h of finales) {
          const opt = document.createElement('option');
          opt.value = h;
          opt.textContent = h;
          sel.appendChild(opt);
        }
      },
      preConfirm: () => {
        const v = document.getElementById('swal-hf').value;
        if (!v) Swal.showValidationMessage('Selecciona una hora de fin');
        return v;
      }
    });
    if (!horaFin) return;

    const confirm = await Swal.fire({
      title: 'Confirmar cambio',
      html: `¿Mover la cita <b>#${id}</b> a <b>${nuevaFecha}</b> de <b>${horaInicio}</b> a <b>${horaFin}</b>?`,
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

// =============== MODAL "NUEVA CITA" ===============
let pacienteSel = null;
let horasLibres = [];

function inicializarModalNuevaCita() {
  const btnNueva = document.getElementById('btn-nueva-cita');
  const modal = document.getElementById('modal-cita');
  if (!btnNueva || !modal) return;

  const btnCerrar = document.getElementById('btn-cerrar-modal');
  const qInput = document.getElementById('paciente-q');
  const btnBuscar = document.getElementById('btn-buscar-paciente');
  const listPac = document.getElementById('pacientes-list');
  const seleccionadoBox = document.getElementById('paciente-seleccionado');

  const fechaInput = document.getElementById('nueva-fecha');
  const btnCargarHoras = document.getElementById('btn-cargar-horas');
  const selInicio = document.getElementById('hora-inicio');
  const selFin = document.getElementById('hora-fin');
  const motivoInput = document.getElementById('motivo');
  const btnGuardar = document.getElementById('btn-guardar-cita');

  btnNueva.addEventListener('click', () => {
    mostrarModal(true);
    resetModal();
  });
  btnCerrar.addEventListener('click', () => mostrarModal(false));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) mostrarModal(false);
  });

  btnBuscar?.addEventListener('click', () => buscarPacientes(qInput, listPac, seleccionadoBox));
  btnCargarHoras?.addEventListener('click', () => cargarHorasDelDia(fechaInput, selInicio, selFin));
  selInicio?.addEventListener('change', () => recalcularFines(selInicio, selFin));
  btnGuardar?.addEventListener('click', () => guardarCitaRango(
    pacienteSel, fechaInput, selInicio, selFin, motivoInput, modal
  ));
}

function mostrarModal(show) {
  const modal = document.getElementById('modal-cita');
  if (!modal) return;
  if (show) {
    modal.classList.remove('d-none');
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
  } else {
    modal.style.display = 'none';
    resetModal();
  }
}

function resetModal() {
  pacienteSel = null;
  horasLibres = [];
  const qInput = document.getElementById('paciente-q');
  const listPac = document.getElementById('pacientes-list');
  const seleccionadoBox = document.getElementById('paciente-seleccionado');
  const fechaInput = document.getElementById('nueva-fecha');
  const selInicio = document.getElementById('hora-inicio');
  const selFin = document.getElementById('hora-fin');
  const motivoInput = document.getElementById('motivo');

  if (qInput) qInput.value = '';
  if (listPac) listPac.innerHTML = '';
  if (seleccionadoBox) {
    seleccionadoBox.classList.add('d-none');
    seleccionadoBox.textContent = '';
  }
  if (fechaInput) fechaInput.value = '';
  if (selInicio) selInicio.innerHTML = '';
  if (selFin) selFin.innerHTML = '';
  if (motivoInput) motivoInput.value = '';
}

async function buscarPacientes(qInput, listPac, seleccionadoBox) {
  const q = (qInput?.value || '').trim();
  if (q.length < 2) {
    return Swal.fire('Buscar paciente', 'Escribe al menos 2 caracteres', 'info');
  }

  const url = `/api/patients/search?q=${encodeURIComponent(q)}&page=1`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const pacientes = Array.isArray(data.pacientes) ? data.pacientes : [];
    listPac.innerHTML = '';

    if (!pacientes.length) {
      const vacio = document.createElement('li');
      vacio.className = 'list-group-item';
      vacio.textContent = 'Sin resultados';
      listPac.appendChild(vacio);
      return;
    }

    pacientes.forEach(p => {
      const item = {
        id: p.id,
        nombre: p.nombre || '',
        apellido: p.apellido || '',
        email: p.email || '',
        telefono: p.telefono_principal || p.telefono || p.telefono_secundario || ''
      };

      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action';
      li.textContent = `${item.nombre} ${item.apellido} — ${item.telefono || 'sin teléfono'} — ${item.email || 'sin email'}`;
      li.addEventListener('click', () => {
        pacienteSel = item;
        seleccionadoBox.classList.remove('d-none');
        seleccionadoBox.textContent = `Paciente: ${item.nombre} ${item.apellido} | ${item.telefono || ''} | ${item.email || ''}`;
      });
      listPac.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudieron cargar pacientes.', 'error');
  }
}

async function cargarHorasDelDia(fechaInput, selInicio, selFin) {
  const fecha = fechaInput?.value;
  if (!fecha) return Swal.fire('Fecha', 'Selecciona una fecha', 'info');

  try {
    const libres = await fetch(`/api/appointments/available-hours/${fecha}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());

    horasLibres = Array.isArray(libres) ? libres.map(normalizar) : [];
    selInicio.innerHTML = '';
    horasLibres.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      selInicio.appendChild(opt);
    });
    selFin.innerHTML = '';
    if (!horasLibres.length) {
      Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudieron cargar horas disponibles.', 'error');
  }
}

function recalcularFines(selInicio, selFin) {
  const hi = normalizar(selInicio.value);
  selFin.innerHTML = '';
  if (!hi) return;

  const opcionesFin = construirFinesContiguos(hi, horasLibres);
  opcionesFin.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    selFin.appendChild(opt);
  });
}

async function guardarCitaRango(pacienteSel, fechaInput, selInicio, selFin, motivoInput, modal) {
  try {
    if (!pacienteSel) return Swal.fire('Paciente', 'Selecciona un paciente', 'info');
    const fecha = fechaInput.value;
    if (!fecha) return Swal.fire('Fecha', 'Selecciona una fecha', 'info');
    const horaInicio = normalizar(selInicio.value);
    const horaFin = normalizar(selFin.value);
    if (!horaInicio || !horaFin) return Swal.fire('Horario', 'Selecciona inicio y fin', 'info');

    const body = {
      pacienteId: pacienteSel.id,
      fecha,
      horaInicio,
      horaFin,
      motivo: motivoInput.value || ''
    };

    const resp = await fetch('/api/appointments/range', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      if (resp.status === 409 && json.conflictos) {
        return Swal.fire('Conflicto de horario', `Bloques ocupados: ${json.conflictos.join(', ')}`, 'warning');
      }
      throw new Error(json.error || `Status ${resp.status}`);
    }

    Swal.fire('Cita creada', json.message || 'La cita fue registrada correctamente.', 'success');
    mostrarModal(false);

    if (typeof window.recargarCitas === 'function') {
      window.recargarCitas();
    } else {
      location.reload();
    }
  } catch (e) {
    console.error(e);
    Swal.fire('Error', 'No se pudo crear la cita.', 'error');
  }
}

// ------- Utilidades -------
function normalizar(t) {
  return t ? t.slice(0, 5) : '';
}

function construirFinesContiguos(horaInicio, libresHHMM) {
  const toMin = s => {
    const [H, M] = s.split(':').map(Number);
    return H * 60 + M;
  };
  const toStr = m => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;

  const setLibres = new Set(libresHHMM);
  const result = [];
  let actual = toMin(horaInicio) + 30;

  while (true) {
    const next = toStr(actual);
    const inicioBloque = toStr(actual - 30);
    if (!setLibres.has(inicioBloque)) break;
    result.push(next);
    if (!setLibres.has(next)) break;
    actual += 30;
  }
  return result;
}

document.getElementById('anio-actual').textContent = new Date().getFullYear();