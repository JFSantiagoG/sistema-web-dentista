// auth-service/server.js
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Helper: detectar si password_hash ya es bcrypt
function isBcryptHash(str) {
  return typeof str === 'string' && str.startsWith('$2') && str.length > 40;
}

app.post('/login', async (req, res) => {
  const email = (req.body?.email || '').trim().toLowerCase();
  const password = (req.body?.password || '').trim();

  try {
    if (!email || !password) {
      return res.status(400).json({ msg: 'Email y contraseña son requeridos' });
    }

    // 1) Buscar usuario por email
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, is_active FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

    // ✅ Bloqueo por cuenta inactiva
    const isActive = Number(user.is_active) === 1;
    if (!isActive) {
      return res.status(403).json({
        code: 'ACCOUNT_BLOCKED',
        msg: 'Cuenta bloqueada. Por favor contacte al administrador.'
      });
    }

    // 2) Validar password
    let passwordOk = false;

    if (isBcryptHash(user.password_hash)) {
      passwordOk = await bcrypt.compare(password, user.password_hash);
    } else {
      // Compatibilidad: password en claro
      if (user.password_hash === password) {
        passwordOk = true;

        // Migrar a bcrypt
        const newHash = await bcrypt.hash(password, 10);
        await pool.query(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [newHash, user.id]
        );
        console.log(`🔐 Password de user ${user.id} migrado a bcrypt`);
      } else {
        passwordOk = false;
      }
    }

    if (!passwordOk) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

    // 3) Cargar roles
    const [roles] = await pool.query(
      `SELECT r.name
       FROM roles r
       JOIN user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?`,
      [user.id]
    );

    const rolesArr = roles.map(r => r.name);

    // 4) Firmar JWT
    const payload = {
      id: user.id,
      email: user.email,
      rol: rolesArr[0] || 'sin-rol'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

    return res.json({
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        roles: rolesArr,
        is_active: 1
      }
    });
  } catch (err) {
    console.error('Error en login:', err.message, err.stack);
    return res.status(500).json({ msg: 'Error interno del servidor' });
  }
});

app.listen(3005, () => {
  console.log('🔐 Auth service corriendo en puerto 3005');
});
