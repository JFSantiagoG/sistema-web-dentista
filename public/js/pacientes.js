const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');
const isAdmin = Array.isArray(roles) && roles.includes('admin');

if (!token) location.href = 'index.html';

let paginaActual = 1;

// ============================
// Buscar pacientes
// ============================
async function buscarPacientes() {
  const q = document.getElementById('busqueda').value.trim();
  const cont = document.getElementById('resultados');

  const url = q
    ? `/api/patients/search?q=${encodeURIComponent(q)}&page=${paginaActual}`
    : `/api/patients/search?page=${paginaActual}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error');

    const { pacientes, totalPaginas } = await res.json();

    if (!pacientes.length) {
      cont.innerHTML = `<p class="text-muted text-center">No se encontraron pacientes.</p>`;
      return;
    }

    cont.innerHTML = `
      <div class="table-responsive">
        <table class="table table-bordered table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Email</th>
              <th>Teléfono</th>
              ${isAdmin ? `<th style="width:110px;">Eliminar</th>` : ``}
            </tr>
          </thead>
          <tbody>
            ${pacientes.map(p => `
              <tr class="fila-paciente" data-id="${p.id}" style="cursor:pointer;">
                <td>${p.nombre}</td>
                <td>${p.apellido}</td>
                <td>${p.email || '—'}</td>
                <td>${p.telefono_principal || '—'}</td>
                ${
                  isAdmin
                    ? `
                    <td class="text-center">
                      <button
                        class="btn btn-sm btn-outline-danger btn-delete"
                        data-id="${p.id}"
                        title="Eliminar paciente">
                        <i class="fas fa-trash"></i>
                      </button>
                    </td>`
                    : ``
                }
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="d-flex justify-content-center mt-3">
        ${Array.from({ length: totalPaginas }, (_, i) => `
          <button
            class="btn btn-sm btn-outline-primary mx-1 ${paginaActual === i + 1 ? 'active' : ''}"
            onclick="irAPagina(${i + 1})">
            ${i + 1}
          </button>
        `).join('')}
      </div>
    `;

    // Abrir perfil
    document.querySelectorAll('.fila-paciente').forEach(fila => {
      fila.addEventListener('click', e => {
        if (e.target.closest('.btn-delete')) return;
        const id = fila.dataset.id;
        location.href = `paciente.html?id=${id}`;
      });
    });

    // Eliminar (solo admin)
    if (isAdmin) {
      document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          await eliminarPaciente(btn.dataset.id);
        });
      });
    }

  } catch (err) {
    console.error(err);
    toastErr?.('Error', 'No se pudieron cargar los pacientes');
  }
}

// ============================
// Eliminar paciente (ADMIN)
// ============================
async function eliminarPaciente(id) {
  const ok = await Swal.fire({
    title: 'Eliminar paciente',
    text: 'Esta acción no se puede deshacer',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc3545'
  }).then(r => r.isConfirmed);

  if (!ok) {
    toastInfo?.('Cancelado', 'El paciente no fue eliminado');
    return;
  }

  try {
    loadingOn?.('Eliminando paciente...');

    const res = await fetch(`/api/patients/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    loadingOff?.();

    if (!res.ok) throw new Error();

    toastOk?.('Paciente eliminado correctamente');
    buscarPacientes();

  } catch (err) {
    loadingOff?.();
    console.error(err);
    toastErr?.('Error', 'No se pudo eliminar el paciente');
  }
}

// ============================
function irAPagina(p) {
  paginaActual = p;
  buscarPacientes();
}

document.addEventListener('DOMContentLoaded', buscarPacientes);
