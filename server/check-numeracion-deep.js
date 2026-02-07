// Análisis profundo de numeración de todo el layout
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== ANÁLISIS PROFUNDO DE NUMERACIÓN ===\n');
  
  const sections = [
    'diamante-izquierda', 'diamante-central', 'diamante-derecha', 
    'vip-izquierda', 'vip-central', 'vip-derecha',
    'plus-izquierda', 'plus-central', 'plus-derecha',
    'preferente-izquierda', 'preferente-central', 'preferente-derecha'
  ];
  
  for (const prefix of sections) {
    const seats = await prisma.seat.findMany({
      where: { venueId: VENUE_ID, id: { startsWith: prefix + '-' } },
      select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
    });
    
    if (seats.length === 0) continue;
    
    // Agrupar por fila
    const byRow = {};
    seats.forEach(s => {
      let meta = {};
      try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
      const x = meta.canvas?.position?.x || 0;
      const y = meta.canvas?.position?.y || 0;
      if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
      byRow[s.rowLabel].push({ num: s.columnNumber, x, y });
    });
    
    const sectionName = prefix.toUpperCase().replace(/-/g, ' ');
    console.log(`\n${'='.repeat(50)}`);
    console.log(`${sectionName} (${seats.length} asientos)`);
    console.log('='.repeat(50));
    
    // Analizar cada fila
    const rows = Object.keys(byRow).sort((a, b) => {
      // Ordenar P, O, N... B, A
      return b.charCodeAt(0) - a.charCodeAt(0);
    });
    
    let consistentDirection = null;
    let inconsistencies = [];
    
    for (const row of rows) {
      const rowSeats = byRow[row].sort((a, b) => a.x - b.x);
      const yAvg = rowSeats.reduce((s, seat) => s + seat.y, 0) / rowSeats.length;
      
      const leftNum = rowSeats[0].num;
      const rightNum = rowSeats[rowSeats.length - 1].num;
      const leftX = rowSeats[0].x.toFixed(0);
      const rightX = rowSeats[rowSeats.length - 1].x.toFixed(0);
      
      const direction = leftNum > rightNum ? 'DER→IZQ' : 'IZQ→DER';
      
      if (consistentDirection === null) {
        consistentDirection = direction;
      } else if (direction !== consistentDirection) {
        inconsistencies.push(row);
      }
      
      // Mostrar primeras 5 y últimas 5 numeraciones
      const allNums = rowSeats.map(s => s.num);
      const first5 = allNums.slice(0, 5).join(',');
      const last5 = allNums.slice(-5).join(',');
      
      console.log(`Fila ${row} (${rowSeats.length} seats, Y=${yAvg.toFixed(0)}): X[${leftX}→${rightX}] Nums[${first5}...${last5}] → ${direction}`);
    }
    
    if (inconsistencies.length > 0) {
      console.log(`\n⚠️ INCONSISTENCIAS en filas: ${inconsistencies.join(', ')}`);
    } else {
      console.log(`\n✅ Dirección consistente: ${consistentDirection}`);
    }
    
    // Verificar orden de filas (Y)
    const rowYs = rows.map(r => {
      const yAvg = byRow[r].reduce((s, seat) => s + seat.y, 0) / byRow[r].length;
      return { row: r, y: yAvg };
    }).sort((a, b) => a.y - b.y);
    
    console.log(`\nOrden Y (arriba→abajo): ${rowYs.map(r => r.row).join(' → ')}`);
    
    // Verificar si P está arriba y A abajo
    const pPos = rowYs.findIndex(r => r.row === 'P');
    const aPos = rowYs.findIndex(r => r.row === 'A');
    if (pPos !== -1 && aPos !== -1) {
      if (pPos < aPos) {
        console.log('✅ P arriba, A abajo (correcto)');
      } else {
        console.log('❌ A arriba, P abajo (INVERTIDO)');
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
