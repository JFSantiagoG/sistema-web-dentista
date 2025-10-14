const { buscarPacientes } = require('../models/pacientes.model');

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
      SELECT id, nombre, apellido, email, telefono_principal, telefono_secundario
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

module.exports = {
  buscar,
  obtenerPorId
};