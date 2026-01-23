import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'srv440.hstgr.io',
  port: 3306,
  user: 'u191251575_eventOS',
  password: 'Alecs.com2006',
  database: 'u191251575_eventOS'
});

const [rows] = await conn.execute('SELECT id, email, name, role, status FROM User WHERE role = "ADMIN"');
console.log('Usuarios Admin encontrados:');
console.table(rows);

await conn.end();
