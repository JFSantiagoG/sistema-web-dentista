// =============================
// Autorellena edad desde la fecha de nacimiento
// =============================
(function () {
  const fnac = document.getElementById('fecha_nacimiento');
  const edad = document.getElementById('edad');
  if (!fnac || !edad) return;

  const calcEdad = () => {
    const v = fnac.value;
    if (!v) { edad.value = ''; return; }
    const hoy = new Date();
    const nac = new Date(v + 'T00:00:00');
    let e = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--;
    edad.value = Number.isFinite(e) && e >= 0 ? e : '';
  };
  fnac.addEventListener('change', calcEdad);
  calcEdad();
})();

// =============================
// Formulario de nuevo paciente
// =============================
(function () {
  const form = document.getElementById('pacienteForm');
  if (!form) return;

  let sending = false;

  const getPayload = () => ({
    nombre:               document.getElementById('nombre').value.trim(),
    apellido:             document.getElementById('apellido').value.trim(),
    sexo:                 document.getElementById('sexo').value,
    fecha_nacimiento:     document.getElementById('fecha_nacimiento').value,
    edad:                 document.getElementById('edad').value ? Number(document.getElementById('edad').value) : null,
    email:                document.getElementById('email')?.value.trim() || null,
    estado_civil:         document.getElementById('estado_civil')?.value.trim() || null,
    telefono_principal:   document.getElementById('telefono_principal').value.trim(),
    telefono_secundario:  document.getElementById('telefono_secundario')?.value.trim() || null,
    domicilio:            document.getElementById('domicilio')?.value.trim() || null,
    ocupacion:            document.getElementById('ocupacion')?.value.trim() || null
  });

  const toggleForm = (disabled) => {
    [...form.querySelectorAll('input, select, button')].forEach(el => el.disabled = disabled);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      await Swal.fire('Campos incompletos', 'Revisa los campos marcados con *', 'warning');
      return;
    }

    if (sending) return;
    const payload = getPayload();

    // === Confirmación antes de guardar ===
    const { isConfirmed, isDenied } = await Swal.fire({
      title: '¿Guardar paciente?',
      html: `
        <div class="text-start">
          <p class="mb-1"><strong>Nombre:</strong> ${payload.nombre} ${payload.apellido}</p>
          <p class="mb-1"><strong>Sexo:</strong> ${payload.sexo || '—'}</p>
          <p class="mb-1"><strong>Fecha de nacimiento:</strong> ${payload.fecha_nacimiento || '—'}</p>
          <p class="mb-0"><strong>Teléfono:</strong> ${payload.telefono_principal || '—'}</p>
        </div>
      `,
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Sí, guardar',
      denyButtonText: 'No',
      cancelButtonText: 'Cancelar'
    });

    if (isDenied) {
      await Swal.fire('Operación cancelada', 'No se guardó el paciente.', 'info');
      return;
    }
    if (!isConfirmed) return;

    const token = localStorage.getItem('token') || '';
    const url = '/api/patients'; // pasa por el gateway

    try {
      sending = true;
      toggleForm(true);

      // === Loader mientras guarda ===
      Swal.fire({
        title: 'Guardando…',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => { Swal.showLoading(); }
      });

      // === Request con timeout ===
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s

      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });

      clearTimeout(timeout);
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();

      // === Manejo de errores HTTP ===
      if (!res.ok) {
        let msg = 'Error al crear paciente';
        if (typeof body === 'string') msg = body.slice(0, 200);
        else if (body?.error) msg = body.error;
        if (res.status === 400) msg ||= 'Datos inválidos o incompletos.';
        if (res.status === 409) msg ||= 'Registro duplicado (email o teléfono ya existe).';
        if (res.status >= 500) msg ||= 'Error interno del servidor.';
        throw new Error(msg);
      }

      // ✅ Cerrar loader y mostrar éxito
      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: '✅ Paciente guardado correctamente',
        text: 'Serás redirigido al menú principal',
        timer: 1800,
        showConfirmButton: false
      });

      // 🚀 Redirigir al menú
      location.href = '/menu.html';

    } catch (err) {
      Swal.close();
      console.error(err);
      await Swal.fire('No se pudo crear', String(err.message || err), 'error');
    } finally {
      sending = false;
      toggleForm(false);
    }
  });
})();
