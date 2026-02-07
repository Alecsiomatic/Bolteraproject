// Fix VIP DERECHA - Invertir X para que sea DER→IZQ
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== FIX VIP DERECHA ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const x = meta.canvas?.position?.x || 0;
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({ id: s.id, num: s.columnNumber, x, meta });
  });
  
  // Verificar dirección actual con fila 1
  const row1 = byRow['1'];
  if (row1) {
    row1.sort((a, b) => a.x - b.x);
    const leftNum = row1[0].num;
    const rightNum = row1[row1.length - 1].num;
    console.log(`Estado actual fila 1: X menor tiene num ${leftNum}, X mayor tiene num ${rightNum}`);
    
    if (leftNum > rightNum) {
      console.log('✅ Ya está en DER→IZQ. No necesita cambios.');
      await prisma.$disconnect();
      return;
    }
    console.log('Necesita inversión: actualmente IZQ→DER, debe ser DER→IZQ');
  }
  
  console.log('\n=== INVIRTIENDO X ===');
  let updated = 0;
  
  for (const row of Object.keys(byRow)) {
    const rowSeats = byRow[row];
    rowSeats.sort((a, b) => a.x - b.x);
    const xPositions = rowSeats.map(s => s.x);
    
    for (let i = 0; i < rowSeats.length; i++) {
      const newX = xPositions[rowSeats.length - 1 - i];
      const seat = rowSeats[i];
      
      seat.meta.canvas = seat.meta.canvas || {};
      seat.meta.canvas.position = seat.meta.canvas.position || {};
      seat.meta.canvas.position.x = newX;
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      updated++;
    }
  }
  
  console.log(`Actualizados: ${updated}`);
  
  // Verificar resultado
  console.log('\n=== VERIFICACIÓN ===');
  const seatsAfter = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { rowLabel: true, columnNumber: true, metadata: true }
  });
  
  const row1After = seatsAfter.filter(s => s.rowLabel === '1').map(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    return { num: s.columnNumber, x: meta.canvas?.position?.x || 0 };
  }).sort((a, b) => a.x - b.x);
  
  console.log(`Fila 1: X menor (${row1After[0].x.toFixed(0)}) = num ${row1After[0].num}, X mayor (${row1After[row1After.length-1].x.toFixed(0)}) = num ${row1After[row1After.length-1].num}`);
  
  if (row1After[0].num > row1After[row1After.length-1].num) {
    console.log('✅ Ahora está en DER→IZQ');
  } else {
    console.log('❌ Todavía está en IZQ→DER');
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
