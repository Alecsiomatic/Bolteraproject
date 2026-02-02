const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('BÚSQUEDA EXHAUSTIVA DE POLÍGONOS');
  console.log('='.repeat(80));
  
  // Buscar TODOS los venues con layoutJson completo
  const venues = await prisma.venue.findMany();
  
  for (const v of venues) {
    console.log('\n' + '='.repeat(80));
    console.log('VENUE:', v.name);
    console.log('ID:', v.id);
    console.log('layoutVersion:', v.layoutVersion);
    console.log('='.repeat(80));
    
    if (v.layoutJson) {
      // Imprimir los primeros 5000 caracteres del layoutJson
      console.log('\nlayoutJson (primeros 5000 chars):');
      console.log(v.layoutJson.substring(0, 5000));
      console.log('\n... (total length:', v.layoutJson.length, ')');
      
      try {
        const layout = JSON.parse(v.layoutJson);
        
        // Buscar sections en cualquier lugar
        const findSections = (obj, path = '') => {
          if (!obj || typeof obj !== 'object') return;
          
          if (Array.isArray(obj)) {
            obj.forEach((item, i) => findSections(item, `${path}[${i}]`));
          } else {
            for (const [key, value] of Object.entries(obj)) {
              if (key === 'sections' && Array.isArray(value) && value.length > 0) {
                console.log(`\n📍 SECTIONS encontradas en ${path}.${key}: ${value.length}`);
                value.forEach((s, i) => {
                  console.log(`  ${i + 1}. ${s.name || s.label || s.id}`);
                  if (s.polygonPoints) console.log(`     polygonPoints: ${s.polygonPoints.length} puntos`);
                  if (s.polygon) console.log(`     polygon: ${s.polygon.length} puntos`);
                  if (s.points) console.log(`     points: ${Array.isArray(s.points) ? s.points.length : 'no array'}`);
                });
              }
              if (key === 'zones' && Array.isArray(value) && value.length > 0) {
                console.log(`\n📍 ZONES encontradas en ${path}.${key}: ${value.length}`);
                value.forEach((z, i) => {
                  console.log(`  ${i + 1}. ${z.name || z.id}`);
                  if (z.sections && z.sections.length > 0) {
                    console.log(`     sections dentro de zona: ${z.sections.length}`);
                    z.sections.forEach((s, j) => {
                      console.log(`       ${j + 1}. ${s.name || s.id}`);
                      if (s.polygonPoints) console.log(`          polygonPoints: ${s.polygonPoints.length}`);
                      if (s.polygon) console.log(`          polygon: ${s.polygon.length}`);
                    });
                  }
                  if (z.polygon) console.log(`     polygon: ${z.polygon.length} puntos`);
                });
              }
              findSections(value, `${path}.${key}`);
            }
          }
        };
        
        findSections(layout, 'root');
        
      } catch(e) {
        console.log('Error parsing:', e.message);
      }
    }
  }
  
  // También buscar en VenueLayouts
  console.log('\n\n' + '='.repeat(80));
  console.log('VENUE LAYOUTS');
  console.log('='.repeat(80));
  
  const layouts = await prisma.venueLayout.findMany();
  
  for (const l of layouts) {
    console.log('\n--- Layout:', l.name, '---');
    console.log('ID:', l.id);
    console.log('venueId:', l.venueId);
    console.log('version:', l.version);
    
    if (l.layoutJson && l.layoutJson.length > 10) {
      console.log('layoutJson length:', l.layoutJson.length);
      
      try {
        const layout = JSON.parse(l.layoutJson);
        console.log('Keys:', Object.keys(layout));
        
        if (layout.sections) {
          console.log('sections:', layout.sections.length);
          layout.sections.forEach(s => {
            console.log(`  - ${s.name}`);
            if (s.polygonPoints) console.log(`    polygonPoints: ${s.polygonPoints.length}`);
          });
        }
        
        if (layout.zones) {
          console.log('zones:', layout.zones.length);
          layout.zones.forEach(z => {
            console.log(`  - ${z.name}`);
            if (z.sections) {
              z.sections.forEach(s => console.log(`    section: ${s.name}`));
            }
          });
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
