const mysql = require('mysql2/promise');

async function main() {
  console.log('='.repeat(80));
  console.log('ANÁLISIS DE POLÍGONOS - VPS EN LÍNEA');
  console.log('='.repeat(80));
  
  const conn = await mysql.createConnection({
    host: '72.167.60.4',
    user: 'boletera_user',
    password: 'Cer0un0cer0.com20182417',
    database: 'boletera_db'
  });
  
  console.log('\n✅ Conectado al VPS');
  
  // Buscar todos los venues
  console.log('\n📊 VENUES:');
  const [venues] = await conn.execute('SELECT id, name, layoutVersion, LENGTH(layoutJson) as jsonLen FROM Venue');
  venues.forEach(v => console.log(`  - ${v.name} | version: ${v.layoutVersion} | layoutJson: ${v.jsonLen} bytes`));
  
  // Obtener layoutJson del parque tangamanga o teatro
  for (const v of venues) {
    console.log('\n' + '='.repeat(80));
    console.log('VENUE:', v.name);
    console.log('='.repeat(80));
    
    const [fullVenue] = await conn.execute('SELECT layoutJson FROM Venue WHERE id = ?', [v.id]);
    
    if (fullVenue[0].layoutJson) {
      const layoutJson = fullVenue[0].layoutJson;
      console.log('layoutJson length:', layoutJson.length);
      
      try {
        const layout = JSON.parse(layoutJson);
        console.log('Keys:', Object.keys(layout));
        
        // Buscar sections
        if (layout.sections && layout.sections.length > 0) {
          console.log('\n📍 SECTIONS:', layout.sections.length);
          layout.sections.forEach((s, i) => {
            console.log(`\n  ${i + 1}. ${s.name || s.id}`);
            if (s.polygonPoints) {
              console.log(`     polygonPoints: ${s.polygonPoints.length} puntos`);
              // Calcular centro
              const avgX = s.polygonPoints.reduce((sum, p) => sum + (p.x || 0), 0) / s.polygonPoints.length;
              const avgY = s.polygonPoints.reduce((sum, p) => sum + (p.y || 0), 0) / s.polygonPoints.length;
              console.log(`     Centro: X=${avgX.toFixed(0)}, Y=${avgY.toFixed(0)}`);
            }
            if (s.zone) console.log(`     zone: ${s.zone}`);
            if (s.color) console.log(`     color: ${s.color}`);
          });
        }
        
        // Buscar zones
        if (layout.zones && layout.zones.length > 0) {
          console.log('\n📍 ZONES:', layout.zones.length);
          layout.zones.forEach((z, i) => {
            console.log(`  ${i + 1}. ${z.name || z.id}`);
            if (z.sections && z.sections.length > 0) {
              console.log(`     sections: ${z.sections.length}`);
              z.sections.forEach(s => {
                console.log(`       - ${s.name}`);
                if (s.polygonPoints) console.log(`         polygonPoints: ${s.polygonPoints.length}`);
              });
            }
          });
        }
        
        // canvas.objects
        if (layout.canvas && layout.canvas.objects && layout.canvas.objects.length > 0) {
          const types = {};
          layout.canvas.objects.forEach(o => {
            types[o.type] = (types[o.type] || 0) + 1;
          });
          console.log('\n📍 CANVAS OBJECTS:', layout.canvas.objects.length);
          console.log('  Tipos:', JSON.stringify(types));
        }
        
      } catch(e) {
        console.log('Error parsing:', e.message);
      }
    }
  }
  
  // Buscar VenueLayouts
  console.log('\n\n' + '='.repeat(80));
  console.log('VENUE LAYOUTS');
  console.log('='.repeat(80));
  
  const [layouts] = await conn.execute('SELECT id, name, venueId, version, LENGTH(layoutJson) as jsonLen FROM VenueLayout');
  
  for (const l of layouts) {
    console.log(`\n--- ${l.name} (venue: ${l.venueId}) ---`);
    console.log(`  version: ${l.version}, layoutJson: ${l.jsonLen} bytes`);
    
    if (l.jsonLen > 100) {
      const [fullLayout] = await conn.execute('SELECT layoutJson FROM VenueLayout WHERE id = ?', [l.id]);
      try {
        const layout = JSON.parse(fullLayout[0].layoutJson);
        console.log('  Keys:', Object.keys(layout));
        if (layout.sections) console.log('  sections:', layout.sections.length);
        if (layout.zones) console.log('  zones:', layout.zones.length);
      } catch(e) {}
    }
  }
  
  await conn.end();
  console.log('\n✅ Desconectado');
}

main().catch(e => { 
  console.error('Error:', e.message); 
  process.exit(1); 
});
