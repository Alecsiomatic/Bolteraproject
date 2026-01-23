const mysql = require('mysql2/promise');

async function listAdmins() {
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    port: 3306,
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
  
  const [rows] = await conn.execute('SELECT email, name, role, status FROM User WHERE role = "ADMIN"');
  
  console.log('\n=== USUARIOS ADMIN ===');
  if (rows.length === 0) {
    console.log('No hay usuarios admin en la base de datos');
  } else {
    rows.forEach(r => {
      console.log(`Email: ${r.email}`);
      console.log(`Nombre: ${r.name}`);
      console.log(`Status: ${r.status}`);
      console.log('---');
    });
  }
  
  await conn.end();
}

listAdmins().catch(console.error);
