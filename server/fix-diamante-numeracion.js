// Corregir numeración de las 3 secciones DIAMANTE
// A-1 debe estar abajo a la derecha
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const COLOR = '#D946EF';
const STROKE = '#a21caf';

// Filas de abajo hacia arriba: A es la de abajo, D es la de arriba
const ROWS = ['A', 'B', 'C', 'D'];

const SECTIONS = {
  'DIAMANTE CENTRAL': {
    id: 'section-1770168244197',
    prefix: 'DC',
    idPrefix: 'diamante-central',
    startSeat: 21,
    endSeat: 30,
    // Polígono: X(844-995) Y(853-907) - es recto horizontal
    polygon: [
      { x: 844, y: 853 },   // top-left
      { x: 995, y: 853 },   // top-right
      { x: 995, y: 907 },   // bottom-right
      { x: 844, y: 907 }    // bottom-left
    ]
  },
  'DIAMANTE DERECHA': {
    id: 'section-1770168306199',
    prefix: 'DD',
    idPrefix: 'diamante-derecha',
    startSeat: 31,
    endSeat: 50,
    // Inclinado hacia arriba-derecha
    polygon: [
      { x: 627.83, y: 978.64 },  // 0: top-left
      { x: 806.30, y: 876.73 },  // 1: top-right
      { x: 820.87, y: 920.40 },  // 2: bottom-right
      { x: 655.14, y: 1013.22 }  // 3: bottom-left
    ]
  },
  'DIAMANTE IZQUIERDA': {
    id: 'section-1770168352717',
    prefix: 'DI',
    idPrefix: 'diamante-izquierda',
    startSeat: 1,
    endSeat: 20,
    // Inclinado hacia arriba-izquierda
    polygon: [
      { x: 1041.23, y: 878.55 },  // 0: top-left
      { x: 1223.34, y: 978.64 },  // 1: top-right
      { x: 1192.38, y: 1009.58 }, // 2: bottom-right
      { x: 1028.48, y: 927.68 }   // 3: bottom-left
    ]
  }
};

function generateSeats(sectionName, config) {
  const { polygon, prefix, idPrefix, startSeat, endSeat, id: sectionId } = config;
  
  // Para que A esté abajo y los números empiecen a la derecha:
  // - bottomRight es donde empieza A-startSeat
  // - topLeft es donde termina D-endSeat
  
  const topLeft = polygon[0];
  const topRight = polygon[1];
  const bottomRight = polygon[2];
  const bottomLeft = polygon[3];
  
  // Vector del borde inferior (de bottomLeft a bottomRight) - para asientos
  const bottomVec = { x: bottomRight.x - bottomLeft.x, y: bottomRight.y - bottomLeft.y };
  // Vector del borde derecho (de bottomRight a topRight) - para filas
  const rightVec = { x: topRight.x - bottomRight.x, y: topRight.y - bottomRight.y };
  
  const seatsPerRow = endSeat - startSeat + 1;
  const numRows = ROWS.length;
  
  const seats = [];
  
  // Fila A está abajo (rowIdx=0), Fila D está arriba (rowIdx=3)
  ROWS.forEach((row, rowIdx) => {
    // t=0 es abajo (fila A), t=1 es arriba (fila D)
    const tRow = (rowIdx + 0.5) / numRows;
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = startSeat + seatIdx;
      // s=0 es la derecha (asiento menor), s=1 es la izquierda (asiento mayor)
      // Invertimos para que empiece por la derecha
      const sSeat = 1 - (seatIdx + 0.5) / seatsPerRow;
      
      // Posición = bottomLeft + s*bottomVec + t*rightVec
      const x = bottomLeft.x + sSeat * bottomVec.x + tRow * rightVec.x;
      const y = bottomLeft.y + sSeat * bottomVec.y + tRow * rightVec.y;
      
      const label = `${prefix}-${row}-${seatNum}`;
      
      seats.push({
        id: `${idPrefix}-${row.toLowerCase()}-${seatNum}`,
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
          sectionName: sectionName,
          displayLabel: label,
          canvas: {
            position: { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 },
            size: { width: 7, height: 7 },
            label: label
          },
          sectionId: sectionId
        })
      });
    }
  });
  
  return seats;
}

async function main() {
  console.log('=== CORREGIR NUMERACIÓN DIAMANTE ===\n');
  console.log('A-1 debe estar abajo a la derecha\n');
  
  // Borrar todos los asientos DIAMANTE existentes
  const deleted = await prisma.seat.deleteMany({
    where: {
      venueId: VENUE_ID,
      OR: [
        { id: { startsWith: 'diamante-central-' } },
        { id: { startsWith: 'diamante-derecha-' } },
        { id: { startsWith: 'diamante-izquierda-' } }
      ]
    }
  });
  console.log(`Asientos DIAMANTE borrados: ${deleted.count}`);
  
  const before = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos actuales: ${before}\n`);
  
  // Generar asientos para cada sección
  const allSeats = [];
  for (const [name, config] of Object.entries(SECTIONS)) {
    const seats = generateSeats(name, config);
    console.log(`${name}: ${seats.length} asientos`);
    console.log(`  Primer asiento: ${seats[0].label}`);
    console.log(`  Último asiento: ${seats[seats.length-1].label}`);
    allSeats.push(...seats);
  }
  
  console.log(`\nTotal a insertar: ${allSeats.length}`);
  
  // Insertar
  const result = await prisma.seat.createMany({
    data: allSeats,
    skipDuplicates: true
  });
  console.log(`✅ Insertados: ${result.count}`);
  
  const after = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`\nAsientos finales: ${after}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e);
  prisma.$disconnect();
});
