const db = require('../db/connection');

async function buscarPacientes(q, page = 1) {
  const limite = 15;
  const offset = (page - 1) * limite;

  let query = `
    SELECT 
      id,
      nombre,
      apellido,
      email,
      telefono_principal,
      telefono_secundario
    FROM pacientes
  `;
  let params = [];

  if (q && q.trim()) {
    query += `
      WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono_principal LIKE ? OR telefono_secundario LIKE ?
    `;
    params = [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`];
  }

  query += ` ORDER BY apellido LIMIT ? OFFSET ?`;
  params.push(limite, offset);

  const [rows] = await db.query(query, params);

  // Obtener total para calcular páginas
  const [totalRows] = await db.query(`
    SELECT COUNT(*) AS total FROM pacientes
    ${q && q.trim() ? `
      WHERE nombre LIKE ? OR apellido LIKE ? OR email LIKE ? OR telefono_principal LIKE ? OR telefono_secundario LIKE ?
    ` : ''}
  `, q && q.trim() ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`] : []);

  const total = totalRows[0].total;
  const totalPaginas = Math.ceil(total / limite);

  return { pacientes: rows, totalPaginas };
}

module.exports = { buscarPacientes };