import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Contar eventos
  const [eventCount] = await conn.execute('SELECT COUNT(*) as total FROM Event');
  console.log('=== EVENTOS TOTALES ===');
  console.log('Total:', eventCount[0].total);
  
  // Listar eventos
  const [events] = await conn.execute('SELECT id, name, status, venueId, createdAt FROM Event LIMIT 10');
  console.log('\n=== EVENTOS ===');
  for (const e of events) {
    console.log(`- ${e.name} (${e.status}) - Venue: ${e.venueId || 'SIN VENUE'}`);
  }
  
  // Contar sesiones
  const [sessionCount] = await conn.execute('SELECT COUNT(*) as total FROM EventSession');
  console.log('\n=== SESIONES TOTALES ===');
  console.log('Total:', sessionCount[0].total);
  
  // Listar sesiones
  const [sessions] = await conn.execute('SELECT es.id, es.eventId, es.startsAt, e.name as eventName FROM EventSession es JOIN Event e ON e.id = es.eventId LIMIT 10');
  console.log('\n=== SESIONES ===');
  for (const s of sessions) {
    console.log(`- ${s.eventName} -> ${s.startsAt}`);
  }
  
  await conn.end();
}

main().catch(console.error);
