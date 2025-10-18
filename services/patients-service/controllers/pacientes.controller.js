const db = require('../db/connection');
const { buscarPacientes, getFormsSummary, getPatientStudies } = require('../models/pacientes.model');

async function buscar(req, res) {
  const q = req.query.q?.trim();
  const page = parseInt(req.query.page) || 1;

  try {
    const { pacientes, totalPaginas } = await buscarPacientes(q, page);
    res.json({ pacientes, totalPaginas });
  } catch (err) {
    console.error('Error al buscar pacientes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

async function obtenerPorId(req, res) {
  const id = req.params.id;
  try {
    const [rows] = await db.query(`
      SELECT id, nombre, apellido, sexo, edad, email, telefono_principal, telefono_secundario
      FROM pacientes
      WHERE id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ error: 'Paciente no encontrado' });

    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener paciente:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
}

// NUEVO: /patients/:id/forms
async function obtenerFormsSummary(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'paciente_id inválido' });

    const data = await getFormsSummary(id);
    if (!data || !data.paciente) return res.status(404).json({ error: 'Paciente no encontrado' });

    // asegura arrays (si no hay datos, el front muestra "Sin ...")
    res.json({
      paciente: data.paciente,
      evoluciones: data.evoluciones || [],
      recetas: data.recetas || [],
      presupuestos: data.presupuestos || [],
      consentimiento_odontologico: data.consentimiento_odontologico || [],
      consentimiento_quirurgico: data.consentimiento_quirurgico || [],
      historia_clinica: data.historia_clinica || [],
      justificantes: data.justificantes || [],
      odontograma_final: data.odontograma_final || [],
      ortodoncia: data.ortodoncia || []
    });
  } catch (err) {
    console.error('getFormsSummary error:', err);
    res.status(500).json({ error: 'Error al consultar formularios' });
  }
}

async function obtenerStudies(req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'paciente_id inválido' });

    const rows = await getPatientStudies(id);
    // Devolver siempre array (aunque esté vacío)
    res.json(rows);
  } catch (err) {
    console.error('getPatientStudies error:', err);
    res.status(500).json({ error: 'Error al consultar estudios' });
  }
}

module.exports = {
  buscar,
  obtenerPorId,
  obtenerFormsSummary,
  obtenerStudies
};
