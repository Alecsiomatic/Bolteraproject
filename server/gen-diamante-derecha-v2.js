// Script para DIAMANTE DERECHA con inclinación correcta
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// DIAMANTE DERECHA: Filas A-D, asientos 31-50 (80 asientos)
const SECTION_NAME = 'DIAMANTE DERECHA';
const SECTION_ID = 'section-1770168306199';
const ROWS = ['A', 'B', 'C', 'D'];
const START_SEAT = 31;
const END_SEAT = 50;
const COLOR = '#D946EF';
const STROKE = '#a21caf';

// Polígono points:
// 0: (627.83, 978.64) - esquina inferior izquierda
// 1: (806.30, 876.73) - esquina superior derecha  
// 2: (820.87, 920.40) - esquina inferior derecha
// 3: (655.14, 1013.22) - esquina inferior izquierda abajo

// El polígono tiene forma de paralelogramo inclinado
// Usaremos los puntos para distribuir los asientos

const POLYGON = [
  { x: 627.83, y: 978.64 },
  { x: 806.30, y: 876.73 },
  { x: 820.87, y: 920.40 },
  { x: 655.14, y: 1013.22 }
];

async function main() {
  console.log('=== DIAMANTE DERECHA - 80 ASIENTOS (con inclinación) ===\n');
  
  // Primero borrar los asientos anteriores mal posicionados
  const deleted = await prisma.seat.deleteMany({
    where: {
      venueId: VENUE_ID,
      id: { startsWith: 'diamante-derecha-' }
    }
  });
  console.log(`Asientos anteriores borrados: ${deleted.count}`);
  
  const before = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos actuales: ${before}`);
  
  // Calcular vectores del polígono
  // Borde superior: de punto 0 a punto 1
  // Borde izquierdo: de punto 0 a punto 3
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
    // t va de 0 a 1 a lo largo del eje vertical
    const tRow = (rowIdx + 0.5) / numRows;
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = START_SEAT + seatIdx;
      // s va de 0 a 1 a lo largo del eje horizontal
      const sSeat = (seatIdx + 0.5) / seatsPerRow;
      
      // Posición = origen + s*hVec + t*vVec
      const x = topLeft.x + sSeat * hVec.x + tRow * vVec.x;
      const y = topLeft.y + sSeat * hVec.y + tRow * vVec.y;
      
      const label = `DD-${row}-${seatNum}`;
      
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
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e);
  prisma.$disconnect();
});
