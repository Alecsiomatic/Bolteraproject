// Agregar los 8 asientos faltantes a VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const SECTION_ID = 'section-1769727657188';
const SECTION_NAME = 'VIP DERECHA';

// Asientos faltantes según comparación DB vs Excel:
// Fila 1: falta 38 (Excel: 38-59, DB tiene 39-59)
// Fila 2: falta 40 (Excel: 40-61, DB tiene 41-61)
// Fila 3: falta 41 (Excel: 41-62, DB tiene 42-62)
// Fila 4: falta 43 (Excel: 43-65, DB tiene 44-65)
// Fila 5: falta 42 (Excel: 42-63, DB tiene 43-63)
// Fila 6: falta 44 (Excel: 44-66, DB tiene 45-66)
// Fila 7: falta 45 (Excel: 45-68, DB tiene 46-68)
// Fila 8: falta 47 (Excel: 47-70 = 24 asientos, DB tiene 48-70)

const MISSING_SEATS = [
  { row: '1', num: 38 },
  { row: '2', num: 40 },
  { row: '3', num: 41 },
  { row: '4', num: 43 },
  { row: '5', num: 42 },
  { row: '6', num: 44 },
  { row: '7', num: 45 },
  { row: '8', num: 47 }
];

async function main() {
  console.log('=== AGREGAR ASIENTOS FALTANTES A VIP DERECHA ===\n');
  
  // Obtener asiento de referencia para posiciones
  const refSeat = await prisma.seat.findFirst({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-1-' } },
    select: { metadata: true }
  });
  
  let refMeta = {};
  try { refMeta = JSON.parse(refSeat?.metadata || '{}'); } catch(e) {}
  
  const newSeats = MISSING_SEATS.map(({ row, num }) => {
    const label = `${row}-${num}`;
    return {
      id: `vip-derecha-${row}-${num}`,
      venueId: VENUE_ID,
      layoutId: LAYOUT_ID,
      zoneId: null,
      rowLabel: row,
      columnNumber: num,
      label: label,
      status: 'AVAILABLE',
      metadata: JSON.stringify({
        fill: '#0EA5E9',
        stroke: '#0284c7',
        sectionName: SECTION_NAME,
        displayLabel: label,
        canvas: {
          position: { x: 700, y: 850 - (parseInt(row) - 1) * 12 },
          size: { width: 7, height: 7 },
          label: label
        },
        sectionId: SECTION_ID
      })
    };
  });
  
  console.log('Asientos a insertar:');
  newSeats.forEach(s => console.log(`  ${s.label}`));
  
  // Verificar que no existan
  const existing = await prisma.seat.findMany({
    where: { 
      venueId: VENUE_ID,
      id: { in: newSeats.map(s => s.id) }
    }
  });
  
  if (existing.length > 0) {
    console.log(`\n⚠️ Ya existen ${existing.length} asientos:`);
    existing.forEach(s => console.log(`  ${s.id}`));
  }
  
  // Insertar
  const result = await prisma.seat.createMany({
    data: newSeats,
    skipDuplicates: true
  });
  
  console.log(`\n✅ Insertados: ${result.count} asientos`);
  
  // Verificar total
  const finalCount = await prisma.seat.count({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } }
  });
  
  console.log(`\nTotal VIP DERECHA: ${finalCount} (Excel: 182)`);
  
  if (finalCount === 182) {
    console.log('✅ VIP DERECHA COMPLETA!');
  } else {
    console.log(`❌ Faltan ${182 - finalCount} asientos`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
