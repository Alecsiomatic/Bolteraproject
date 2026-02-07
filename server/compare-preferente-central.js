// Comparar PREFERENTE CENTRAL: DB vs Excel
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Excel PREFERENTE CENTRAL - O arriba, A abajo
const EXCEL_ROWS = {
  'O': { count: 56, min: 44, max: 99 },
  'N': { count: 55, min: 43, max: 97 },
  'M': { count: 54, min: 43, max: 96 },
  'L': { count: 53, min: 43, max: 95 },
  'K': { count: 52, min: 42, max: 93 },
  'J': { count: 51, min: 42, max: 92 },
  'I': { count: 50, min: 41, max: 90 },
  'H': { count: 49, min: 41, max: 89 },
  'G': { count: 48, min: 40, max: 87 },
  'F': { count: 47, min: 40, max: 86 },
  'E': { count: 46, min: 39, max: 84 },
  'D': { count: 45, min: 39, max: 83 },
  'C': { count: 44, min: 38, max: 81 },
  'B': { count: 43, min: 38, max: 80 },
  'A': { count: 42, min: 37, max: 78 }
};

const ROW_ORDER = ['O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
const EXPECTED_TOTAL = Object.values(EXCEL_ROWS).reduce((sum, r) => sum + r.count, 0);

async function main() {
  console.log('=== PREFERENTE CENTRAL: DB vs EXCEL ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-central-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total en DB: ${seats.length}`);
  console.log(`Total en Excel: ${EXPECTED_TOTAL}\n`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s.columnNumber);
  });
  
  console.log('FILA | DB  | EXCEL | DB_RANGE      | EXCEL_RANGE   | STATUS');
  console.log('-----|-----|-------|---------------|---------------|-------');
  
  let totalDB = 0;
  let totalExcel = 0;
  
  for (const row of ROW_ORDER) {
    const dbNums = (byRow[row] || []).sort((a, b) => a - b);
    const excel = EXCEL_ROWS[row];
    
    const dbCount = dbNums.length;
    const dbMin = dbNums.length > 0 ? dbNums[0] : '-';
    const dbMax = dbNums.length > 0 ? dbNums[dbNums.length - 1] : '-';
    
    const countMatch = dbCount === excel.count;
    const rangeMatch = dbMin === excel.min && dbMax === excel.max;
    const status = countMatch && rangeMatch ? '✅' : 
                   countMatch ? '⚠️ range' : 
                   `❌ ${excel.count - dbCount}`;
    
    console.log(`  ${row}  | ${String(dbCount).padStart(2)}  |  ${String(excel.count).padStart(2)}   | ${String(dbMin).padStart(2)}-${String(dbMax).padEnd(2)}          | ${excel.min}-${excel.max}          | ${status}`);
    
    totalDB += dbCount;
    totalExcel += excel.count;
  }
  
  console.log('-----|-----|-------|---------------|---------------|-------');
  console.log(`TOTAL| ${totalDB} | ${totalExcel}  |`);
  
  // Verificar posiciones Y
  console.log('\n=== VERIFICAR ORDEN DE FILAS ===');
  const rowYAvg = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowYAvg[s.rowLabel]) rowYAvg[s.rowLabel] = { sum: 0, count: 0 };
    rowYAvg[s.rowLabel].sum += y;
    rowYAvg[s.rowLabel].count++;
  });
  
  console.log('Fila | Y avg  | Esperado');
  for (const row of ROW_ORDER) {
    if (rowYAvg[row]) {
      const avgY = rowYAvg[row].sum / rowYAvg[row].count;
      const expected = row === 'O' ? 'ARRIBA (Y bajo)' : row === 'A' ? 'ABAJO (Y alto)' : '';
      console.log(`  ${row}  | ${avgY.toFixed(0).padStart(5)}  | ${expected}`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
