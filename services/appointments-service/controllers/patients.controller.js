const model = require('../models/pacientes.model');

exports.search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const page = Number(req.query.page || 1);
    const { pacientes, totalPaginas } = await model.searchPatients(q, page, 15);
    res.json({ pacientes, totalPaginas });
  } catch (e) {
    console.error('Error patients.search:', e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.getFormsSummary = async (req, res) => {
  try {
    const pacienteId = Number(req.params.id);
    if (!pacienteId) return res.status(400).json({ error: 'paciente_id inválido' });

    const data = await model.getFormsSummary(pacienteId); // <-- usar model, no Patients
    if (!data || !data.paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    res.json(data);
  } catch (err) {
    console.error('getFormsSummary error:', err);
    res.status(500).json({ error: 'Error al consultar formularios' });
  }
};
