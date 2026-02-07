// Verificar cómo llegan las coordenadas al frontend
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== VERIFICAR COORDENADAS VIP DERECHA ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true },
    take: 30
  });
  
  console.log('Muestra de asientos:\n');
  
  // Agrupar por fila para ver la distribución
  const byRow = {};
  
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    
    const x = meta.canvas?.position?.x;
    const y = meta.canvas?.position?.y;
    
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({ num: s.columnNumber, x, y });
  });
  
  // Mostrar por fila
  for (const row of Object.keys(byRow).sort((a,b) => Number(a) - Number(b))) {
    console.log(`\nFila ${row}:`);
    const rowSeats = byRow[row].sort((a,b) => b.num - a.num);
    rowSeats.forEach(s => {
      console.log(`  Asiento ${s.num}: (${s.x}, ${s.y})`);
    });
    
    // Calcular vector de la fila
    if (rowSeats.length >= 2) {
      const first = rowSeats[0];
      const last = rowSeats[rowSeats.length - 1];
      const dx = last.x - first.x;
      const dy = last.y - first.y;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      console.log(`  Vector fila: (${dx.toFixed(1)}, ${dy.toFixed(1)}) Ángulo: ${angle.toFixed(1)}°`);
    }
  }
  
  await prisma.$disconnect();
}

main();
