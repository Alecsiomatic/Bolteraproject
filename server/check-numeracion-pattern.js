// Revisar patrón de numeración de todo el layout
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== PATRÓN DE NUMERACIÓN DEL LAYOUT ===\n');
  
  const sections = [
    'DIAMANTE IZQUIERDA', 'DIAMANTE CENTRAL', 'DIAMANTE DERECHA', 
    'VIP IZQUIERDA', 'VIP CENTRAL', 'VIP DERECHA',
    'PLUS IZQUIERDA', 'PLUS CENTRAL', 'PLUS DERECHA',
    'PREFERENTE IZQUIERDA', 'PREFERENTE CENTRAL', 'PREFERENTE DERECHA'
  ];
  
  for (const section of sections) {
    const prefix = section.toLowerCase().replace(/ /g, '-');
    const seats = await prisma.seat.findMany({
      where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' } },
      select: { rowLabel: true, columnNumber: true, metadata: true }
    });
    
    if (seats.length === 0) continue;
    
    // Tomar fila A como ejemplo
    const rowA = seats.filter(s => s.rowLabel === 'A');
    if (rowA.length === 0) continue;
    
    // Ordenar por X
    const sorted = rowA.map(s => {
      let meta = {};
      try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
      return { num: s.columnNumber, x: meta.canvas?.position?.x || 0 };
    }).sort((a, b) => a.x - b.x);
    
    const first3 = sorted.slice(0, 3).map(s => s.num).join(', ');
    const last3 = sorted.slice(-3).map(s => s.num).join(', ');
    const minX = sorted[0].x.toFixed(0);
    const maxX = sorted[sorted.length-1].x.toFixed(0);
    
    console.log(`${section} (Fila A, ${rowA.length} asientos):`);
    console.log(`  X menor (IZQ) X=${minX}: nums ${first3}`);
    console.log(`  X mayor (DER) X=${maxX}: nums ${last3}`);
    
    // Determinar dirección
    const leftNum = sorted[0].num;
    const rightNum = sorted[sorted.length-1].num;
    const dir = leftNum < rightNum ? 'IZQ→DER (1 izq, mayor der)' : 'DER→IZQ (mayor izq, 1 der)';
    console.log(`  Dirección: ${dir}`);
    console.log('');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
