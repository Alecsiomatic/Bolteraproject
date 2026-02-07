// Script para añadir los 200 asientos DIAMANTE
// AÑADE a los existentes, no reemplaza

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// Datos DIAMANTE según Excel:
// DIAMANTE IZQUIERDA: Filas A-D, asientos 1-20 (80 asientos)
// DIAMANTE CENTRAL: Filas A-D, asientos 21-30 (40 asientos)
// DIAMANTE DERECHA: Filas A-D, asientos 31-50 (80 asientos)

// Coordenadas de las secciones (del layout):
// Sección 10 (DIAMANTE CENTRAL): X(844-995) Y(853-907)
// Sección 11 (DIAMANTE DERECHA): X(628-821) Y(877-1013) 
// Sección 12 (DIAMANTE IZQUIERDA): X(1028-1223) Y(879-1010)

const SECTIONS = {
  'DIAMANTE CENTRAL': {
    id: 'section-1770168244197',
    bounds: { minX: 844, maxX: 995, minY: 853, maxY: 907 },
    rows: ['A', 'B', 'C', 'D'],
    startSeat: 21,
    endSeat: 30,
    color: '#D946EF',
    strokeColor: '#a21caf'
  },
  'DIAMANTE DERECHA': {
    id: 'section-1770168306199',
    bounds: { minX: 628, maxX: 821, minY: 877, maxY: 1013 },
    rows: ['A', 'B', 'C', 'D'],
    startSeat: 31,
    endSeat: 50,
    color: '#D946EF',
    strokeColor: '#a21caf'
  },
  'DIAMANTE IZQUIERDA': {
    id: 'section-1770168352717',
    bounds: { minX: 1028, maxX: 1223, minY: 879, maxY: 1010 },
    rows: ['A', 'B', 'C', 'D'],
    startSeat: 1,
    endSeat: 20,
    color: '#D946EF',
    strokeColor: '#a21caf'
  }
};

function generateSeatsForSection(sectionName, config) {
  const seats = [];
  const { bounds, rows, startSeat, endSeat, color, strokeColor, id: sectionId } = config;
  
  const seatsPerRow = endSeat - startSeat + 1;
  const rowHeight = (bounds.maxY - bounds.minY) / (rows.length + 1);
  const seatWidth = (bounds.maxX - bounds.minX) / (seatsPerRow + 1);
  
  rows.forEach((row, rowIdx) => {
    const y = bounds.minY + rowHeight * (rowIdx + 1);
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = startSeat + seatIdx;
      const x = bounds.minX + seatWidth * (seatIdx + 1);
      
      const seatId = `${sectionName.toLowerCase().replace(/ /g, '-')}-${row}-${seatNum}`;
      const label = `${row}-${seatNum}`;
      
      seats.push({
        id: seatId,
        venueId: VENUE_ID,
        layoutId: LAYOUT_ID,
        zoneId: null,
        rowLabel: row,
        columnNumber: seatNum,
        label: label,
        status: 'AVAILABLE',
        metadata: JSON.stringify({
          fill: color,
          stroke: strokeColor,
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
  console.log('=== GENERADOR DE ASIENTOS DIAMANTE ===\n');
  
  // 1. Contar asientos actuales
  const currentCount = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos actuales: ${currentCount}`);
  
  // 2. Generar asientos para cada sección
  const allNewSeats = [];
  
  for (const [name, config] of Object.entries(SECTIONS)) {
    const seats = generateSeatsForSection(name, config);
    console.log(`${name}: ${seats.length} asientos generados`);
    allNewSeats.push(...seats);
  }
  
  console.log(`\nTotal nuevos asientos: ${allNewSeats.length}`);
  
  // 3. Verificar que no existan ya
  const existingIds = await prisma.seat.findMany({
    where: { 
      venueId: VENUE_ID,
      id: { in: allNewSeats.map(s => s.id) }
    },
    select: { id: true }
  });
  
  if (existingIds.length > 0) {
    console.log(`\n⚠️  ${existingIds.length} asientos ya existen, serán ignorados`);
  }
  
  // 4. Insertar nuevos asientos
  console.log('\nInsertando asientos...');
  const result = await prisma.seat.createMany({
    data: allNewSeats,
    skipDuplicates: true
  });
  
  console.log(`✅ Insertados: ${result.count} asientos`);
  
  // 5. Verificar total final
  const finalCount = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`\nTotal final: ${finalCount} asientos`);
  console.log(`Diferencia: +${finalCount - currentCount}`);
  
  // 6. Mostrar resumen por sección
  console.log('\n=== RESUMEN POR SECCIÓN ===');
  for (const name of Object.keys(SECTIONS)) {
    const count = await prisma.seat.count({
      where: {
        venueId: VENUE_ID,
        metadata: { contains: name }
      }
    });
    console.log(`${name}: ${count}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e.message);
  prisma.$disconnect();
  process.exit(1);
});
