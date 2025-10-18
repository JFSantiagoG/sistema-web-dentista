// citas.js — controla el modal "Nueva cita" y la creación por rango
const tokenCitas = localStorage.getItem('token');
const rolesCitas = JSON.parse(localStorage.getItem('roles') || '[]');

(function () {
  // Elementos del modal
  let btnNueva, modal, btnCerrar;
  let qInput, btnBuscar, listPac, seleccionadoBox;
  let fechaInput, btnCargarHoras, selInicio, selFin, motivoInput, btnGuardar;

  // Estado
  let pacienteSel = null;
  let horasLibres = [];

  document.addEventListener('DOMContentLoaded', () => {
    // Vincular elementos
    btnNueva        = document.getElementById('btn-nueva-cita');
    modal           = document.getElementById('modal-cita');
    btnCerrar       = document.getElementById('btn-cerrar-modal');

    qInput          = document.getElementById('paciente-q');
    btnBuscar       = document.getElementById('btn-buscar-paciente');
    listPac         = document.getElementById('pacientes-list');
    seleccionadoBox = document.getElementById('paciente-seleccionado');

    fechaInput      = document.getElementById('nueva-fecha');
    btnCargarHoras  = document.getElementById('btn-cargar-horas');
    selInicio       = document.getElementById('hora-inicio');
    selFin          = document.getElementById('hora-fin');
    motivoInput     = document.getElementById('motivo');
    btnGuardar      = document.getElementById('btn-guardar-cita');

    // Si el HTML aún no tiene el modal/botón, no hacemos nada
    if (!btnNueva || !modal) return;

    // Abrir / Cerrar modal
    btnNueva.addEventListener('click', () => { mostrarModal(true); resetModal(); });
    btnCerrar.addEventListener('click', () => mostrarModal(false));
    modal.addEventListener('click', (e) => {
      // cerrar al hacer click fuera del cuadro
      if (e.target === modal) mostrarModal(false);
    });

    // Buscar pacientes (usa el MISMO backend que pacientes.js)
    btnBuscar.addEventListener('click', buscarPacientes);

    // Cargar horas disponibles
    btnCargarHoras.addEventListener('click', cargarHorasDelDia);

    // Cambio de hora inicio => recalcula opciones de fin contiguas
    selInicio.addEventListener('change', recalcularFines);

    // Guardar cita por rango
    btnGuardar.addEventListener('click', guardarCitaRango);
  });

  function mostrarModal(show) {
    if (!modal) return;
    modal.classList.toggle('d-none', !show);
    if (show) {
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
    } else {
      modal.style.display = 'none';
      resetModal(); // limpiar al cerrar
    }
  }

  function resetModal() {
    pacienteSel = null;
    horasLibres = [];
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

  // ========= BUSCAR PACIENTES (reutiliza la lógica/estructura de pacientes.js) =========
  async function buscarPacientes() {
    const q = (qInput?.value || '').trim();
    if (q.length < 2) {
      return Swal.fire('Buscar paciente', 'Escribe al menos 2 caracteres', 'info');
    }

    // MISMO endpoint que usa tu página de pacientes:
    const url = `/api/patients/search?q=${encodeURIComponent(q)}&page=1`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokenCitas}` }
      });

      if (!res.ok) {
        const text = await res.text(); // puede ser HTML 404
        throw new Error(`HTTP ${res.status}: ${text.slice(0,120)}`);
      }

      let data;
      try {
        data = await res.json(); // { pacientes, totalPaginas }
      } catch {
        const text = await res.text();
        throw new Error(`Respuesta no JSON: ${text.slice(0,120)}`);
      }

      const pacientes = Array.isArray(data.pacientes) ? data.pacientes : [];
      listPac.innerHTML = '';

      if (!pacientes.length) {
        const vacio = document.createElement('li');
        vacio.className = 'list-group-item';
        vacio.textContent = 'Sin resultados';
        listPac.appendChild(vacio);
        return;
      }

      // Mapeo de campos para el modal (coincide con pacientes.js)
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
          pacienteSel = item; // ← este objeto es el que usa el resto del modal
          seleccionadoBox.classList.remove('d-none');
          seleccionadoBox.textContent = `Paciente: ${item.nombre} ${item.apellido} | ${item.telefono || ''} | ${item.email || ''}`;
        });
        listPac.appendChild(li);
      });
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron cargar pacientes (ver consola).', 'error');
    }
  }

  // ========= HORAS DISPONIBLES =========
  async function cargarHorasDelDia() {
    const fecha = fechaInput?.value;
    if (!fecha) return Swal.fire('Fecha', 'Selecciona una fecha', 'info');

    try {
      // Tu backend devuelve SOLO horas libres (no imprime ocupadas)
      const libres = await fetch(`/api/appointments/available-hours/${fecha}`, {
        headers: { Authorization: `Bearer ${tokenCitas}` }
      }).then(r => r.json());

      horasLibres = Array.isArray(libres) ? libres.map(normalizar) : [];
      // Llenar select de inicio
      selInicio.innerHTML = '';
      horasLibres.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h;              // 'HH:MM'
        opt.textContent = h;
        selInicio.appendChild(opt);
      });
      // Reset de fin
      selFin.innerHTML = '';
      if (!horasLibres.length) {
        Swal.fire('Sin horarios', 'No hay horas disponibles para esa fecha.', 'info');
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron cargar horas disponibles', 'error');
    }
  }

  function recalcularFines() {
    const hi = normalizar(selInicio.value);
    selFin.innerHTML = '';
    if (!hi) return;

    const opcionesFin = construirFinesContiguos(hi, horasLibres);
    opcionesFin.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;         // 'HH:MM'
      opt.textContent = h;
      selFin.appendChild(opt);
    });
  }

  // ========= CREAR CITA POR RANGO =========
  async function guardarCitaRango() {
    try {
      if (!pacienteSel)  return Swal.fire('Paciente', 'Selecciona un paciente', 'info');
      const fecha = fechaInput.value;
      if (!fecha)        return Swal.fire('Fecha', 'Selecciona una fecha', 'info');
      const horaInicio = normalizar(selInicio.value);
      const horaFin    = normalizar(selFin.value);
      if (!horaInicio || !horaFin) return Swal.fire('Horario', 'Selecciona inicio y fin', 'info');

      const body = {
        pacienteId: pacienteSel.id,
        fecha,                 // 'YYYY-MM-DD'
        horaInicio,            // 'HH:MM'
        horaFin,               // 'HH:MM'
        motivo: motivoInput.value || ''
        // medicoId: ... (opcional, si lo manejas)
      };

      const resp = await fetch('/api/appointments/range', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCitas}`
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

      // 🔄 Refrescar la tabla usando agenda.js
      if (typeof window.recargarCitas === 'function') {
        window.recargarCitas();
      } else {
        location.reload();
      }
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudo crear la cita', 'error');
    }
  }

  // ------- Utilidades -------
  function normalizar(t) {
    if (!t) return '';
    // Acepta 'HH:MM' o 'HH:MM:SS' -> devuelve 'HH:MM'
    return t.slice(0, 5);
  }

  // Construye opciones de "fin" solo si los bloques son contiguos libres (30min)
  function construirFinesContiguos(horaInicio, libresHHMM) {
    const toMin = s => {
      const [H, M] = s.split(':').map(Number);
      return H * 60 + M;
    };
    const toStr = m => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;

    const setLibres = new Set(libresHHMM); // 'HH:MM'
    const result = [];
    let actual = toMin(horaInicio) + 30; // primer fin posible = inicio + 30

    // Permite 30, 60, 90, ... siempre que cada salto esté libre
    while (true) {
      const next = toStr(actual);
      // el bloque anterior [actual-30, actual) empieza en (actual - 30)
      const inicioBloque = toStr(actual - 30);
      if (!setLibres.has(inicioBloque)) break;

      result.push(next);

      // Para extender más, el siguiente bloque [actual, actual+30) debe existir libre
      if (!setLibres.has(next)) break;

      actual += 30;
    }
    return result;
  }
})();
