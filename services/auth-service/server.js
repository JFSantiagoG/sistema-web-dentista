// auth-service/server.js (o donde tengas este código)
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

// Pequeño helper: detectar si el password_hash ya es un hash bcrypt
function isBcryptHash(str) {
  return typeof str === 'string' && str.startsWith('$2') && str.length > 40;
}

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1) Buscar usuario por email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

    let passwordOk = false;

    // 2) Si el campo password_hash YA es un bcrypt, usamos compare
    if (isBcryptHash(user.password_hash)) {
      passwordOk = await bcrypt.compare(password, user.password_hash);
    } else {
      // 3) MODO COMPATIBILIDAD:
      //    Todavía tienes contraseñas "en claro" en password_hash (ej. '12345')
      //    Comparamos directo por ÚLTIMA vez, y si coincide, la migramos a bcrypt
      if (user.password_hash === password) {
        passwordOk = true;

        // Migrar en caliente a bcrypt para próximos logins
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

    // 4) Cargar roles
    const [roles] = await pool.query(
      'SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ?',
      [user.id]
    );

    const payload = {
      id: user.id,
      email: user.email,
      rol: roles[0]?.name || 'sin-rol'
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '2h' });

    res.json({
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        roles: roles.map(r => r.name),
      },
    });
  } catch (err) {
    console.error('Error en login:', err.message, err.stack);
    res.status(500).json({ msg: 'Error interno del servidor' });
  }
});

app.listen(3005, () => {
  console.log('🔐 Auth service corriendo en puerto 3005');
});
