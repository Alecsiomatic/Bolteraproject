import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== TODOS LOS EVENTOS ===');
  const [events] = await conn.execute('SELECT id, name, status, venueId, createdAt FROM Event');
  for (const e of events) {
    console.log(`ID: ${e.id}`);
    console.log(`  Nombre: ${e.name}`);
    console.log(`  Status: ${e.status}`);
    console.log(`  VenueId: ${e.venueId || 'NULL'}`);
    console.log(`  CreatedAt: ${e.createdAt}`);
    console.log('');
  }

  console.log('=== SESIONES CON FECHAS ===');
  const [sessions] = await conn.execute(`
    SELECT 
      es.id, es.eventId, es.startsAt, es.status,
      e.name as eventName
    FROM EventSession es 
    JOIN Event e ON e.id = es.eventId
  `);
  for (const s of sessions) {
    console.log(`${s.eventName}: ${s.startsAt} (${s.status})`);
  }

  console.log('\n=== TEST QUERY IGUAL AL API ===');
  const sql = `
    SELECT
      e.id,
      e.name,
      e.status,
      v.name AS venueName,
      COUNT(DISTINCT s.id) AS sessionCount,
      MIN(s.startsAt) AS firstSession
    FROM Event e
    LEFT JOIN Venue v ON v.id = e.venueId
    LEFT JOIN EventSession s ON s.eventId = e.id
    WHERE e.status = 'PUBLISHED'
    GROUP BY e.id
  `;
  const [apiEvents] = await conn.execute(sql);
  console.log('Eventos PUBLISHED:', apiEvents.length);
  for (const e of apiEvents) {
    console.log(`- ${e.name}: ${e.sessionCount} sesiones, primera: ${e.firstSession}`);
  }

  console.log('\n=== TEST QUERY CON FILTRO DE FECHA ===');
  const sql2 = `
    SELECT
      e.id,
      e.name,
      e.status,
      COUNT(DISTINCT s.id) AS sessionCount,
      MIN(s.startsAt) AS firstSession
    FROM Event e
    LEFT JOIN EventSession s ON s.eventId = e.id
    WHERE e.status = 'PUBLISHED'
      AND (s.startsAt >= NOW() OR s.startsAt IS NULL)
    GROUP BY e.id
  `;
  const [futureEvents] = await conn.execute(sql2);
  console.log('Eventos PUBLISHED y futuros:', futureEvents.length);
  for (const e of futureEvents) {
    console.log(`- ${e.name}: ${e.sessionCount} sesiones`);
  }

  await conn.end();
}

main().catch(console.error);
