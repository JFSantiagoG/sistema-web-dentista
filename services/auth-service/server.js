import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config(); // ← carga .env

const app = express(); // ← define app antes de usarla

app.use(cors());
app.use(express.json());

// Aquí ya puedes usar app.post(...)
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];

    if (!user || user.password_hash !== password) {
      return res.status(401).json({ msg: 'Credenciales inválidas' });
    }

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
