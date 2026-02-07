// Corregir numeración: Solo invertir si está en dirección incorrecta
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function fixSection(prefix, sectionName) {
  console.log(`\n=== ${sectionName} ===`);
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  if (seats.length === 0) {
    console.log('No hay asientos');
    return;
  }
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({
      id: s.id,
      num: s.columnNumber,
      x: meta.canvas?.position?.x || 0,
      y: meta.canvas?.position?.y || 0,
      meta: meta
    });
  });
  
  // Verificar dirección actual con primera fila disponible
  const rows = Object.keys(byRow);
  const testRow = rows.includes('A') ? 'A' : rows.includes('1') ? '1' : rows[0];
  const testSeats = byRow[testRow].sort((a, b) => a.x - b.x);
  
  const leftNum = testSeats[0].num;
  const rightNum = testSeats[testSeats.length - 1].num;
  const currentDir = leftNum > rightNum ? 'DER→IZQ' : 'IZQ→DER';
  
  console.log(`Dirección actual: ${currentDir}`);
  
  if (currentDir === 'DER→IZQ') {
    console.log('✅ Ya está correcto, no se modifica');
    return;
  }
  
  console.log('Invirtiendo...');
  
  let updated = 0;
  for (const row of Object.keys(byRow)) {
    const rowSeats = byRow[row].sort((a, b) => a.x - b.x);
    const n = rowSeats.length;
    const xPositions = rowSeats.map(s => s.x);
    
    for (let i = 0; i < n; i++) {
      const seat = rowSeats[i];
      const newX = xPositions[n - 1 - i];
      
      seat.meta.canvas = seat.meta.canvas || {};
      seat.meta.canvas.position = { x: newX, y: seat.y };
      seat.meta.canvas.size = { width: 7, height: 7 };
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      updated++;
    }
  }
  
  console.log(`Invertidos: ${updated} asientos → DER→IZQ ✅`);
}

async function main() {
  console.log('=== CORRIGIENDO NUMERACIÓN (TODAS DER→IZQ) ===');
  
  // Todas las secciones
  const sections = [
    ['diamante-izquierda', 'DIAMANTE IZQUIERDA'],
    ['diamante-central', 'DIAMANTE CENTRAL'],
    ['diamante-derecha', 'DIAMANTE DERECHA'],
    ['vip-izquierda', 'VIP IZQUIERDA'],
    ['vip-central', 'VIP CENTRAL'],
    ['vip-derecha', 'VIP DERECHA'],
    ['plus-izquierda', 'PLUS IZQUIERDA'],
    ['plus-central', 'PLUS CENTRAL'],
    ['plus-derecha', 'PLUS DERECHA'],
    ['preferente-izquierda', 'PREFERENTE IZQUIERDA'],
    ['preferente-central', 'PREFERENTE CENTRAL'],
    ['preferente-derecha', 'PREFERENTE DERECHA']
  ];
  
  for (const [prefix, name] of sections) {
    await fixSection(prefix, name);
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
