const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('=== EVENTOS ===');
  const [events] = await conn.query('SELECT id, name, status, venueId FROM Event');
  console.log(JSON.stringify(events, null, 2));
  
  console.log('\n=== VENUES ===');
  const [venues] = await conn.query('SELECT id, name FROM Venue');
  console.log(JSON.stringify(venues, null, 2));
  
  console.log('\n=== LAYOUTS CON ASIENTOS ===');
  const [seats] = await conn.query(`
    SELECT vl.id, vl.venueId, vl.name, v.name as venueName, COUNT(s.id) as seatCount
    FROM VenueLayout vl
    LEFT JOIN Venue v ON v.id = vl.venueId
    LEFT JOIN Seat s ON s.layoutId = vl.id
    GROUP BY vl.id
    HAVING seatCount > 0
  `);
  console.log(JSON.stringify(seats, null, 2));
  
  await conn.end();
}

main().catch(console.error);
