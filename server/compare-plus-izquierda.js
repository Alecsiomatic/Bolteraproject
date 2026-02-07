// Comparar PLUS IZQUIERDA: DB vs Excel
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Excel PLUS IZQUIERDA - P abajo, A arriba
// Dirección: DERECHA A IZQ (número 1 a la derecha, número mayor a la izquierda)
const EXCEL_PLUS_IZQUIERDA = {
  'P': { count: 26, min: 1, max: 26 },
  'O': { count: 25, min: 1, max: 25 },
  'N': { count: 25, min: 1, max: 25 },
  'M': { count: 31, min: 1, max: 31 },
  'L': { count: 31, min: 1, max: 31 },
  'K': { count: 30, min: 1, max: 30 },
  'J': { count: 30, min: 1, max: 30 },
  'I': { count: 29, min: 1, max: 29 },
  'H': { count: 29, min: 1, max: 29 },
  'G': { count: 28, min: 1, max: 28 },
  'F': { count: 28, min: 1, max: 28 },
  'E': { count: 27, min: 1, max: 27 },
  'D': { count: 27, min: 1, max: 27 },
  'C': { count: 27, min: 1, max: 27 },
  'B': { count: 26, min: 1, max: 26 },
  'A': { count: 26, min: 1, max: 26 }
};

const EXPECTED_TOTAL = 445;

async function main() {
  console.log('=== PLUS IZQUIERDA: DB vs EXCEL ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total en DB: ${seats.length}`);
  console.log(`Total en Excel: ${EXPECTED_TOTAL}\n`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s.columnNumber);
  });
  
  console.log('FILA | DB    | EXCEL | DB_RANGE    | EXCEL_RANGE | STATUS');
  console.log('-----|-------|-------|-------------|-------------|-------');
  
  let totalDB = 0;
  let totalExcel = 0;
  
  // Orden de filas: P, O, N, M, L, K, J, I, H, G, F, E, D, C, B, A
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  for (const row of rowOrder) {
    const dbNums = (byRow[row] || []).sort((a,b) => a - b);
    const excel = EXCEL_PLUS_IZQUIERDA[row];
    
    const dbCount = dbNums.length;
    const dbMin = dbNums.length > 0 ? dbNums[0] : '-';
    const dbMax = dbNums.length > 0 ? dbNums[dbNums.length - 1] : '-';
    
    const status = dbCount === excel.count ? '✅' : `❌ (${excel.count - dbCount})`;
    
    console.log(`  ${row}  |  ${String(dbCount).padStart(2)}   |  ${String(excel.count).padStart(2)}   | ${String(dbMin).padStart(2)}-${String(dbMax).padEnd(2)}        | ${excel.min}-${excel.max}         | ${status}`);
    
    totalDB += dbCount;
    totalExcel += excel.count;
  }
  
  console.log('-----|-------|-------|-------------|-------------|-------');
  console.log(`TOTAL| ${totalDB}   | ${totalExcel}   |`);
  
  // Verificar posiciones Y para ver si P está abajo y A arriba
  console.log('\n=== VERIFICAR ORDEN DE FILAS ===');
  console.log('Fila | Avg Y  | Posición esperada');
  console.log('-----|--------|------------------');
  
  const rowYAvg = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowYAvg[s.rowLabel]) rowYAvg[s.rowLabel] = { sum: 0, count: 0 };
    rowYAvg[s.rowLabel].sum += y;
    rowYAvg[s.rowLabel].count++;
  });
  
  for (const row of rowOrder) {
    const data = rowYAvg[row];
    if (data) {
      const avgY = data.sum / data.count;
      const expected = row === 'P' ? 'ABAJO (Y alto)' : row === 'A' ? 'ARRIBA (Y bajo)' : '';
      console.log(`  ${row}  | ${avgY.toFixed(0).padStart(5)}  | ${expected}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
