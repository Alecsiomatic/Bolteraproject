// Comparar VIP CENTRAL: DB vs Excel EXACTO
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// VIP CENTRAL según Excel:
// Fila 8: 21 asientos, 26-46
// Fila 7: 20 asientos, 25-44
// Fila 6: 19 asientos, 25-43
// Fila 5: 18 asientos, 24-41
// Fila 4: 18 asientos, 25-42
// Fila 3: 17 asientos, 24-40
// Fila 2: 16 asientos, 24-39
// Fila 1: 15 asientos, 23-37

const EXCEL_VIP_CENTRAL = {
  '8': { count: 21, min: 26, max: 46 },
  '7': { count: 20, min: 25, max: 44 },
  '6': { count: 19, min: 25, max: 43 },
  '5': { count: 18, min: 24, max: 41 },
  '4': { count: 18, min: 25, max: 42 },
  '3': { count: 17, min: 24, max: 40 },
  '2': { count: 16, min: 24, max: 39 },
  '1': { count: 15, min: 23, max: 37 }
};

async function main() {
  console.log('=== VIP CENTRAL: DB vs EXCEL ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-central-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true }
  });
  
  console.log(`Total en DB: ${seats.length}`);
  console.log(`Total en Excel: 144\n`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s.columnNumber);
  });
  
  console.log('FILA | DB_COUNT | EXCEL_COUNT | DB_MIN | DB_MAX | EXCEL_RANGE | STATUS');
  console.log('-----|----------|-------------|--------|--------|-------------|-------');
  
  let totalDB = 0;
  let totalExcel = 0;
  const missing = [];
  
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const dbSeats = (byRow[rowStr] || []).sort((a,b) => a - b);
    const excel = EXCEL_VIP_CENTRAL[rowStr];
    
    const dbCount = dbSeats.length;
    const dbMin = dbSeats.length > 0 ? dbSeats[0] : '-';
    const dbMax = dbSeats.length > 0 ? dbSeats[dbSeats.length - 1] : '-';
    
    const status = dbCount === excel.count ? '✅' : `❌ (${excel.count - dbCount})`;
    
    console.log(`  ${row}  |    ${String(dbCount).padStart(2)}    |     ${String(excel.count).padStart(2)}      |   ${String(dbMin).padStart(2)}   |   ${String(dbMax).padStart(2)}   | ${excel.min}-${excel.max}`.padEnd(60) + `| ${status}`);
    
    totalDB += dbCount;
    totalExcel += excel.count;
    
    // Encontrar faltantes
    const dbSet = new Set(dbSeats);
    for (let n = excel.min; n <= excel.max; n++) {
      if (!dbSet.has(n)) {
        missing.push({ row: rowStr, num: n });
      }
    }
    
    if (dbCount !== excel.count) {
      console.log(`      DB asientos: ${dbSeats.join(', ')}`);
    }
  }
  
  console.log('-----|----------|-------------|--------|--------|-------------|-------');
  console.log(`TOTAL|   ${totalDB}    |    ${totalExcel}      |`);
  
  if (missing.length > 0) {
    console.log(`\n=== ASIENTOS FALTANTES: ${missing.length} ===`);
    missing.forEach(m => console.log(`  ${m.row}-${m.num}`));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
