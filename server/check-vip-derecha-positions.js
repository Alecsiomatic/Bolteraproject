// Ver posiciones actuales de VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== VIP DERECHA - POSICIONES ACTUALES ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  // Agrupar por fila y ver posiciones Y
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    const x = meta.canvas?.position?.x || 0;
    
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = { seats: [], minY: Infinity, maxY: -Infinity, minX: Infinity, maxX: -Infinity };
    byRow[s.rowLabel].seats.push({ num: s.columnNumber, x, y });
    byRow[s.rowLabel].minY = Math.min(byRow[s.rowLabel].minY, y);
    byRow[s.rowLabel].maxY = Math.max(byRow[s.rowLabel].maxY, y);
    byRow[s.rowLabel].minX = Math.min(byRow[s.rowLabel].minX, x);
    byRow[s.rowLabel].maxX = Math.max(byRow[s.rowLabel].maxX, x);
  });
  
  console.log('Fila | Count | Y_range | X_range');
  console.log('-----|-------|---------|--------');
  
  for (let row = 1; row <= 8; row++) {
    const r = byRow[String(row)];
    if (r) {
      console.log(`  ${row}  |  ${r.seats.length.toString().padStart(2)}   | ${r.minY.toFixed(0)}-${r.maxY.toFixed(0)} | ${r.minX.toFixed(0)}-${r.maxX.toFixed(0)}`);
    }
  }
  
  // Mostrar muestra de asientos de cada fila
  console.log('\n=== MUESTRA POR FILA ===');
  for (let row = 1; row <= 8; row++) {
    const r = byRow[String(row)];
    if (r) {
      r.seats.sort((a,b) => a.num - b.num);
      const first = r.seats[0];
      const last = r.seats[r.seats.length - 1];
      console.log(`Fila ${row}: primer asiento ${first.num} en (${first.x.toFixed(0)}, ${first.y.toFixed(0)}), último ${last.num} en (${last.x.toFixed(0)}, ${last.y.toFixed(0)})`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
