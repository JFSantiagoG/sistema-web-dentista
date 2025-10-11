const token = localStorage.getItem('token');
if (!token) location.href = '/login.html';

function logout() {
  localStorage.clear();
  location.href = '/login.html';
}
