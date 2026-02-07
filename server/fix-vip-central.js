// Agregar los 8 asientos faltantes a VIP CENTRAL
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const SECTION_ID = 'section-1769727657187';
const SECTION_NAME = 'VIP CENTRAL';

// Asientos faltantes (falta el último de cada fila):
const MISSING_SEATS = [
  { row: '1', num: 37 },
  { row: '2', num: 39 },
  { row: '3', num: 40 },
  { row: '4', num: 42 },
  { row: '5', num: 41 },
  { row: '6', num: 43 },
  { row: '7', num: 44 },
  { row: '8', num: 46 }
];

async function main() {
  console.log('=== AGREGAR ASIENTOS FALTANTES A VIP CENTRAL ===\n');
  
  const newSeats = MISSING_SEATS.map(({ row, num }) => {
    const label = `${row}-${num}`;
    return {
      id: `vip-central-${row}-${num}`,
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
          position: { x: 550, y: 850 - (parseInt(row) - 1) * 12 },
          size: { width: 7, height: 7 },
          label: label
        },
        sectionId: SECTION_ID
      })
    };
  });
  
  console.log('Asientos a insertar:');
  newSeats.forEach(s => console.log(`  ${s.label}`));
  
  const result = await prisma.seat.createMany({
    data: newSeats,
    skipDuplicates: true
  });
  
  console.log(`\n✅ Insertados: ${result.count} asientos`);
  
  // Verificar total
  const finalCount = await prisma.seat.count({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-central-' } }
  });
  
  console.log(`\nTotal VIP CENTRAL: ${finalCount} (Excel: 144)`);
  
  if (finalCount === 144) {
    console.log('✅ VIP CENTRAL COMPLETA!');
  } else {
    console.log(`❌ Faltan ${144 - finalCount} asientos`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
