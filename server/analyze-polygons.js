const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';
  const VENUE_ID = '2a8073f3-3b78-4394-8eab-79e7d988542a';
  
  console.log('='.repeat(80));
  console.log('ANÁLISIS DE POLÍGONOS Y ORDEN - BASE DE DATOS');
  console.log('='.repeat(80));
  
  // 1. Verificar layouts
  console.log('\n📊 LAYOUTS:');
  const layouts = await prisma.venueLayout.findMany({
    where: { venueId: VENUE_ID },
    select: { id: true, name: true, isDefault: true, layoutType: true }
  });
  console.log('Total:', layouts.length);
  layouts.forEach(l => console.log('  ', l.id, '-', l.name, '| default:', l.isDefault, '| type:', l.layoutType));
  
  // 2. Buscar LayoutSections
  console.log('\n📊 LAYOUT SECTIONS:');
  const sections = await prisma.layoutSection.findMany({
    orderBy: { displayOrder: 'asc' }
  });
  console.log('Total sections:', sections.length);
  
  for (const s of sections) {
    console.log('\n---', s.name, '---');
    console.log('  ID:', s.id);
    console.log('  ParentLayoutId:', s.parentLayoutId);
    console.log('  ZoneId:', s.zoneId);
    console.log('  Color:', s.color);
    console.log('  Orden:', s.displayOrder);
    console.log('  Capacidad:', s.capacity);
    
    if (s.polygonPoints) {
      try {
        const poly = JSON.parse(s.polygonPoints);
        if (Array.isArray(poly) && poly.length > 0) {
          console.log('  Polígono:', poly.length, 'puntos');
          const avgX = poly.reduce((sum, p) => sum + (p.x || 0), 0) / poly.length;
          const avgY = poly.reduce((sum, p) => sum + (p.y || 0), 0) / poly.length;
          console.log('    Centro aprox: X=' + avgX.toFixed(0) + ', Y=' + avgY.toFixed(0));
          console.log('    Primer punto: X=' + poly[0].x + ', Y=' + poly[0].y);
        }
      } catch (e) {
        console.log('  Polígono: (no JSON array)');
      }
    }
  }
  
  // 3. LayoutZones
  console.log('\n\n📊 LAYOUT ZONES:');
  const zones = await prisma.layoutZone.findMany({
    where: { layoutId: LAYOUT_ID }
  });
  console.log('Total:', zones.length);
  zones.forEach(z => {
    console.log('  -', z.name, '| color:', z.color, '| precio:', z.basePrice?.toString());
  });
  
  // 4. VenueZones
  console.log('\n\n📊 VENUE ZONES:');
  const venueZones = await prisma.venueZone.findMany({
    where: { venueId: VENUE_ID }
  });
  console.log('Total:', venueZones.length);
  venueZones.forEach(z => {
    console.log('  -', z.name, '| color:', z.color, '| precio:', z.basePrice?.toString());
  });
  
  // 5. Analizar sectionName de los seats para ver qué secciones hay
  console.log('\n\n📊 SECCIONES ÚNICAS EN SEATS:');
  const seatSections = await prisma.seat.groupBy({
    by: ['sectionName', 'zone'],
    where: { layoutId: LAYOUT_ID },
    _count: true,
    _avg: { x: true, y: true }
  });
  
  console.log('Secciones encontradas en asientos:');
  seatSections.sort((a, b) => a.zone.localeCompare(b.zone) || a.sectionName.localeCompare(b.sectionName));
  
  for (const s of seatSections) {
    console.log(`\n  ${s.zone} - ${s.sectionName}:`);
    console.log(`    Asientos: ${s._count}`);
    console.log(`    Centro X: ${s._avg.x?.toFixed(0)}, Centro Y: ${s._avg.y?.toFixed(0)}`);
  }
  
  // 6. Analizar el orden visual (por posición Y)
  console.log('\n\n📊 ORDEN VISUAL DE SECCIONES (por posición Y):');
  const sortedByY = [...seatSections].sort((a, b) => (b._avg.y || 0) - (a._avg.y || 0));
  console.log('\nDe ARRIBA (Y alto - cerca escenario) hacia ABAJO (Y bajo - lejos escenario):');
  sortedByY.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.zone.padEnd(12)} ${s.sectionName.padEnd(20)} | Y=${s._avg.y?.toFixed(0)} | ${s._count} asientos`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
