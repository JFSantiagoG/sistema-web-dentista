function formatAppointmentReminder({ patientName, date, time }) {
  return `Hola ${patientName}, te recordamos tu cita el ${date} a las ${time}.`;
}

module.exports = {
  formatAppointmentReminder,
};
