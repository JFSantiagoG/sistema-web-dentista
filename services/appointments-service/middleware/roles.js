function puedeVerCita(usuario, cita) {
  if (usuario.rol === 'medico') return cita.medico_id === usuario.id;
  return true;
}

function puedeModificarCita(usuario, cita) {
  return (
    ['admin', 'asistente'].includes(usuario.rol) ||
    (usuario.rol === 'doctor' && Number(usuario.id) === Number(cita.medicoId))
  );
}


module.exports = { puedeVerCita, puedeModificarCita };
