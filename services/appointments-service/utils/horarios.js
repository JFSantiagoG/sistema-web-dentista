const HORAS_CLINICA = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30'
];

function filtrarHorasDisponibles(ocupadas) {
  return HORAS_CLINICA.filter(h => !ocupadas.includes(h));
}

module.exports = { HORAS_CLINICA, filtrarHorasDisponibles };