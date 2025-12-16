const db = require('../db/connection');

async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: 'No autenticado' });
    }

    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId]);

    const roles = rows.map(r => r.name);

    if (!roles.includes('admin')) {
      return res.status(403).json({ msg: 'Acceso denegado: requiere rol admin' });
    }

    // info útil por si luego la necesitas
    req.user.roles = roles;

    next();
  } catch (err) {
    console.error('requireAdmin error:', err);
    res.status(500).json({ msg: 'Error validando rol admin' });
  }
}

module.exports = requireAdmin;
