import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const DB_CONFIG = {
  host: 'srv440.hstgr.io',
  user: 'u191251575_eventOS',
  password: 'Sy2JkT.MFe2',
  database: 'u191251575_eventOS'
};

async function createUsers() {
  const connection = await mysql.createConnection(DB_CONFIG);
  
  try {
    console.log('🔗 Conectado a la base de datos');
    
    // Usuario Admin
    const adminId = randomUUID();
    const adminEmail = 'admin@boletera.com';
    const adminPassword = 'Admin123!';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    
    // Usuario Normal
    const userId = randomUUID();
    const userEmail = 'user@boletera.com';
    const userPassword = 'User123!';
    const userHash = await bcrypt.hash(userPassword, 10);
    
    // Verificar si ya existen
    const [existingAdmin] = await connection.query('SELECT id FROM User WHERE email = ?', [adminEmail]);
    const [existingUser] = await connection.query('SELECT id FROM User WHERE email = ?', [userEmail]);
    
    // Eliminar si existen
    if (existingAdmin.length > 0) {
      await connection.query('DELETE FROM User WHERE email = ?', [adminEmail]);
      console.log('🗑️  Usuario admin existente eliminado');
    }
    
    if (existingUser.length > 0) {
      await connection.query('DELETE FROM User WHERE email = ?', [userEmail]);
      console.log('🗑️  Usuario normal existente eliminado');
    }
    
    // Crear admin
    await connection.query(
      `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [adminId, 'Administrador', adminEmail, adminHash, 'ADMIN', 'ACTIVE']
    );
    console.log('✅ Usuario ADMIN creado:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   Role: ADMIN`);
    
    // Crear usuario normal
    await connection.query(
      `INSERT INTO User (id, name, email, password, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [userId, 'Usuario Normal', userEmail, userHash, 'VIEWER', 'ACTIVE']
    );
    console.log('✅ Usuario NORMAL creado:');
    console.log(`   Email: ${userEmail}`);
    console.log(`   Password: ${userPassword}`);
    console.log(`   Role: VIEWER`);
    
    // Verificar creación
    const [users] = await connection.query('SELECT id, name, email, role FROM User WHERE email IN (?, ?)', [adminEmail, userEmail]);
    console.log('\n📋 Usuarios creados en DB:');
    console.table(users);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
    console.log('\n✅ Script completado');
    process.exit(0);
  }
}

createUsers();
