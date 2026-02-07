// Restaurar TODAS las secciones desde backup y luego invertir numeración correctamente
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== RESTAURAR TODO DESDE BACKUP ===\n');
  
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  console.log(`Total asientos en backup: ${backup.seats.length}`);
  
  // Restaurar todos los asientos
  let restored = 0;
  for (const bs of backup.seats) {
    try {
      await prisma.seat.update({
        where: { id: bs.id },
        data: { metadata: JSON.stringify(bs.metadata) }
      });
      restored++;
    } catch(e) {
      // Ignorar asientos que no existen
    }
  }
  
  console.log(`Restaurados: ${restored}`);
  
  // Verificar estado después de restaurar
  console.log('\n=== VERIFICACIÓN POST-RESTAURACIÓN ===');
  
  const sections = [
    'diamante-izquierda', 'diamante-central', 'diamante-derecha',
    'vip-izquierda', 'vip-central', 'vip-derecha',
    'plus-izquierda', 'plus-central', 'plus-derecha',
    'preferente-izquierda', 'preferente-central', 'preferente-derecha'
  ];
  
  for (const prefix of sections) {
    const seats = await prisma.seat.findMany({
      where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' } },
      select: { rowLabel: true, columnNumber: true, metadata: true }
    });
    
    if (seats.length === 0) continue;
    
    // Tomar primera fila alfabética o numérica
    const rows = [...new Set(seats.map(s => s.rowLabel))].sort();
    const testRow = rows.includes('A') ? 'A' : rows.includes('1') ? '1' : rows[0];
    
    const rowSeats = seats.filter(s => s.rowLabel === testRow).map(s => {
      let meta = {};
      try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
      return { num: s.columnNumber, x: meta.canvas?.position?.x || 0 };
    }).sort((a, b) => a.x - b.x);
    
    if (rowSeats.length === 0) continue;
    
    const leftNum = rowSeats[0].num;
    const rightNum = rowSeats[rowSeats.length - 1].num;
    const dir = leftNum > rightNum ? 'DER→IZQ' : 'IZQ→DER';
    
    console.log(`${prefix}: Fila ${testRow} - ${dir} (izq=${leftNum}, der=${rightNum})`);
  }
  
  await prisma.$disconnect();
  console.log('\n✅ RESTAURACIÓN COMPLETADA');
}

main().catch(console.error);
