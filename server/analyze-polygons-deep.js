const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('ANÁLISIS DE POLÍGONOS EN LA BASE DE DATOS');
  console.log('='.repeat(80));
  
  // Buscar en VenueLayout el layoutJson
  const layouts = await prisma.venueLayout.findMany({
    select: { id: true, name: true, venueId: true, layoutJson: true, layoutType: true }
  });
  console.log('\n📊 VenueLayouts encontrados:', layouts.length);
  
  for (const l of layouts) {
    console.log('\n--- Layout:', l.name, '---');
    console.log('  ID:', l.id);
    console.log('  VenueId:', l.venueId);
    console.log('  Type:', l.layoutType);
    if (l.layoutJson) {
      try {
        const layout = JSON.parse(l.layoutJson);
        console.log('  layoutJson keys:', Object.keys(layout));
      } catch(e) {
        console.log('  layoutJson: no es JSON válido');
      }
    } else {
      console.log('  layoutJson: null');
    }
  }
  
  // Buscar en Venue el layoutJson
  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, layoutJson: true }
  });
  console.log('\n\n📊 Venues encontrados:', venues.length);
  
  for (const v of venues) {
    console.log('\n='.repeat(60));
    console.log('VENUE:', v.name);
    console.log('ID:', v.id);
    console.log('='.repeat(60));
    
    if (v.layoutJson) {
      try {
        const layout = JSON.parse(v.layoutJson);
        console.log('\nlayoutJson encontrado!');
        console.log('Keys principales:', Object.keys(layout));
        
        // Analizar estructura
        if (layout.sections) {
          console.log('\n📍 SECTIONS:', layout.sections.length);
          layout.sections.forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.name || s.id}`);
            if (s.polygon) console.log('     polygon:', s.polygon.length, 'puntos');
            if (s.polygonPoints) console.log('     polygonPoints:', s.polygonPoints.length, 'puntos');
            if (s.color) console.log('     color:', s.color);
            if (s.zone) console.log('     zone:', s.zone);
          });
        }
        
        if (layout.polygons) {
          console.log('\n📍 POLYGONS:', layout.polygons.length);
          layout.polygons.forEach((p, i) => {
            console.log(`  ${i + 1}. ${p.name || p.id || 'sin nombre'}`);
            if (p.points) console.log('     points:', p.points.length);
          });
        }
        
        if (layout.zones) {
          console.log('\n📍 ZONES:', layout.zones.length);
          layout.zones.forEach((z, i) => {
            console.log(`  ${i + 1}. ${z.name || z.id}`);
          });
        }
        
        if (layout.objects) {
          console.log('\n📍 OBJECTS:', layout.objects.length);
          const types = {};
          layout.objects.forEach(o => {
            types[o.type] = (types[o.type] || 0) + 1;
          });
          console.log('  Tipos:', types);
        }
        
      } catch(e) {
        console.log('layoutJson: error parseando -', e.message);
      }
    } else {
      console.log('layoutJson: null');
    }
  }
  
  // Buscar LayoutSections
  const sections = await prisma.layoutSection.findMany({
    select: { id: true, name: true, parentLayoutId: true, polygonPoints: true, color: true, displayOrder: true }
  });
  console.log('\n\n📊 LayoutSections encontradas:', sections.length);
  
  for (const s of sections) {
    console.log('\n--- Section:', s.name, '---');
    console.log('  ID:', s.id);
    console.log('  Parent:', s.parentLayoutId);
    console.log('  Color:', s.color);
    console.log('  Order:', s.displayOrder);
    if (s.polygonPoints) {
      try {
        const poly = JSON.parse(s.polygonPoints);
        console.log('  Polygon:', poly.length, 'puntos');
      } catch(e) {
        console.log('  Polygon: no JSON');
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
