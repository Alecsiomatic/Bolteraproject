// Restaurar PREFERENTE CENTRAL desde backup y hacer swap correcto
// Orden: P arriba → O → N → M → L → K → J → I → H → G → F → E → D → C → B → A abajo
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== RESTAURAR Y SWAP PREFERENTE CENTRAL ===\n');
  
  // 1. Primero restaurar desde backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('preferente-central-'));
  console.log(`Asientos en backup: ${backupSeats.length}`);
  
  // Mostrar filas en backup
  const backupByRow = {};
  backupSeats.forEach(s => {
    if (!backupByRow[s.rowLabel]) backupByRow[s.rowLabel] = [];
    backupByRow[s.rowLabel].push(s);
  });
  console.log('Filas en backup:', Object.keys(backupByRow).sort().join(', '));
  
  // Crear mapa de backup por ID
  const backupMap = {};
  backupSeats.forEach(s => {
    backupMap[s.id] = s.metadata;
  });
  
  // 2. El orden correcto es P arriba, A abajo
  // ROW_ORDER[0] = P (arriba), ROW_ORDER[15] = A (abajo)
  const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  // Pares a intercambiar (simétricos)
  // P↔A, O↔B, N↔C, M↔D, L↔E, K↔F, J↔G, I↔H
  const swapPairs = [
    ['P', 'A'], ['O', 'B'], ['N', 'C'], ['M', 'D'],
    ['L', 'E'], ['K', 'F'], ['J', 'G'], ['I', 'H']
  ];
  
  // Excel PREFERENTE CENTRAL
  const EXCEL = {
    'P': { count: 57, min: 44, max: 100 },
    'O': { count: 56, min: 44, max: 99 },
    'N': { count: 55, min: 43, max: 97 },
    'M': { count: 54, min: 43, max: 96 },
    'L': { count: 53, min: 43, max: 95 },
    'K': { count: 52, min: 42, max: 93 },
    'J': { count: 51, min: 42, max: 92 },
    'I': { count: 50, min: 41, max: 90 },
    'H': { count: 49, min: 41, max: 89 },
    'G': { count: 48, min: 40, max: 87 },
    'F': { count: 47, min: 40, max: 86 },
    'E': { count: 46, min: 39, max: 84 },
    'D': { count: 45, min: 39, max: 83 },
    'C': { count: 44, min: 38, max: 81 },
    'B': { count: 43, min: 38, max: 80 },
    'A': { count: 42, min: 37, max: 78 }
  };
  
  console.log('\n=== APLICANDO SWAP ===');
  let updated = 0;
  
  for (const [row1, row2] of swapPairs) {
    const data1 = EXCEL[row1];
    const data2 = EXCEL[row2];
    
    // row1 toma posiciones de row2
    for (let i = 0; i < data1.count; i++) {
      const seatNum1 = data1.min + i;
      const id1 = `preferente-central-${row1}-${seatNum1}`;
      
      // Interpolar para encontrar asiento correspondiente en row2
      const ratio = i / (data1.count - 1);
      const idx2 = Math.round(ratio * (data2.count - 1));
      const seatNum2 = data2.min + idx2;
      const id2 = `preferente-central-${row2}-${seatNum2}`;
      
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
          updated++;
        }
      }
    }
    
    // row2 toma posiciones de row1
    for (let i = 0; i < data2.count; i++) {
      const seatNum2 = data2.min + i;
      const id2 = `preferente-central-${row2}-${seatNum2}`;
      
      const ratio = i / (data2.count - 1);
      const idx1 = Math.round(ratio * (data1.count - 1));
      const seatNum1 = data1.min + idx1;
      const id1 = `preferente-central-${row1}-${seatNum1}`;
      
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
          updated++;
        }
      }
    }
    
    console.log(`Swap ${row1}(${data1.count}) ↔ ${row2}(${data2.count})`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-central-' } },
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
