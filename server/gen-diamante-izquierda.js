// Script para DIAMANTE IZQUIERDA con inclinación correcta
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// DIAMANTE IZQUIERDA: Filas A-D, asientos 1-20 (80 asientos)
const SECTION_NAME = 'DIAMANTE IZQUIERDA';
const SECTION_ID = 'section-1770168352717';
const ROWS = ['A', 'B', 'C', 'D'];
const START_SEAT = 1;
const END_SEAT = 20;
const COLOR = '#D946EF';
const STROKE = '#a21caf';

// Polígono points:
// 0: (1041.23, 878.55) - esquina superior izquierda
// 1: (1223.34, 978.64) - esquina superior derecha
// 2: (1192.38, 1009.58) - esquina inferior derecha
// 3: (1028.48, 927.68) - esquina inferior izquierda

const POLYGON = [
  { x: 1041.23, y: 878.55 },
  { x: 1223.34, y: 978.64 },
  { x: 1192.38, y: 1009.58 },
  { x: 1028.48, y: 927.68 }
];

async function main() {
  console.log('=== DIAMANTE IZQUIERDA - 80 ASIENTOS (con inclinación) ===\n');
  
  const before = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos actuales: ${before}`);
  
  // Calcular vectores del polígono
  const topLeft = POLYGON[0];
  const topRight = POLYGON[1];
  const bottomLeft = POLYGON[3];
  
  // Vector horizontal (a lo largo del borde superior)
  const hVec = { x: topRight.x - topLeft.x, y: topRight.y - topLeft.y };
  // Vector vertical (a lo largo del borde izquierdo)
  const vVec = { x: bottomLeft.x - topLeft.x, y: bottomLeft.y - topLeft.y };
  
  const seatsPerRow = END_SEAT - START_SEAT + 1; // 20
  const numRows = ROWS.length; // 4
  
  const seats = [];
  
  ROWS.forEach((row, rowIdx) => {
    const tRow = (rowIdx + 0.5) / numRows;
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = START_SEAT + seatIdx;
      const sSeat = (seatIdx + 0.5) / seatsPerRow;
      
      // Posición = origen + s*hVec + t*vVec
      const x = topLeft.x + sSeat * hVec.x + tRow * vVec.x;
      const y = topLeft.y + sSeat * hVec.y + tRow * vVec.y;
      
      const label = `DI-${row}-${seatNum}`; // DI = Diamante Izquierda
      
      seats.push({
        id: `diamante-izquierda-${row.toLowerCase()}-${seatNum}`,
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
  console.log(`Primer asiento: ${seats[0].label} en (${JSON.parse(seats[0].metadata).canvas.position.x}, ${JSON.parse(seats[0].metadata).canvas.position.y})`);
  console.log(`Último asiento: ${seats[seats.length-1].label}`);
  
  console.log('\nInsertando...');
  const result = await prisma.seat.createMany({
    data: seats,
    skipDuplicates: true
  });
  console.log(`✅ Insertados: ${result.count}`);
  
  const after = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`\nAsientos después: ${after}`);
  console.log(`Total DIAMANTE: ${after - 3853} (esperado: 200)`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e);
  prisma.$disconnect();
});
