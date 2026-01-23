import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const [venues] = await conn.execute('SELECT id, name, LEFT(CAST(layoutJson AS CHAR), 300) as layoutPreview, layoutVersion FROM Venue LIMIT 5');
  console.log('=== VENUES ===');
  for (const v of venues) {
    console.log(`ID: ${v.id}`);
    console.log(`Name: ${v.name}`);
    console.log(`Version: ${v.layoutVersion}`);
    console.log(`Layout Preview: ${v.layoutPreview ? v.layoutPreview.substring(0, 150) + '...' : 'NULL'}`);
    console.log('---');
  }
  
  const [layouts] = await conn.execute('SELECT id, venueId, name, version, LEFT(CAST(layoutJson AS CHAR), 300) as layoutPreview FROM VenueLayout LIMIT 5');
  console.log('\n=== VENUE LAYOUTS ===');
  for (const l of layouts) {
    console.log(`ID: ${l.id}`);
    console.log(`VenueID: ${l.venueId}`);
    console.log(`Name: ${l.name}`);
    console.log(`Version: ${l.version}`);
    console.log(`Layout Preview: ${l.layoutPreview ? l.layoutPreview.substring(0, 150) + '...' : 'NULL'}`);
    console.log('---');
  }
  
  await conn.end();
}

main().catch(console.error);
