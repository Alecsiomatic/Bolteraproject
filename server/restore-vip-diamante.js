// Restaurar VIP CENTRAL, VIP DERECHA y DIAMANTE DERECHA desde backup
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== RESTAURAR VIP CENTRAL, VIP DERECHA, DIAMANTE DERECHA ===\n');
  
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  
  const sectionsToRestore = ['vip-central-', 'vip-derecha-', 'diamante-derecha-'];
  
  for (const prefix of sectionsToRestore) {
    const seats = backup.seats.filter(s => s.id.startsWith(prefix));
    console.log(`Restaurando ${prefix}: ${seats.length} asientos`);
    
    for (const bs of seats) {
      await prisma.seat.update({
        where: { id: bs.id },
        data: { metadata: JSON.stringify(bs.metadata) }
      });
    }
    console.log(`✅ ${prefix} restaurado`);
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
