// Fix PREFERENTE DERECHA - Restaurar y Swap correcto
// Igual que PLUS IZQUIERDA que funcionó bien
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== FIX PREFERENTE DERECHA V2 ===\n');
  
  // 1. Primero restaurar COMPLETAMENTE desde backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('preferente-derecha-'));
  console.log(`Asientos en backup: ${backupSeats.length}`);
  
  console.log('\n=== RESTAURANDO DESDE BACKUP ===');
  for (const bs of backupSeats) {
    await prisma.seat.update({
      where: { id: bs.id },
      data: { metadata: JSON.stringify(bs.metadata) }
    });
  }
  console.log('Restaurados:', backupSeats.length);
  
  // 2. Crear mapa del backup
  const backupMap = {};
  backupSeats.forEach(s => {
    backupMap[s.id] = s.metadata;
  });
  
  // Agrupar por fila
  const backupByRow = {};
  backupSeats.forEach(s => {
    if (!backupByRow[s.rowLabel]) backupByRow[s.rowLabel] = [];
    backupByRow[s.rowLabel].push({
      id: s.id,
      columnNumber: s.columnNumber,
      x: s.metadata.canvas?.position?.x || 0,
      y: s.metadata.canvas?.position?.y || 0
    });
  });
  
  // Ordenar cada fila
  Object.keys(backupByRow).forEach(row => {
    backupByRow[row].sort((a, b) => a.columnNumber - b.columnNumber);
  });
  
  // Mostrar estado del backup
  console.log('\n=== ESTADO DEL BACKUP ===');
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  const backupYAvg = {};
  rowOrder.forEach(row => {
    if (backupByRow[row]) {
      const seats = backupByRow[row];
      backupYAvg[row] = seats.reduce((sum, s) => sum + s.y, 0) / seats.length;
    }
  });
  
  console.log('Fila P (backup):', backupYAvg['P']?.toFixed(0), '- debe ir ARRIBA');
  console.log('Fila A (backup):', backupYAvg['A']?.toFixed(0), '- debe ir ABAJO');
  
  // 3. Pares a intercambiar
  const swapPairs = [
    ['P', 'A'], ['O', 'B'], ['N', 'C'], ['M', 'D'],
    ['L', 'E'], ['K', 'F'], ['J', 'G'], ['I', 'H']
  ];
  
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
  
  console.log('\n=== APLICANDO SWAP ===');
  let updated = 0;
  
  for (const [row1, row2] of swapPairs) {
    const seats1 = backupByRow[row1] || [];
    const seats2 = backupByRow[row2] || [];
    const count1 = EXCEL[row1].count;
    const count2 = EXCEL[row2].count;
    const start1 = EXCEL[row1].min;
    const start2 = EXCEL[row2].min;
    
    // row1 toma posiciones de row2 del backup
    for (let i = 0; i < count1; i++) {
      const seatNum1 = start1 + i;
      const id1 = `preferente-derecha-${row1}-${seatNum1}`;
      
      // Interpolar para encontrar posición correspondiente en row2
      const ratio = i / (count1 - 1);
      const idx2 = Math.round(ratio * (count2 - 1));
      
      if (seats2[idx2]) {
        const seat1 = await prisma.seat.findUnique({ where: { id: id1 } });
        if (seat1) {
          let meta = {};
          try { meta = JSON.parse(seat1.metadata || '{}'); } catch(e) {}
          
          meta.canvas = meta.canvas || {};
          meta.canvas.position = { x: seats2[idx2].x, y: seats2[idx2].y };
          meta.canvas.size = { width: 7, height: 7 };
          
          await prisma.seat.update({
            where: { id: id1 },
            data: { metadata: JSON.stringify(meta) }
          });
          updated++;
        }
      }
    }
    
    // row2 toma posiciones de row1 del backup
    for (let i = 0; i < count2; i++) {
      const seatNum2 = start2 + i;
      const id2 = `preferente-derecha-${row2}-${seatNum2}`;
      
      const ratio = i / (count2 - 1);
      const idx1 = Math.round(ratio * (count1 - 1));
      
      if (seats1[idx1]) {
        const seat2 = await prisma.seat.findUnique({ where: { id: id2 } });
        if (seat2) {
          let meta = {};
          try { meta = JSON.parse(seat2.metadata || '{}'); } catch(e) {}
          
          meta.canvas = meta.canvas || {};
          meta.canvas.position = { x: seats1[idx1].x, y: seats1[idx1].y };
          meta.canvas.size = { width: 7, height: 7 };
          
          await prisma.seat.update({
            where: { id: id2 },
            data: { metadata: JSON.stringify(meta) }
          });
          updated++;
        }
      }
    }
    
    console.log(`Swap ${row1}(${count1}) ↔ ${row2}(${count2})`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-derecha-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const rowYAvg = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowYAvg[s.rowLabel]) rowYAvg[s.rowLabel] = { sum: 0, count: 0 };
    rowYAvg[s.rowLabel].sum += y;
    rowYAvg[s.rowLabel].count++;
  });
  
  for (const row of rowOrder) {
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
