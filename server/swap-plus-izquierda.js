// Restaurar PLUS IZQUIERDA y luego intercambiar posiciones completas
// El backup tiene: A arriba, P abajo
// Queremos: P arriba, A abajo
// Estrategia: Intercambiar las posiciones (X,Y) completas entre asientos simétricos
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== RESTAURAR Y SWAP PLUS IZQUIERDA ===\n');
  
  // 1. Leer backup
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('plus-izquierda-'));
  console.log(`Asientos en backup: ${backupSeats.length}`);
  
  // 2. Crear mapa de backup por ID
  const backupMap = {};
  backupSeats.forEach(s => {
    backupMap[s.id] = s.metadata;
  });
  
  // 3. Definir pares de filas a intercambiar
  // P↔A, O↔B, N↔C, M↔D, L↔E, K↔F, J↔G, I↔H
  const swapPairs = [
    ['P', 'A'], ['O', 'B'], ['N', 'C'], ['M', 'D'],
    ['L', 'E'], ['K', 'F'], ['J', 'G'], ['I', 'H']
  ];
  
  // Cantidades por fila
  const seatCounts = {
    'P': 26, 'O': 25, 'N': 25, 'M': 31, 'L': 31, 'K': 30, 'J': 30, 'I': 29,
    'H': 29, 'G': 28, 'F': 28, 'E': 27, 'D': 27, 'C': 27, 'B': 26, 'A': 26
  };
  
  console.log('\n=== APLICANDO SWAP ===');
  let updated = 0;
  
  for (const [row1, row2] of swapPairs) {
    const count1 = seatCounts[row1];
    const count2 = seatCounts[row2];
    
    // Para cada asiento de row1, buscar la posición correspondiente de row2 en el backup
    // y viceversa
    
    // Necesito mapear: asiento row1-N toma la posición de row2-N (si existe)
    // Pero las filas pueden tener diferente cantidad de asientos
    
    // Estrategia: usar interpolación proporcional
    // El asiento row1-i (donde i va de 1 a count1) toma la posición
    // del asiento row2 en la posición proporcional correspondiente
    
    for (let i = 1; i <= count1; i++) {
      const id1 = `plus-izquierda-${row1}-${i}`;
      
      // Calcular el asiento correspondiente en row2 (interpolación)
      const ratio = (i - 1) / (count1 - 1);
      const j = Math.round(ratio * (count2 - 1)) + 1;
      const id2 = `plus-izquierda-${row2}-${j}`;
      
      // Obtener posición del backup de row2
      const backupMeta2 = backupMap[id2];
      if (backupMeta2 && backupMeta2.canvas?.position) {
        const seat1 = await prisma.seat.findUnique({ where: { id: id1 } });
        if (seat1) {
          let meta = {};
          try { meta = JSON.parse(seat1.metadata || '{}'); } catch(e) {}
          
          // Tomar la posición del backup de row2
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
    
    for (let i = 1; i <= count2; i++) {
      const id2 = `plus-izquierda-${row2}-${i}`;
      
      // Calcular el asiento correspondiente en row1 (interpolación)
      const ratio = (i - 1) / (count2 - 1);
      const j = Math.round(ratio * (count1 - 1)) + 1;
      const id1 = `plus-izquierda-${row1}-${j}`;
      
      // Obtener posición del backup de row1
      const backupMeta1 = backupMap[id1];
      if (backupMeta1 && backupMeta1.canvas?.position) {
        const seat2 = await prisma.seat.findUnique({ where: { id: id2 } });
        if (seat2) {
          let meta = {};
          try { meta = JSON.parse(seat2.metadata || '{}'); } catch(e) {}
          
          // Tomar la posición del backup de row1
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
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
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
  
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
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
