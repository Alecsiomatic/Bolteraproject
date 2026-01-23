const mysql = require('mysql2/promise');

async function setup() {
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });

  try {
    // Crear tabla AppSettings si no existe
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS AppSettings (
        \`key\` VARCHAR(100) PRIMARY KEY,
        value TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('Tabla AppSettings creada/verificada');

    // Insertar valores por defecto (no sobrescribir existentes)
    const defaults = [
      ['app.name', 'COMPRATUBOLETO.MX'],
      ['app.description', 'Tu plataforma de boletos'],
      ['app.logo', ''],
      ['app.primaryColor', '#00d4ff']
    ];

    for (const [key, value] of defaults) {
      await conn.execute(
        'INSERT INTO AppSettings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE `key`=`key`',
        [key, value]
      );
    }
    console.log('Valores por defecto insertados');

    // Mostrar configuración actual
    const [rows] = await conn.execute('SELECT * FROM AppSettings');
    console.log('Configuración actual:', rows);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await conn.end();
  }
}

setup();
