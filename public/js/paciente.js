//const token = localStorage.getItem('token');
async function cargarPerfil() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const perfilDiv = document.getElementById('perfil');

  if (!id) {
    perfilDiv.innerHTML = `<p class="text-danger">❌ No se proporcionó el ID del paciente.</p>`;
    return;
  }

  try {
    const res = await fetch(`/api/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Error al obtener perfil');

    const p = await res.json();

    perfilDiv.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p><strong>Nombre:</strong> ${p.nombre}</p>
          <p><strong>Apellido:</strong> ${p.apellido}</p>
          <p><strong>Email:</strong> ${p.email || '—'}</p>
          <p><strong>Teléfono principal:</strong> ${p.telefono_principal || '—'}</p>
          <p><strong>Teléfono secundario:</strong> ${p.telefono_secundario || '—'}</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error al cargar perfil:', err);
    perfilDiv.innerHTML = `<p class="text-danger">❌ Error al cargar el perfil del paciente.</p>`;
  }
}

cargarPerfil();
