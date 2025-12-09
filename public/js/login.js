document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorMsg = document.getElementById('error-msg');

  try {
    const res = await fetch('/auth/login', {   // <- pasa por el gateway al auth-service
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.msg || 'Error al iniciar sesión';
      return;
    }
    // 🔐 Guardar TOKEN y roles en localStorage
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('roles', JSON.stringify(data.user.roles));

    const rol = data.user.roles[0];
    if (rol === 'doctor' || rol === 'admin' || rol === 'asistente') {
      // Página principal protegida
      location.href = 'menu.html';
    }
  } catch (err) {
    errorMsg.textContent = 'Error de conexión con el servidor';
    console.error(err);
  }
});