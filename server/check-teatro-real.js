const mysql = require('mysql2/promise');

async function main() {
  console.log('='.repeat(80));
  console.log('ANÁLISIS DEL TEATRO DE LA CIUDAD - VENUE CORRECTO');
  console.log('='.repeat(80));
  
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    port: 3306,
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
  
  console.log('\n✅ Conectado a Hostinger');
  
  const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
  const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
  
  // Buscar el venue
  console.log('\n📊 VENUE:', VENUE_ID);
  const [venues] = await conn.execute('SELECT * FROM Venue WHERE id = ?', [VENUE_ID]);
  
  if (venues.length === 0) {
    console.log('❌ Venue no encontrado');
  } else {
    const v = venues[0];
    console.log('  name:', v.name);
    console.log('  layoutVersion:', v.layoutVersion);
    console.log('  layoutJson length:', v.layoutJson ? v.layoutJson.length : 0);
    
    if (v.layoutJson) {
      try {
        const layout = JSON.parse(v.layoutJson);
        console.log('\n  Keys:', Object.keys(layout));
        
        if (layout.sections && layout.sections.length > 0) {
          console.log('\n  📍 SECTIONS:', layout.sections.length);
          layout.sections.forEach((s, i) => {
            console.log(`\n    ${i + 1}. ${s.name}`);
            if (s.polygonPoints) {
              console.log(`       polygonPoints: ${s.polygonPoints.length} puntos`);
              const avgX = s.polygonPoints.reduce((sum, p) => sum + (p.x || 0), 0) / s.polygonPoints.length;
              const avgY = s.polygonPoints.reduce((sum, p) => sum + (p.y || 0), 0) / s.polygonPoints.length;
              console.log(`       Centro: X=${avgX.toFixed(0)}, Y=${avgY.toFixed(0)}`);
            }
            if (s.zone) console.log(`       zone: ${s.zone}`);
            if (s.color) console.log(`       color: ${s.color}`);
          });
        }
        
        if (layout.zones) {
          console.log('\n  📍 ZONES:', layout.zones.length);
          layout.zones.forEach(z => console.log(`    - ${z.name}`));
        }
        
      } catch(e) {
        console.log('  Error parsing:', e.message);
      }
    }
  }
  
  // Buscar el layout
  console.log('\n\n📊 LAYOUT:', LAYOUT_ID);
  const [layouts] = await conn.execute('SELECT * FROM VenueLayout WHERE id = ?', [LAYOUT_ID]);
  
  if (layouts.length === 0) {
    console.log('❌ Layout no encontrado');
  } else {
    const l = layouts[0];
    console.log('  name:', l.name);
    console.log('  version:', l.version);
    console.log('  venueId:', l.venueId);
    console.log('  layoutJson length:', l.layoutJson ? l.layoutJson.length : 0);
    
    if (l.layoutJson && l.layoutJson.length > 100) {
      try {
        const layout = JSON.parse(l.layoutJson);
        console.log('\n  Keys:', Object.keys(layout));
        
        if (layout.sections) {
          console.log('\n  📍 SECTIONS en VenueLayout:', layout.sections.length);
          layout.sections.forEach((s, i) => {
            console.log(`    ${i + 1}. ${s.name}`);
            if (s.polygonPoints) console.log(`       polygonPoints: ${s.polygonPoints.length}`);
          });
        }
      } catch(e) {}
    }
  }
  
  // Listar todos los venues para referencia
  console.log('\n\n📊 TODOS LOS VENUES:');
  const [allVenues] = await conn.execute('SELECT id, name, layoutVersion FROM Venue');
  allVenues.forEach(v => console.log(`  - ${v.name} | ID: ${v.id} | version: ${v.layoutVersion}`));
  
  await conn.end();
}

main().catch(e => { 
  console.error('Error:', e.message); 
  process.exit(1); 
});
