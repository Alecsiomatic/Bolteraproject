// Fix PREFERENTE DERECHA - Swap filas + Invertir X
// P arriba (cerca escenario), A abajo (lejos escenario)
// Numeración: DERECHA A IZQ (número menor a la derecha, X mayor)
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Excel PREFERENTE DERECHA
const EXCEL = {
  'P': { count: 43, min: 101, max: 143 },
  'O': { count: 42, min: 100, max: 141 },
  'N': { count: 42, min: 98, max: 139 },
  'M': { count: 42, min: 97, max: 138 },
  'L': { count: 41, min: 96, max: 136 },
  'K': { count: 41, min: 94, max: 134 },
  'J': { count: 40, min: 93, max: 132 },
  'I': { count: 40, min: 91, max: 130 },
  'H': { count: 39, min: 90, max: 128 },
  'G': { count: 39, min: 88, max: 126 },
  'F': { count: 38, min: 87, max: 124 },
  'E': { count: 38, min: 85, max: 122 },
  'D': { count: 37, min: 84, max: 120 },
  'C': { count: 37, min: 82, max: 118 },
  'B': { count: 36, min: 81, max: 116 },
  'A': { count: 36, min: 79, max: 114 }
};

const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

const swapPairs = [
  ['P', 'A'], ['O', 'B'], ['N', 'C'], ['M', 'D'],
  ['L', 'E'], ['K', 'F'], ['J', 'G'], ['I', 'H']
];

async function main() {
  console.log('=== FIX PREFERENTE DERECHA ===\n');
  
  // 1. Leer backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('preferente-derecha-'));
  console.log(`Asientos en backup: ${backupSeats.length}`);
  
  const backupMap = {};
  backupSeats.forEach(s => {
    backupMap[s.id] = s.metadata;
  });
  
  // 2. Swap filas
  console.log('\n=== SWAP DE FILAS ===');
  let swapped = 0;
  
  for (const [row1, row2] of swapPairs) {
    const data1 = EXCEL[row1];
    const data2 = EXCEL[row2];
    
    // row1 toma posiciones de row2
    for (let i = 0; i < data1.count; i++) {
      const seatNum1 = data1.min + i;
      const id1 = `preferente-derecha-${row1}-${seatNum1}`;
      
      const ratio = i / (data1.count - 1);
      const idx2 = Math.round(ratio * (data2.count - 1));
      const seatNum2 = data2.min + idx2;
      const id2 = `preferente-derecha-${row2}-${seatNum2}`;
      
      const backupMeta2 = backupMap[id2];
      if (backupMeta2 && backupMeta2.canvas?.position) {
        const seat1 = await prisma.seat.findUnique({ where: { id: id1 } });
        if (seat1) {
          let meta = {};
          try { meta = JSON.parse(seat1.metadata || '{}'); } catch(e) {}
          meta.canvas = meta.canvas || {};
          meta.canvas.position = { ...backupMeta2.canvas.position };
          meta.canvas.size = backupMeta2.canvas.size || { width: 7, height: 7 };
          await prisma.seat.update({
            where: { id: id1 },
            data: { metadata: JSON.stringify(meta) }
          });
          swapped++;
        }
      }
    }
    
    // row2 toma posiciones de row1
    for (let i = 0; i < data2.count; i++) {
      const seatNum2 = data2.min + i;
      const id2 = `preferente-derecha-${row2}-${seatNum2}`;
      
      const ratio = i / (data2.count - 1);
      const idx1 = Math.round(ratio * (data1.count - 1));
      const seatNum1 = data1.min + idx1;
      const id1 = `preferente-derecha-${row1}-${seatNum1}`;
      
      const backupMeta1 = backupMap[id1];
      if (backupMeta1 && backupMeta1.canvas?.position) {
        const seat2 = await prisma.seat.findUnique({ where: { id: id2 } });
        if (seat2) {
          let meta = {};
          try { meta = JSON.parse(seat2.metadata || '{}'); } catch(e) {}
          meta.canvas = meta.canvas || {};
          meta.canvas.position = { ...backupMeta1.canvas.position };
          meta.canvas.size = backupMeta1.canvas.size || { width: 7, height: 7 };
          await prisma.seat.update({
            where: { id: id2 },
            data: { metadata: JSON.stringify(meta) }
          });
          swapped++;
        }
      }
    }
    
    console.log(`Swap ${row1}(${data1.count}) ↔ ${row2}(${data2.count})`);
  }
  
  console.log(`Swapped: ${swapped}`);
  
  // 3. Invertir X en cada fila
  console.log('\n=== INVERTIR X EN CADA FILA ===');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    byRow[s.rowLabel].push({
      id: s.id,
      columnNumber: s.columnNumber,
      x: meta.canvas?.position?.x || 0,
      y: meta.canvas?.position?.y || 0,
      meta
    });
  });
  
  let inverted = 0;
  
  for (const row of ROW_ORDER) {
    const rowSeats = byRow[row];
    if (!rowSeats || rowSeats.length === 0) continue;
    
    rowSeats.sort((a, b) => a.columnNumber - b.columnNumber);
    const xPositions = rowSeats.map(s => s.x).sort((a, b) => a - b);
    
    for (let i = 0; i < rowSeats.length; i++) {
      const seat = rowSeats[i];
      const newX = xPositions[rowSeats.length - 1 - i];
      
      seat.meta.canvas = seat.meta.canvas || { position: {} };
      seat.meta.canvas.position.x = newX;
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      inverted++;
    }
  }
  
  console.log(`Invertidos: ${inverted}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  const verifySeats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-derecha-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const rowYAvg = {};
  verifySeats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowYAvg[s.rowLabel]) rowYAvg[s.rowLabel] = { sum: 0, count: 0 };
    rowYAvg[s.rowLabel].sum += y;
    rowYAvg[s.rowLabel].count++;
  });
  
  for (const row of ROW_ORDER) {
    if (rowYAvg[row]) {
      const avgY = rowYAvg[row].sum / rowYAvg[row].count;
      const label = row === 'P' ? '(ARRIBA)' : row === 'A' ? '(ABAJO)' : '';
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)} ${label}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
