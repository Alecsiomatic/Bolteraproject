// Corregir numeración: Invertir X para que todas vayan DER→IZQ
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function invertirX(prefix, sectionName) {
  console.log(`\n=== ${sectionName} ===`);
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  if (seats.length === 0) {
    console.log('No hay asientos');
    return;
  }
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({
      id: s.id,
      num: s.columnNumber,
      x: meta.canvas?.position?.x || 0,
      y: meta.canvas?.position?.y || 0,
      meta: meta
    });
  });
  
  let updated = 0;
  
  for (const row of Object.keys(byRow)) {
    const rowSeats = byRow[row].sort((a, b) => a.x - b.x);
    const n = rowSeats.length;
    
    // Obtener todas las X ordenadas
    const xPositions = rowSeats.map(s => s.x);
    
    // Invertir: el primero toma la X del último, etc.
    for (let i = 0; i < n; i++) {
      const seat = rowSeats[i];
      const newX = xPositions[n - 1 - i];
      
      seat.meta.canvas = seat.meta.canvas || {};
      seat.meta.canvas.position = { x: newX, y: seat.y };
      seat.meta.canvas.size = { width: 7, height: 7 };
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      updated++;
    }
  }
  
  console.log(`Invertidos: ${updated} asientos`);
  
  // Verificar - buscar cualquier fila que exista
  const rows = Object.keys(byRow);
  const testRow = rows.includes('A') ? 'A' : rows.includes('1') ? '1' : rows[0];
  
  const check = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' }, rowLabel: testRow },
    select: { columnNumber: true, metadata: true }
  });
  
  if (check.length > 0) {
    const sorted = check.map(s => {
      let meta = {};
      try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
      return { num: s.columnNumber, x: meta.canvas?.position?.x || 0 };
    }).sort((a, b) => a.x - b.x);
    
    const first3 = sorted.slice(0, 3).map(s => s.num).join(',');
    const last3 = sorted.slice(-3).map(s => s.num).join(',');
    const leftNum = sorted[0].num;
    const rightNum = sorted[sorted.length - 1].num;
    const dir = leftNum > rightNum ? 'DER→IZQ ✅' : 'IZQ→DER ❌';
    console.log(`Fila ${testRow}: [${first3}...${last3}] → ${dir}`);
  }
}

async function main() {
  console.log('=== CORRIGIENDO NUMERACIÓN ===');
  console.log('Objetivo: Todas DER→IZQ (número mayor a la izquierda, 1 a la derecha)\n');
  
  // Secciones que necesitan corrección
  await invertirX('vip-central', 'VIP CENTRAL');
  await invertirX('vip-derecha', 'VIP DERECHA');
  await invertirX('plus-central', 'PLUS CENTRAL');
  await invertirX('plus-derecha', 'PLUS DERECHA');
  await invertirX('preferente-derecha', 'PREFERENTE DERECHA');
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
