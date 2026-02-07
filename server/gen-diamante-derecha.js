// Script para añadir SOLO los 80 asientos DIAMANTE DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// DIAMANTE DERECHA: Filas A-D, asientos 31-50 (80 asientos)
// Sección 11: X(628-821) Y(877-1013)

const SECTION_NAME = 'DIAMANTE DERECHA';
const SECTION_ID = 'section-1770168306199';
const BOUNDS = { minX: 628, maxX: 821, minY: 877, maxY: 1013 };
const ROWS = ['A', 'B', 'C', 'D'];
const START_SEAT = 31;
const END_SEAT = 50;
const COLOR = '#D946EF';
const STROKE = '#a21caf';

async function main() {
  console.log('=== DIAMANTE DERECHA - 80 ASIENTOS ===\n');
  
  const before = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos antes: ${before}`);
  
  const seatsPerRow = END_SEAT - START_SEAT + 1;
  const rowHeight = (BOUNDS.maxY - BOUNDS.minY) / (ROWS.length + 1);
  const seatWidth = (BOUNDS.maxX - BOUNDS.minX) / (seatsPerRow + 1);
  
  const seats = [];
  
  ROWS.forEach((row, rowIdx) => {
    const y = BOUNDS.minY + rowHeight * (rowIdx + 1);
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = START_SEAT + seatIdx;
      const x = BOUNDS.minX + seatWidth * (seatIdx + 1);
      const label = `DD-${row}-${seatNum}`; // DD = Diamante Derecha
      
      seats.push({
        id: `diamante-derecha-${row.toLowerCase()}-${seatNum}`,
        venueId: VENUE_ID,
        layoutId: LAYOUT_ID,
        zoneId: null,
        rowLabel: row,
        columnNumber: seatNum,
        label: label,
        status: 'AVAILABLE',
        metadata: JSON.stringify({
          fill: COLOR,
          stroke: STROKE,
          sectionName: SECTION_NAME,
          displayLabel: label,
          canvas: {
            position: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 },
            size: { width: 7, height: 7 },
            label: label
          },
          sectionId: SECTION_ID
        })
      });
    }
  });
  
  console.log(`Generados: ${seats.length} asientos`);
  console.log(`Primer asiento: ${seats[0].id} (${seats[0].label})`);
  console.log(`Último asiento: ${seats[seats.length-1].id} (${seats[seats.length-1].label})`);
  
  console.log('\nInsertando...');
  const result = await prisma.seat.createMany({
    data: seats,
    skipDuplicates: true
  });
  console.log(`✅ Insertados: ${result.count}`);
  
  const after = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`\nAsientos después: ${after}`);
  console.log(`Diferencia: +${after - before}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e);
  prisma.$disconnect();
});
