import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== TODOS LOS VENUES EN DB ===');
  const [venues] = await conn.execute('SELECT id, name, createdAt FROM Venue');
  for (const v of venues) {
    console.log(`ID: ${v.id}`);
    console.log(`  Nombre: ${v.name}`);
    console.log('');
  }

  console.log('=== EVENTOS Y SUS VENUES ===');
  const [events] = await conn.execute(`
    SELECT e.id, e.name as eventName, e.status, e.venueId, v.name as venueName
    FROM Event e
    LEFT JOIN Venue v ON v.id = e.venueId
  `);
  for (const e of events) {
    console.log(`Evento: ${e.eventName} (${e.status})`);
    console.log(`  VenueId: ${e.venueId}`);
    console.log(`  VenueName: ${e.venueName || 'VENUE NO EXISTE!'}`);
    console.log('');
  }

  await conn.end();
}

main().catch(console.error);
