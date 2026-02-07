// Verificar todas las filas de PREFERENTE CENTRAL en DB
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    where: { 
      venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', 
      id: { startsWith: 'preferente-central-' } 
    },
    select: { rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log('=== PREFERENTE CENTRAL - TODAS LAS FILAS EN DB ===\n');
  console.log('Total asientos:', seats.length);
  
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = { count: 0, nums: [], ySum: 0 };
    byRow[s.rowLabel].count++;
    byRow[s.rowLabel].nums.push(s.columnNumber);
    
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    byRow[s.rowLabel].ySum += meta.canvas?.position?.y || 0;
  });
  
  // Ordenar filas alfabéticamente
  const rows = Object.keys(byRow).sort();
  
  console.log('\nFila | Cant | Rango      | Y avg  | Posición');
  console.log('-----|------|------------|--------|----------');
  
  rows.forEach(r => {
    const data = byRow[r];
    const nums = data.nums.sort((a,b) => a - b);
    const min = nums[0];
    const max = nums[nums.length - 1];
    const yAvg = data.ySum / data.count;
    console.log(`  ${r}  |  ${String(data.count).padStart(2)}  | ${String(min).padStart(2)}-${String(max).padEnd(2)}       | ${yAvg.toFixed(0).padStart(5)}  |`);
  });
  
  await prisma.$disconnect();
}
main().catch(console.error);
