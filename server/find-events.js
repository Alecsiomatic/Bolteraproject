const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('BÚSQUEDA DE EVENTOS Y LAYOUTS');
  console.log('='.repeat(80));
  
  // Buscar eventos
  const events = await prisma.event.findMany({
    select: { id: true, name: true, venueId: true, venue: { select: { name: true } } }
  });
  
  console.log('\n📊 EVENTOS:', events.length);
  events.forEach(e => console.log(`  - ${e.name} | venue: ${e.venue?.name || e.venueId}`));
  
  // Buscar VenueLayouts con eventId
  const eventLayouts = await prisma.venueLayout.findMany({
    where: { eventId: { not: null } },
    select: { id: true, name: true, eventId: true, layoutJson: true }
  });
  
  console.log('\n📊 LAYOUTS CON EVENTO:', eventLayouts.length);
  for (const l of eventLayouts) {
    console.log(`  - ${l.name} | eventId: ${l.eventId}`);
    if (l.layoutJson) {
      try {
        const layout = JSON.parse(l.layoutJson);
        if (layout.sections) console.log(`    sections: ${layout.sections.length}`);
        if (layout.zones) console.log(`    zones: ${layout.zones.length}`);
      } catch(e) {}
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
