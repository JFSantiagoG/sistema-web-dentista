const jwt = require('jsonwebtoken');
require('dotenv').config(); // Asegura que JWT_SECRET esté disponible

const SECRET = process.env.JWT_SECRET;

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.warn('⚠️ Token faltante en la cabecera');
    return res.status(401).json({ error: 'Token faltante' });
  }

  const token = authHeader.split(' ')[1];

  console.log('🔐 Token recibido:', token);
  console.log('🔐 Clave JWT usada:', SECRET);

  try {
    const payload = jwt.verify(token, SECRET);
    console.log('✅ Token verificado. Payload:', payload);
    req.user = payload;
    next();
  } catch (err) {
    console.error('❌ Fallo al verificar token:', err.message);
    return res.status(403).json({ error: 'Token inválido' });
  }
}

module.exports = verificarToken;
