import mysql from 'mysql2/promise';

async function check() {
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    user: 'u501aborar_boletera',
    password: 'Boletera1234!',
    database: 'u501laborar_boletera'
  });

  const layoutId = '7535a613-8195-4861-bae6-5d2ad060c730';

  // Contar asientos en ese layout
  const [count] = await conn.query('SELECT COUNT(*) as total FROM Seat WHERE layoutId = ?', [layoutId]);
  console.log('Total asientos en BD:', count[0].total);

  // Ver el JSON del layout
  const [layout] = await conn.query('SELECT layoutJson FROM VenueLayout WHERE id = ?', [layoutId]);
  if (layout[0]?.layoutJson) {
    const json = JSON.parse(layout[0].layoutJson);
    const objects = json.objects || [];
    const circles = objects.filter(o => o.type === 'Circle' || o.type === 'circle');
    console.log('Objetos en JSON:', objects.length);
    console.log('Circulos en JSON (asientos):', circles.length);
  }

  await conn.end();
}

check().catch(console.error);
