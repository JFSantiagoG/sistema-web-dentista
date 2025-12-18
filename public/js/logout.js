// public/js/logout.js
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnLogout');
  if (!btn) return;

  btn.addEventListener('click', () => {
    // 1) Limpiar datos de sesión
    localStorage.removeItem('token');
    localStorage.removeItem('roles');
    document.cookie = 'token=; Path=/; Max-Age=0; SameSite=Lax';

    // 2) Redirigir al login
    window.location.href = '/index.html';  // o '/index.html'
  });
});
