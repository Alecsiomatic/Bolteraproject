// Restaurar TODO desde backup
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== RESTAURANDO TODO DESDE BACKUP ===\n');
  
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  console.log(`Total asientos en backup: ${backup.seats.length}`);
  
  let restored = 0;
  for (const bs of backup.seats) {
    await prisma.seat.update({
      where: { id: bs.id },
      data: { metadata: JSON.stringify(bs.metadata) }
    });
    restored++;
  }
  
  console.log(`Restaurados: ${restored}`);
  await prisma.$disconnect();
  console.log('\n✅ RESTAURACIÓN COMPLETA');
}

main().catch(console.error);
