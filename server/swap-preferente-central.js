// Swap PREFERENTE CENTRAL - O arriba, A abajo
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== SWAP PREFERENTE CENTRAL ===\n');
  console.log('Objetivo: O arriba (Y bajo), A abajo (Y alto)\n');
  
  // Leer backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('preferente-central-'));
  console.log(`Asientos en backup: ${backupSeats.length}`);
  
  // Crear mapa de backup por ID
  const backupMap = {};
  backupSeats.forEach(s => {
    backupMap[s.id] = s.metadata;
  });
  
  // Filas de PREFERENTE CENTRAL: O, N, M, L, K, J, I, H, G, F, E, D, C, B, A (15 filas)
  // Pares a intercambiar: O↔A, N↔B, M↔C, L↔D, K↔E, J↔F, I↔G, H queda en medio
  const swapPairs = [
    ['O', 'A'], ['N', 'B'], ['M', 'C'], ['L', 'D'],
    ['K', 'E'], ['J', 'F'], ['I', 'G']
  ];
  // H está en el medio (índice 7 de 15), no necesita swap
  
  // Cantidades por fila según Excel
  const seatCounts = {
    'O': 56, 'N': 55, 'M': 54, 'L': 53, 'K': 52, 'J': 51, 'I': 50,
    'H': 49, 'G': 48, 'F': 47, 'E': 46, 'D': 45, 'C': 44, 'B': 43, 'A': 42
  };
  
  // Numeración inicial por fila
  const startNums = {
    'O': 44, 'N': 43, 'M': 43, 'L': 43, 'K': 42, 'J': 42, 'I': 41,
    'H': 41, 'G': 40, 'F': 40, 'E': 39, 'D': 39, 'C': 38, 'B': 38, 'A': 37
  };
  
  console.log('\n=== APLICANDO SWAP ===');
  let updated = 0;
  
  for (const [row1, row2] of swapPairs) {
    const count1 = seatCounts[row1];
    const count2 = seatCounts[row2];
    const start1 = startNums[row1];
    const start2 = startNums[row2];
    
    // Para cada asiento de row1, tomar la posición del asiento correspondiente de row2
    for (let i = 0; i < count1; i++) {
      const seatNum1 = start1 + i;
      const id1 = `preferente-central-${row1}-${seatNum1}`;
      
      // Calcular el asiento correspondiente en row2 (interpolación proporcional)
      const ratio = i / (count1 - 1);
      const idx2 = Math.round(ratio * (count2 - 1));
      const seatNum2 = start2 + idx2;
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
    
    // Viceversa: row2 toma posiciones de row1
    for (let i = 0; i < count2; i++) {
      const seatNum2 = start2 + i;
      const id2 = `preferente-central-${row2}-${seatNum2}`;
      
      const ratio = i / (count2 - 1);
      const idx1 = Math.round(ratio * (count1 - 1));
      const seatNum1 = start1 + idx1;
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
    
    console.log(`Swap ${row1}(${count1}) ↔ ${row2}(${count2})`);
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
  
  const rowOrder = ['O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  for (const row of rowOrder) {
    if (rowYAvg[row]) {
      const avgY = rowYAvg[row].sum / rowYAvg[row].count;
      const label = row === 'O' ? '(ARRIBA)' : row === 'A' ? '(ABAJO)' : '';
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)} ${label}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
