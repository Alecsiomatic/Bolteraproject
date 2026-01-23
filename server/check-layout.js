const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
  
  const layoutId = '7535a613-8195-4861-bae6-5d2ad060c730';
  
  const [rows] = await conn.execute(
    'SELECT layoutJson FROM VenueLayout WHERE id = ?',
    [layoutId]
  );
  
  if (rows.length === 0) {
    console.log('Layout not found');
    await conn.end();
    return;
  }
  
  const layoutJson = JSON.parse(rows[0].layoutJson);
  const objs = layoutJson.canvas?.objects || [];
  
  // Count object types
  const types = {};
  objs.forEach(o => {
    types[o.type] = (types[o.type] || 0) + 1;
  });
  console.log('Object types in canvas:', types);
  console.log('Total objects:', objs.length);
  
  // Check circles specifically
  const circles = objs.filter(o => o.type === 'circle' || o.type === 'Circle');
  console.log('\nTotal circles:', circles.length);
  
  if (circles.length > 0) {
    console.log('\nFirst circle sample:');
    const sample = circles[0];
    console.log('  type:', sample.type);
    console.log('  radius:', sample.radius);
    console.log('  _customType:', sample._customType);
    console.log('  id:', sample.id);
    console.log('  name:', sample.name);
    console.log('  sectionId:', sample.sectionId);
    console.log('  left:', sample.left);
    console.log('  top:', sample.top);
  }
  
  // Check how many have _customType seat
  const withSeatType = circles.filter(c => c._customType === 'seat');
  console.log('\nCircles with _customType=seat:', withSeatType.length);
  
  // Check sections
  const sections = layoutJson.sections || [];
  console.log('\nSections in layoutJson:', sections.length);
  sections.forEach(s => {
    console.log(`  - ${s.name} (${s.id}): ${s.polygonPoints?.length || 0} points`);
  });
  
  // Check Seat table
  const [seatRows] = await conn.execute(
    'SELECT COUNT(*) as count FROM Seat WHERE layoutId = ?',
    [layoutId]
  );
  console.log('\nSeats in DB (Seat table):', seatRows[0].count);
  
  await conn.end();
})();
