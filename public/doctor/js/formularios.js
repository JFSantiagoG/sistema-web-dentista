const token = localStorage.getItem('token');
const roles = JSON.parse(localStorage.getItem('roles') || '[]');

if (!token || !roles.includes('doctor')) {
  location.href = '/login.html';
}

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}

function goBack() {
  window.history.back();
}