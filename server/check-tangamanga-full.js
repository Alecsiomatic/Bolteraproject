const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(80));
  console.log('ANÁLISIS COMPLETO - PARQUE TANGAMANGA');
  console.log('='.repeat(80));
  
  const VENUE_ID = '9c1c8b2a-5572-487c-8b8f-08efd1f41104';
  
  // Obtener venue completo
  const venue = await prisma.venue.findUnique({
    where: { id: VENUE_ID }
  });
  
  console.log('\nVENUE COMPLETO:');
  console.log('name:', venue.name);
  console.log('layoutVersion:', venue.layoutVersion);
  console.log('layoutJson:', venue.layoutJson);
  
  // Obtener todos los VenueLayouts
  const layouts = await prisma.venueLayout.findMany({
    where: { venueId: VENUE_ID }
  });
  
  console.log('\n\nVENUE LAYOUTS:');
  for (const l of layouts) {
    console.log('\n--- Layout:', l.name, '---');
    console.log('ID:', l.id);
    console.log('version:', l.version);
    console.log('layoutType:', l.layoutType);
    console.log('isDefault:', l.isDefault);
    console.log('eventId:', l.eventId);
    console.log('metadata:', l.metadata);
    console.log('layoutJson:', l.layoutJson);
  }
  
  // Ver si hay seats para este venue
  const seatCount = await prisma.seat.count({
    where: { venueId: VENUE_ID }
  });
  console.log('\n\nSEATS para este venue:', seatCount);
  
  // Ver si hay VenueZones
  const zones = await prisma.venueZone.findMany({
    where: { venueId: VENUE_ID }
  });
  console.log('\nVENUE ZONES:', zones.length);
  zones.forEach(z => console.log('  -', z.name, '| color:', z.color));
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
