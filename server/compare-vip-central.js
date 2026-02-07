// Comparar VIP CENTRAL backup vs actual
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== VIP CENTRAL: BACKUP vs ACTUAL ===\n');
  
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('vip-central-'));
  
  console.log('BACKUP: ' + backupSeats.length + ' asientos');
  
  // Estado actual
  const current = await prisma.seat.findMany({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', id: { startsWith: 'vip-central-' } }
  });
  console.log('ACTUAL: ' + current.length + ' asientos');
  
  // Hay diferencia en cantidad?
  if (backupSeats.length !== current.length) {
    console.log('\n⚠️ DIFERENCIA EN CANTIDAD!');
    console.log('Faltan: ' + (backupSeats.length - current.length));
  }
  
  // Comparar posiciones
  console.log('\n=== MUESTRA DE POSICIONES ===');
  for (let i = 0; i < 5 && i < backupSeats.length; i++) {
    const bs = backupSeats[i];
    const cs = current.find(c => c.id === bs.id);
    
    const bPos = bs.metadata.canvas?.position;
    let cPos = null;
    if (cs) {
      try {
        const meta = JSON.parse(cs.metadata || '{}');
        cPos = meta.canvas?.position;
      } catch(e) {}
    }
    
    console.log(bs.id);
    console.log('  Backup: X=' + bPos?.x + ' Y=' + bPos?.y);
    console.log('  Actual: X=' + cPos?.x + ' Y=' + cPos?.y);
    console.log('  Match: ' + (bPos?.x === cPos?.x && bPos?.y === cPos?.y ? '✅' : '❌'));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
