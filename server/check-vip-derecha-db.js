// Comparar VIP DERECHA: DB vs Excel EXACTO
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// VIP DERECHA según Excel:
// Fila 8: 24 asientos, 41-70 (pero son 24, así que hay gaps: 41-64? o algunos omitidos)
// Fila 7: 24 asientos, 45-68
// Fila 6: 23 asientos, 44-66
// Fila 5: 22 asientos, 42-63
// Fila 4: 23 asientos, 43-65
// Fila 3: 22 asientos, 41-62
// Fila 2: 22 asientos, 40-61
// Fila 1: 22 asientos, 38-59

const EXCEL_VIP_DERECHA = {
  '8': { count: 24, range: '41 a 70' },
  '7': { count: 24, range: '45 a 68' },
  '6': { count: 23, range: '44 a 66' },
  '5': { count: 22, range: '42 a 63' },
  '4': { count: 23, range: '43 a 65' },
  '3': { count: 22, range: '41 a 62' },
  '2': { count: 22, range: '40 a 61' },
  '1': { count: 22, range: '38 a 59' }
};

async function main() {
  console.log('=== VIP DERECHA: DB vs EXCEL ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true }
  });
  
  console.log(`Total en DB: ${seats.length}`);
  console.log(`Total en Excel: 182\n`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s.columnNumber);
  });
  
  // Ordenar y comparar
  console.log('FILA | DB_COUNT | EXCEL_COUNT | DB_MIN | DB_MAX | EXCEL_RANGE | STATUS');
  console.log('-----|----------|-------------|--------|--------|-------------|-------');
  
  let totalDB = 0;
  let totalExcel = 0;
  
  // Mostrar de fila 1 a 8 (1 abajo, 8 arriba)
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const dbSeats = (byRow[rowStr] || []).sort((a,b) => a - b);
    const excel = EXCEL_VIP_DERECHA[rowStr];
    
    const dbCount = dbSeats.length;
    const dbMin = dbSeats.length > 0 ? dbSeats[0] : '-';
    const dbMax = dbSeats.length > 0 ? dbSeats[dbSeats.length - 1] : '-';
    
    const status = dbCount === excel.count ? '✅' : `❌ (${excel.count - dbCount})`;
    
    console.log(`  ${row}  |    ${String(dbCount).padStart(2)}    |     ${String(excel.count).padStart(2)}      |   ${String(dbMin).padStart(2)}   |   ${String(dbMax).padStart(2)}   | ${excel.range.padEnd(11)} | ${status}`);
    
    totalDB += dbCount;
    totalExcel += excel.count;
    
    // Mostrar asientos específicos si hay diferencia
    if (dbCount !== excel.count) {
      console.log(`      DB asientos: ${dbSeats.join(', ')}`);
    }
  }
  
  console.log('-----|----------|-------------|--------|--------|-------------|-------');
  console.log(`TOTAL|   ${totalDB}    |    ${totalExcel}      |`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
