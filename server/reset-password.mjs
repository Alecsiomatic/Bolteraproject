import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const conn = await mysql.createConnection({
  host: 'srv440.hstgr.io',
  port: 3306,
  user: 'u191251575_eventOS',
  password: 'Alecs.com2006',
  database: 'u191251575_eventOS'
});

const newPassword = 'admin123';
const hashedPassword = await bcrypt.hash(newPassword, 10);

await conn.execute(
  'UPDATE User SET password = ? WHERE email = ?',
  [hashedPassword, 'alecs@event.os']
);

console.log('✅ Contraseña reseteada exitosamente!');
console.log('');
console.log('Email: alecs@event.os');
console.log('Nueva contraseña: admin123');

await conn.end();
