const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');
if (!token || roles.length === 0) location.href = '/login.html';

let paginaActual = 1;

async function buscarPacientes() {
  const query = document.getElementById('busqueda')?.value?.trim() || '';
  const resultadosDiv = document.getElementById('resultados');

  const url = query
    ? `/api/patients/search?q=${encodeURIComponent(query)}&page=${paginaActual}`
    : `/api/patients/search?page=${paginaActual}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error en la búsqueda');

    const { pacientes, totalPaginas } = await res.json();

    if (pacientes.length === 0) {
      resultadosDiv.innerHTML = `<p class="text-muted text-center">No se encontraron pacientes.</p>`;
      return;
    }

    resultadosDiv.innerHTML = `
      <h4 class="text-center mb-4">📋 Resultados de Búsqueda</h4>
      <div class="table-responsive">
        <table class="table table-bordered table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>👤 Nombre</th>
              <th>👤 Apellido</th>
              <th>📧 Email</th>
              <th>📞 Teléfono Principal</th>
              <th>📞 Teléfono Secundario</th>
            </tr>
          </thead>
          <tbody>
            ${pacientes.map(p => `
              <tr class="fila-paciente" data-id="${p.id}" style="cursor: pointer;">
                <td>${p.nombre}</td>
                <td>${p.apellido}</td>
                <td>${p.email || '—'}</td>
                <td>${p.telefono_principal || '—'}</td>
                <td>${p.telefono_secundario || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="d-flex justify-content-center mt-3">
        ${Array.from({ length: totalPaginas }, (_, i) => `
          <button class="btn btn-sm btn-outline-primary mx-1 ${paginaActual === i + 1 ? 'active' : ''}" onclick="irAPagina(${i + 1})">${i + 1}</button>
        `).join('')}
      </div>
    `;

    document.querySelectorAll('.fila-paciente').forEach(fila => {
      fila.addEventListener('click', () => {
        const id = fila.getAttribute('data-id');
        window.location.href = `paciente.html?id=${id}`;
      });
    });
  } catch (err) {
    console.error('Error al buscar pacientes:', err);
    resultadosDiv.innerHTML = `<p class="text-danger text-center">❌ Error al buscar pacientes.</p>`;
  }
}

function irAPagina(pagina) {
  paginaActual = pagina;
  buscarPacientes();
}

document.addEventListener('DOMContentLoaded', () => {
  buscarPacientes();
});



function mostrarResultados(pacientes) {
  const contenedor = document.getElementById('resultados');
  if (!pacientes.length) {
    contenedor.innerHTML = `<p class="text-muted">No se encontraron pacientes con ese criterio.</p>`;
    return;
  }

  let html = '<h4>📋 Resultados de Búsqueda</h4><ul class="list-group">';
  pacientes.forEach(p => {
    html += `<li class="list-group-item d-flex justify-content-between align-items-center">
      <span><strong>${p.nombre}</strong> (ID: ${p.id})</span>
      <a href="/paciente.html?id=${encodeURIComponent(p.id)}" class="btn btn-sm btn-outline-primary">Ver perfil</a>
    </li>`;
  });
  html += '</ul>';
  contenedor.innerHTML = html;
}


document.addEventListener('DOMContentLoaded', () => {
  buscarPacientes(); // ← carga 15 pacientes al entrar
});

document.getElementById('anio-actual').textContent = new Date().getFullYear();