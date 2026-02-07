// Restaurar PLUS IZQUIERDA desde backup-restore.json
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== RESTAURAR PLUS IZQUIERDA DESDE BACKUP ===\n');
  
  // Leer el backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  
  // Filtrar asientos de PLUS IZQUIERDA
  const plusIzqBackup = backup.seats.filter(s => s.id.startsWith('plus-izquierda-'));
  console.log(`Asientos en backup: ${plusIzqBackup.length}`);
  
  // Mostrar ejemplos del backup
  console.log('\nEjemplos del backup:');
  const examples = plusIzqBackup.filter(s => s.rowLabel === 'A' || s.rowLabel === 'P').slice(0, 6);
  examples.forEach(s => {
    console.log(`${s.id}: x=${s.metadata.canvas?.position?.x}, y=${s.metadata.canvas?.position?.y}`);
  });
  
  // Actualizar cada asiento con los datos del backup
  console.log('\n=== APLICANDO RESTAURACIÓN ===');
  let updated = 0;
  let errors = 0;
  
  for (const backupSeat of plusIzqBackup) {
    try {
      await prisma.seat.update({
        where: { id: backupSeat.id },
        data: { 
          metadata: JSON.stringify(backupSeat.metadata)
        }
      });
      updated++;
    } catch (e) {
      errors++;
      if (errors <= 3) {
        console.log(`Error en ${backupSeat.id}: ${e.message}`);
      }
    }
  }
  
  console.log(`Actualizados: ${updated}`);
  console.log(`Errores: ${errors}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const rowYAvg = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowYAvg[s.rowLabel]) rowYAvg[s.rowLabel] = { sum: 0, count: 0 };
    rowYAvg[s.rowLabel].sum += y;
    rowYAvg[s.rowLabel].count++;
  });
  
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  for (const row of rowOrder) {
    if (rowYAvg[row]) {
      const avgY = rowYAvg[row].sum / rowYAvg[row].count;
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
