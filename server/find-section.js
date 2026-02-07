// Buscar sección y polígono de PLUS IZQUIERDA
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== BUSCANDO SECCIÓN PLUS IZQUIERDA ===\n');
  
  // Buscar por ID exacto
  let section = await prisma.section.findFirst({
    where: { id: 'section-1769728289095' }
  });
  
  if (!section) {
    // Buscar por nombre
    section = await prisma.section.findFirst({
      where: { name: 'PLUS IZQUIERDA' }
    });
  }
  
  if (section) {
    console.log('Section encontrada:');
    console.log('  Name:', section.name);
    console.log('  ID:', section.id);
    let meta = {};
    try { meta = JSON.parse(section.metadata || '{}'); } catch(e) {}
    console.log('  Metadata:', JSON.stringify(meta, null, 2));
  } else {
    console.log('No encontrada por ID ni nombre');
    
    // Listar todas las secciones
    const all = await prisma.section.findMany({
      where: { layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba' }
    });
    console.log('\nTodas las secciones del layout:');
    all.forEach(s => console.log(`  - ${s.name} (${s.id})`));
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
