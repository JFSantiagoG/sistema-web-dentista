document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  if (!form) return;

  const hasSwal = typeof Swal !== 'undefined';

  const Toast = hasSwal ? Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1800,
    timerProgressBar: true
  }) : null;

  const errorMsg = document.getElementById('error-msg');
  const btn = document.getElementById('login-btn');

  const showError = (msg) => {
    if (errorMsg) errorMsg.textContent = msg || '';
    if (hasSwal) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: msg || 'Ocurrió un error',
        confirmButtonText: 'OK'
      });
    } else {
      alert(msg || 'Ocurrió un error');
    }
  };

  const showBlocked = (msg) => {
    const text = msg || 'Cuenta bloqueada. Por favor contacte al administrador.';
    if (errorMsg) errorMsg.textContent = text;

    if (hasSwal) {
      Swal.fire({
        icon: 'warning',
        title: 'Cuenta bloqueada',
        text,
        confirmButtonText: 'Entendido'
      });
    } else {
      alert(text);
    }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = (document.getElementById('email')?.value || '').trim().toLowerCase();
    const password = (document.getElementById('password')?.value || '').trim();

    try {
      if (!email || !password) return showError('Correo y contraseña son requeridos');

      if (errorMsg) errorMsg.textContent = '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Ingresando...`;
      }

      if (hasSwal) {
        Swal.fire({
          title: 'Validando credenciales...',
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading()
        });
      }

      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data = {};
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        try { data = await res.json(); } catch { data = {}; }
      } else {
        const txt = await res.text();
        data = { msg: txt?.slice(0, 200) || 'Respuesta no válida del servidor' };
      }

      if (!res.ok) {
        if (hasSwal) Swal.close();

        // ✅ cuenta bloqueada
        if (res.status === 403 && (data?.code === 'ACCOUNT_BLOCKED' || /bloquead/i.test(data?.msg || ''))) {
          return showBlocked(data?.msg);
        }

        return showError(data?.msg || 'Error al iniciar sesión');
      }

      // ✅ OK
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('roles', JSON.stringify(data.user?.roles || []));

      const roles = data.user?.roles || [];

      if (hasSwal) {
        Swal.close();
        Toast?.fire({ icon: 'success', title: 'Bienvenido 👋' });
      }

      setTimeout(() => {
        location.href = roles.includes('admin') ? 'admin.html' : 'menu.html';
      }, hasSwal ? 650 : 0);

    } catch (err) {
      console.error(err);
      if (hasSwal) Swal.close();
      showError('Error de conexión con el servidor');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Ingresar`;
      }
    }
  });
});
