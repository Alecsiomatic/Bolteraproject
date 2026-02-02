const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('ANÁLISIS COMPLETO - PARQUE TANGAMANGA');
  console.log('='.repeat(80));
  
  const VENUE_ID = '9c1c8b2a-5572-487c-8b8f-08efd1f41104';
  
  // Obtener venue con layoutJson completo
  const venue = await prisma.venue.findUnique({
    where: { id: VENUE_ID },
    select: { id: true, name: true, layoutJson: true }
  });
  
  if (!venue) {
    console.log('Venue no encontrado');
    return;
  }
  
  console.log('\nVenue:', venue.name);
  console.log('ID:', venue.id);
  
  if (!venue.layoutJson) {
    console.log('No tiene layoutJson');
    return;
  }
  
  const layout = JSON.parse(venue.layoutJson);
  
  console.log('\n📊 ESTRUCTURA DEL LAYOUT:');
  console.log('Keys:', Object.keys(layout));
  
  // Canvas
  if (layout.canvas) {
    console.log('\n📍 CANVAS:');
    console.log('  ', JSON.stringify(layout.canvas, null, 2).substring(0, 500));
  }
  
  // Zones
  if (layout.zones && layout.zones.length > 0) {
    console.log('\n📍 ZONES:', layout.zones.length);
    layout.zones.forEach((z, i) => {
      console.log(`\n  --- Zona ${i + 1}: ${z.name || z.id} ---`);
      console.log('  Keys:', Object.keys(z));
      if (z.id) console.log('  id:', z.id);
      if (z.name) console.log('  name:', z.name);
      if (z.color) console.log('  color:', z.color);
      if (z.polygon) {
        console.log('  polygon:', z.polygon.length, 'puntos');
        console.log('  Primeros 3 puntos:', JSON.stringify(z.polygon.slice(0, 3)));
      }
      if (z.polygonPoints) {
        console.log('  polygonPoints:', z.polygonPoints.length, 'puntos');
      }
    });
  }
  
  // Sections
  if (layout.sections && layout.sections.length > 0) {
    console.log('\n📍 SECTIONS:', layout.sections.length);
    layout.sections.forEach((s, i) => {
      console.log(`\n  --- Sección ${i + 1}: ${s.name || s.id} ---`);
      console.log('  Keys:', Object.keys(s));
    });
  }
  
  // Objects
  if (layout.objects && layout.objects.length > 0) {
    console.log('\n📍 OBJECTS:', layout.objects.length);
    const types = {};
    layout.objects.forEach(o => {
      types[o.type] = (types[o.type] || 0) + 1;
    });
    console.log('  Por tipo:', types);
    
    // Mostrar algunos ejemplos de cada tipo
    const shown = {};
    for (const obj of layout.objects) {
      if (!shown[obj.type]) {
        shown[obj.type] = true;
        console.log(`\n  Ejemplo de ${obj.type}:`);
        console.log('    Keys:', Object.keys(obj));
        if (obj.x !== undefined) console.log('    x:', obj.x);
        if (obj.y !== undefined) console.log('    y:', obj.y);
        if (obj.points) console.log('    points:', obj.points.length);
        if (obj.polygon) console.log('    polygon:', obj.polygon.length);
      }
    }
  }
  
  // Buscar también en VenueLayout para este venue
  const venueLayouts = await prisma.venueLayout.findMany({
    where: { venueId: VENUE_ID },
    select: { id: true, name: true, layoutJson: true, layoutType: true }
  });
  
  console.log('\n\n📊 VENUE LAYOUTS para este venue:', venueLayouts.length);
  
  for (const vl of venueLayouts) {
    console.log('\n--- VenueLayout:', vl.name, '---');
    console.log('ID:', vl.id);
    console.log('Type:', vl.layoutType);
    
    if (vl.layoutJson) {
      try {
        const vlLayout = JSON.parse(vl.layoutJson);
        console.log('layoutJson keys:', Object.keys(vlLayout));
        
        if (vlLayout.canvas) {
          console.log('  canvas:', JSON.stringify(vlLayout.canvas).substring(0, 200));
        }
        
        if (vlLayout.zones && vlLayout.zones.length > 0) {
          console.log('  zones:', vlLayout.zones.length);
          vlLayout.zones.forEach((z, i) => {
            console.log(`    ${i + 1}. ${z.name || z.id}`);
            if (z.polygon) console.log('       polygon:', z.polygon.length, 'puntos');
            if (z.sections) console.log('       sections:', z.sections.length);
          });
        }
        
        if (vlLayout.sections) {
          console.log('  sections:', vlLayout.sections.length);
        }
        
        if (vlLayout.objects) {
          console.log('  objects:', vlLayout.objects.length);
        }
        
      } catch(e) {
        console.log('Error parsing:', e.message);
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
