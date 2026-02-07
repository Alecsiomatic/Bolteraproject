// Buscar PLUS IZQUIERDA en todas partes
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== BUSCANDO PLUS IZQUIERDA ===\n');
  
  // 1. Buscar en VenueLayout
  const layouts = await prisma.venueLayout.findMany({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b' }
  });
  
  console.log(`Layouts encontrados: ${layouts.length}`);
  for (const l of layouts) {
    console.log(`- Layout: ${l.name}, ID: ${l.id}`);
    let meta = {};
    try { meta = JSON.parse(l.metadata || '{}'); } catch(e) {}
    console.log(`  Metadata keys: ${Object.keys(meta).join(', ')}`);
    if (meta.sections) {
      console.log(`  Sections: ${meta.sections.length}`);
      meta.sections.forEach(s => console.log(`    - ${s.name}`));
    }
  }
  
  // 2. Buscar un asiento de PLUS IZQUIERDA para ver su estructura
  const sample = await prisma.seat.findFirst({
    where: { 
      venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b',
      id: { startsWith: 'plus-izquierda-' }
    }
  });
  
  if (sample) {
    console.log('\n=== EJEMPLO DE ASIENTO ===');
    console.log(`ID: ${sample.id}`);
    console.log(`Label: ${sample.label}`);
    console.log(`Row: ${sample.rowLabel}`);
    console.log(`Section ID: ${sample.sectionId}`);
    let meta = {};
    try { meta = JSON.parse(sample.metadata || '{}'); } catch(e) {}
    console.log(`Metadata: ${JSON.stringify(meta, null, 2)}`);
  }
  
  // 3. Buscar la sección directamente
  if (sample && sample.sectionId) {
    const section = await prisma.section.findUnique({
      where: { id: sample.sectionId }
    });
    if (section) {
      console.log('\n=== SECTION ===');
      console.log(`ID: ${section.id}`);
      console.log(`Name: ${section.name}`);
      let meta = {};
      try { meta = JSON.parse(section.metadata || '{}'); } catch(e) {}
      console.log(`Metadata: ${JSON.stringify(meta, null, 2)}`);
    }
  }
  
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
