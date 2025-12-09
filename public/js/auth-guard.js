// public/js/auth-guard.js
(function () {
  const LOGIN_PAGE = '/index.html'; // cámbialo a '/index.html' si tu login es index

  const token = localStorage.getItem('token');

  // 1) Si no hay token → regresar al login
  if (!token) {
    console.warn('[auth-guard] Sin token, redirigiendo a login');
    window.location.href = LOGIN_PAGE;
    return;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT mal formado');
    }

    // payload en base64url
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);
    const nowSec = Math.floor(Date.now() / 1000);

    // 2) Si el token ya expiró → limpiar y mandar al login
    if (payload.exp && nowSec >= payload.exp) {
      console.warn('[auth-guard] Token expirado, limpiando y redirigiendo');
      localStorage.removeItem('token');
      localStorage.removeItem('roles');
      window.location.href = LOGIN_PAGE;
      return;
    }

    console.log('[auth-guard] Usuario autenticado. exp =', payload.exp);
  } catch (err) {
    console.error('[auth-guard] Error leyendo token, redirigiendo:', err);
    localStorage.removeItem('token');
    localStorage.removeItem('roles');
    window.location.href = LOGIN_PAGE;
  }
})();
