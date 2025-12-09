// services/auth-service/scripts/crearUsuario.js
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

dotenv.config();

async function main() {
  // node scripts/crearUsuario.js email password rol
  const [,, email, plainPassword, rolName] = process.argv;

  if (!email || !plainPassword) {
    console.log('Uso:');
    console.log('  node scripts/crearUsuario.js <email> <password> [rol]');
    console.log('');
    console.log('Ejemplo:');
    console.log('  node scripts/crearUsuario.js doctor@demo.com 12345 doctor');
    process.exit(1);
  }

  const rol = rolName || 'doctor'; // por defecto "doctor"

  try {
    console.log('🔐 Creando usuario...');
    console.log('Email:', email);
    console.log('Rol  :', rol);

    // 1) Generar hash seguro
    const hash = await bcrypt.hash(plainPassword, 10);

    // 2) Insertar en users
    const [resultUser] = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, hash]
    );

    const userId = resultUser.insertId;
    console.log('✅ Usuario creado con id:', userId);

    // 3) Buscar id del rol en la tabla roles
    const [rowsRoles] = await pool.query(
      'SELECT id FROM roles WHERE name = ?',
      [rol]
    );

    if (!rowsRoles.length) {
      console.log('⚠️ OJO: no se encontró el rol', rol, 'en la tabla roles.');
      console.log('   El usuario quedó creado pero sin registro en user_roles.');
      process.exit(0);
    }

    const roleId = rowsRoles[0].id;

    // 4) Insertar en user_roles
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );

    console.log('✅ Relación user_roles creada (user_id, role_id):', userId, roleId);
    console.log('🎉 Listo. Ya puedes iniciar sesión con ese usuario.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear usuario:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
