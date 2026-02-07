// Eliminar asientos extra de VIP CENTRAL (dejar solo los del backup)
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  console.log('=== LIMPIAR VIP CENTRAL ===\n');
  
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupIds = new Set(backup.seats.filter(s => s.id.startsWith('vip-central-')).map(s => s.id));
  
  console.log('IDs en backup: ' + backupIds.size);
  
  // Obtener todos los actuales
  const current = await prisma.seat.findMany({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', id: { startsWith: 'vip-central-' } },
    select: { id: true }
  });
  
  console.log('IDs actuales: ' + current.length);
  
  // Encontrar los que no están en backup
  const toDelete = current.filter(s => !backupIds.has(s.id));
  console.log('A eliminar: ' + toDelete.length);
  console.log('IDs a eliminar:', toDelete.map(s => s.id));
  
  // Eliminar
  for (const s of toDelete) {
    await prisma.seat.delete({ where: { id: s.id } });
  }
  
  console.log('\n✅ Eliminados ' + toDelete.length + ' asientos');
  
  // Verificar
  const after = await prisma.seat.count({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', id: { startsWith: 'vip-central-' } }
  });
  console.log('VIP CENTRAL ahora tiene: ' + after + ' asientos');
  
  await prisma.$disconnect();
}

main().catch(console.error);
