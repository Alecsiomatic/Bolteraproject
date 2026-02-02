const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('BÚSQUEDA DE TEATRO DE LA CIUDAD');
  console.log('='.repeat(80));
  
  // Buscar TODOS los venues
  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, layoutJson: true }
  });
  
  console.log('\n📊 TODOS LOS VENUES:');
  venues.forEach(v => {
    const hasLayout = v.layoutJson ? '✅' : '❌';
    console.log(`  ${hasLayout} ${v.id} - ${v.name}`);
  });
  
  // Analizar cada venue con layoutJson
  for (const v of venues) {
    if (v.layoutJson) {
      console.log('\n' + '='.repeat(80));
      console.log('VENUE:', v.name);
      console.log('ID:', v.id);
      console.log('='.repeat(80));
      
      try {
        const layout = JSON.parse(v.layoutJson);
        console.log('Keys:', Object.keys(layout));
        
        // Ver si tiene sections
        if (layout.sections && layout.sections.length > 0) {
          console.log('\n📍 SECTIONS:', layout.sections.length);
          layout.sections.forEach((s, i) => {
            console.log(`\n  ${i + 1}. ${s.name || s.label || s.id}`);
            Object.keys(s).forEach(key => {
              if (key === 'polygon' || key === 'polygonPoints' || key === 'points') {
                const pts = s[key];
                if (Array.isArray(pts)) {
                  console.log(`     ${key}: ${pts.length} puntos`);
                  if (pts.length > 0) {
                    // Calcular centro aproximado
                    const avgX = pts.reduce((sum, p) => sum + (p.x || 0), 0) / pts.length;
                    const avgY = pts.reduce((sum, p) => sum + (p.y || 0), 0) / pts.length;
                    console.log(`     Centro: X=${avgX.toFixed(0)}, Y=${avgY.toFixed(0)}`);
                  }
                }
              } else if (typeof s[key] !== 'object') {
                console.log(`     ${key}: ${s[key]}`);
              }
            });
          });
        }
        
        // Ver zones
        if (layout.zones && layout.zones.length > 0) {
          console.log('\n📍 ZONES:', layout.zones.length);
          layout.zones.forEach((z, i) => {
            console.log(`\n  ${i + 1}. ${z.name || z.id}`);
            if (z.polygon) console.log(`     polygon: ${z.polygon.length} puntos`);
            if (z.sections) console.log(`     sections: ${z.sections.length}`);
          });
        }
        
        // Ver canvas.objects
        if (layout.canvas && layout.canvas.objects && layout.canvas.objects.length > 0) {
          console.log('\n📍 CANVAS OBJECTS:', layout.canvas.objects.length);
          const types = {};
          layout.canvas.objects.forEach(o => {
            types[o.type] = (types[o.type] || 0) + 1;
          });
          console.log('  Tipos:', JSON.stringify(types));
        }
        
      } catch(e) {
        console.log('Error parsing:', e.message);
      }
    }
  }
  
  // También buscar VenueLayouts
  console.log('\n\n' + '='.repeat(80));
  console.log('VENUE LAYOUTS');
  console.log('='.repeat(80));
  
  const layouts = await prisma.venueLayout.findMany({
    select: { id: true, name: true, venueId: true, layoutJson: true }
  });
  
  for (const l of layouts) {
    if (l.layoutJson) {
      console.log('\n--- Layout:', l.name, '(venue:', l.venueId, ') ---');
      try {
        const layout = JSON.parse(l.layoutJson);
        console.log('Keys:', Object.keys(layout));
        
        if (layout.sections) console.log('sections:', layout.sections.length);
        if (layout.zones) console.log('zones:', layout.zones.length);
        if (layout.canvas && layout.canvas.objects) {
          console.log('canvas.objects:', layout.canvas.objects.length);
        }
      } catch(e) {}
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
