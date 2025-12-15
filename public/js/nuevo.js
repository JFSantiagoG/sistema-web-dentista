// =============================
// Validación correo electrónico (sin espacios)
// =============================
document.getElementById('email')?.addEventListener('input', function (e) {
  let value = e.target.value;
  if (value.includes(' ')) {
    e.target.value = value.replace(/\s+/g, '');
  }
});

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

  // ➕ Función de validación de correo (definida una sola vez)
  const validarEmail = (email) => {
    if (!email) return true; // opcional → vacío es válido
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    return re.test(String(email).toLowerCase());
  };

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

    // 1. Validación básica de HTML5
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      await Swal.fire('Campos incompletos', 'Revisa los campos marcados con *', 'warning');
      return;
    }

    // 2. ➕ Validación adicional: correo electrónico
    const email = document.getElementById('email')?.value.trim();
    if (email && !validarEmail(email)) {
      await Swal.fire('Correo inválido', 'Por favor ingresa un correo electrónico válido (ej: nombre@dominio.com).', 'error');
      document.getElementById('email').focus();
      return;
    }

    // 3. Evitar envíos múltiples
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
    const url = '/api/patients';

    try {
      sending = true;
      toggleForm(true);

      Swal.fire({
        title: 'Guardando…',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading()
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

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

      if (!res.ok) {
        let msg = 'Error al crear paciente';
        if (typeof body === 'string') msg = body.slice(0, 200);
        else if (body?.error) msg = body.error;
        if (res.status === 400) msg ||= 'Datos inválidos o incompletos.';
        if (res.status === 409) msg ||= 'Registro duplicado (email o teléfono ya existe).';
        if (res.status >= 500) msg ||= 'Error interno del servidor.';
        throw new Error(msg);
      }

      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: '✅ Paciente guardado correctamente',
        text: 'Serás redirigido al menú principal',
        timer: 1800,
        showConfirmButton: false
      });

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