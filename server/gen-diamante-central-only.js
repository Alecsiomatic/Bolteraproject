// Script para añadir SOLO los 40 asientos DIAMANTE CENTRAL
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// DIAMANTE CENTRAL: Filas A-D, asientos 21-30 (40 asientos)
// Sección 10: X(844-995) Y(853-907)

const SECTION_NAME = 'DIAMANTE CENTRAL';
const SECTION_ID = 'section-1770168244197';
const BOUNDS = { minX: 844, maxX: 995, minY: 853, maxY: 907 };
const ROWS = ['A', 'B', 'C', 'D'];
const START_SEAT = 21;
const END_SEAT = 30;
const COLOR = '#D946EF';
const STROKE = '#a21caf';

async function main() {
  console.log('=== DIAMANTE CENTRAL - 40 ASIENTOS ===\n');
  
  // 1. Contar actuales
  const before = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`Asientos antes: ${before}`);
  
  // 2. Generar asientos
  const seatsPerRow = END_SEAT - START_SEAT + 1;
  const rowHeight = (BOUNDS.maxY - BOUNDS.minY) / (ROWS.length + 1);
  const seatWidth = (BOUNDS.maxX - BOUNDS.minX) / (seatsPerRow + 1);
  
  const seats = [];
  
  ROWS.forEach((row, rowIdx) => {
    const y = BOUNDS.minY + rowHeight * (rowIdx + 1);
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      const seatNum = START_SEAT + seatIdx;
      const x = BOUNDS.minX + seatWidth * (seatIdx + 1);
      const label = `DC-${row}-${seatNum}`; // DC = Diamante Central
      
      seats.push({
        id: `diamante-central-${row.toLowerCase()}-${seatNum}`,
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
  
  // 3. Verificar si hay labels duplicados
  const existingLabels = await prisma.seat.findMany({
    where: {
      layoutId: LAYOUT_ID,
      label: { in: seats.map(s => s.label) }
    },
    select: { id: true, label: true }
  });
  
  if (existingLabels.length > 0) {
    console.log(`\n⚠️  Labels ya existentes: ${existingLabels.length}`);
    existingLabels.forEach(s => console.log(`  - ${s.label} (${s.id})`));
    console.log('\nEliminando conflictos del array...');
    const existingLabelSet = new Set(existingLabels.map(s => s.label));
    const filteredSeats = seats.filter(s => !existingLabelSet.has(s.label));
    console.log(`Asientos a insertar después de filtrar: ${filteredSeats.length}`);
    
    if (filteredSeats.length === 0) {
      console.log('\n❌ Todos los asientos ya existen con ese label.');
      await prisma.$disconnect();
      return;
    }
  }
  
  // 4. Insertar
  console.log('\nInsertando...');
  try {
    const result = await prisma.seat.createMany({
      data: seats,
      skipDuplicates: true
    });
    console.log(`✅ Insertados: ${result.count}`);
  } catch (error) {
    console.log('Error en createMany:', error.message);
    
    // Intentar uno por uno para ver cuál falla
    console.log('\nIntentando inserción individual...');
    let inserted = 0;
    for (const seat of seats) {
      try {
        await prisma.seat.create({ data: seat });
        inserted++;
      } catch (e) {
        console.log(`  Error en ${seat.id}: ${e.message.split('\n')[0]}`);
      }
    }
    console.log(`Insertados individualmente: ${inserted}`);
  }
  
  // 5. Verificar
  const after = await prisma.seat.count({ where: { venueId: VENUE_ID } });
  console.log(`\nAsientos después: ${after}`);
  console.log(`Diferencia: +${after - before}`);
  
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('ERROR:', e);
  prisma.$disconnect();
});
