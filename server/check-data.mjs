import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: 'srv440.hstgr.io',
  port: 3306,
  user: 'u191251575_eventOS',
  password: 'Alecs.com2006',
  database: 'u191251575_eventOS'
});

console.log('=== RESUMEN DE DATOS EN LA BASE DE DATOS ===\n');

// Eventos
const [events] = await conn.execute('SELECT COUNT(*) as total FROM Event');
console.log(`Eventos: ${events[0].total}`);

// Venues
const [venues] = await conn.execute('SELECT COUNT(*) as total FROM Venue');
console.log(`Venues: ${venues[0].total}`);

// Usuarios
const [users] = await conn.execute('SELECT COUNT(*) as total FROM User');
console.log(`Usuarios: ${users[0].total}`);

// Órdenes
const [orders] = await conn.execute('SELECT COUNT(*) as total, status FROM `Order` GROUP BY status');
console.log(`\nÓrdenes por estado:`);
console.table(orders);

// Tickets
const [tickets] = await conn.execute('SELECT COUNT(*) as total, status FROM Ticket GROUP BY status');
console.log(`\nTickets por estado:`);
console.table(tickets);

// Sesiones
const [sessions] = await conn.execute('SELECT COUNT(*) as total FROM EventSession');
console.log(`\nSesiones de eventos: ${sessions[0].total}`);

await conn.end();
