// Analizar polígono y reconstruir PLUS IZQUIERDA correctamente
// P ARRIBA (cerca escenario), A ABAJO (lejos escenario)
// Mantener ángulo del polígono y espacio discapacitados

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono PLUS IZQUIERDA (6 puntos con hueco para discapacitados)
const POLYGON = [
  { x: 1147.40, y: 481.29 },  // P0: arriba-izquierda (cerca escenario)
  { x: 1366.37, y: 604.75 },  // P1: arriba-derecha 
  { x: 1343.40, y: 646.39 },  // P2: muesca derecha (inicio hueco discapacitados)
  { x: 1395.81, y: 677.26 },  // P3: muesca derecha (fin hueco)
  { x: 1294.58, y: 862.46 },  // P4: abajo-derecha (lejos escenario)
  { x: 1079.19, y: 741.14 }   // P5: abajo-izquierda
];

// Asientos por fila según Excel (P arriba → A abajo)
const EXCEL_ROWS = {
  'P': 26, 'O': 25, 'N': 25, 'M': 31, 'L': 31, 'K': 30, 'J': 30, 'I': 29,
  'H': 29, 'G': 28, 'F': 28, 'E': 27, 'D': 27, 'C': 27, 'B': 26, 'A': 26
};

const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

async function main() {
  console.log('=== RECONSTRUIR PLUS IZQUIERDA ===\n');
  
  console.log('Polígono (6 puntos con hueco discapacitados):');
  POLYGON.forEach((p, i) => console.log(`  P${i}: (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`));
  
  // Analizar el polígono
  // El borde superior va de P0 a P1 (cerca del escenario) - donde va fila P
  // El borde inferior va de P5 a P4 (lejos del escenario) - donde va fila A
  // Los puntos P2 y P3 crean el hueco para discapacitados en el lado derecho
  
  const topEdge = { start: POLYGON[0], end: POLYGON[1] };  // Fila P (arriba)
  const bottomEdge = { start: POLYGON[5], end: POLYGON[4] }; // Fila A (abajo)
  
  // Calcular ángulo del borde superior
  const topAngle = Math.atan2(topEdge.end.y - topEdge.start.y, topEdge.end.x - topEdge.start.x);
  const topAngleDeg = topAngle * 180 / Math.PI;
  console.log(`\nÁngulo borde superior: ${topAngleDeg.toFixed(1)}°`);
  
  // Calcular ángulo del borde inferior
  const bottomAngle = Math.atan2(bottomEdge.end.y - bottomEdge.start.y, bottomEdge.end.x - bottomEdge.start.x);
  const bottomAngleDeg = bottomAngle * 180 / Math.PI;
  console.log(`Ángulo borde inferior: ${bottomAngleDeg.toFixed(1)}°`);
  
  // Número de filas y distribución
  const numRows = ROW_ORDER.length; // 16
  
  // Leer backup para obtener las posiciones X originales (que respetan el ángulo)
  const backup = JSON.parse(fs.readFileSync('backup-restore.json', 'utf8'));
  const backupSeats = backup.seats.filter(s => s.id.startsWith('plus-izquierda-'));
  
  // Agrupar backup por fila
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
  
  // Ordenar por columnNumber
  Object.keys(backupByRow).forEach(row => {
    backupByRow[row].sort((a, b) => a.columnNumber - b.columnNumber);
  });
  
  // Mostrar backup
  console.log('\n=== BACKUP ORIGINAL ===');
  console.log('Fila A (backup): Y=' + (backupByRow['A']?.[0]?.y?.toFixed(0) || 'N/A') + ' (arriba)');
  console.log('Fila P (backup): Y=' + (backupByRow['P']?.[0]?.y?.toFixed(0) || 'N/A') + ' (abajo)');
  
  // Crear mapeo de filas invertido:
  // En el backup: A está arriba (Y bajo), P está abajo (Y alto)
  // Queremos: P arriba (Y bajo), A abajo (Y alto)
  // Solución: Intercambiar las posiciones Y entre filas simétricas
  // P ↔ A, O ↔ B, N ↔ C, M ↔ D, L ↔ E, K ↔ F, J ↔ G, I ↔ H
  
  const rowPairs = [
    ['P', 'A'], ['O', 'B'], ['N', 'C'], ['M', 'D'],
    ['L', 'E'], ['K', 'F'], ['J', 'G'], ['I', 'H']
  ];
  
  // Calcular Y promedio de cada fila en el backup
  const backupYAvg = {};
  Object.keys(backupByRow).forEach(row => {
    const seats = backupByRow[row];
    backupYAvg[row] = seats.reduce((sum, s) => sum + s.y, 0) / seats.length;
  });
  
  console.log('\n=== INTERCAMBIO DE FILAS ===');
  rowPairs.forEach(([r1, r2]) => {
    console.log(`${r1} (Y=${backupYAvg[r1]?.toFixed(0)}) ↔ ${r2} (Y=${backupYAvg[r2]?.toFixed(0)})`);
  });
  
  // Aplicar el intercambio
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (const [row1, row2] of rowPairs) {
    const seats1 = backupByRow[row1] || [];
    const seats2 = backupByRow[row2] || [];
    
    const y1Avg = backupYAvg[row1];
    const y2Avg = backupYAvg[row2];
    const deltaY = y2Avg - y1Avg;  // Para mover row1 a la posición de row2
    
    // Actualizar fila row1: mover a posición Y de row2 (pero manteniendo su ángulo interno)
    for (const seat of seats1) {
      const newY = seat.y + deltaY;
      
      const currentSeat = await prisma.seat.findUnique({ where: { id: seat.id } });
      let meta = {};
      try { meta = JSON.parse(currentSeat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || { position: {} };
      meta.canvas.position.y = newY;
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(meta) }
      });
      updated++;
    }
    
    // Actualizar fila row2: mover a posición Y de row1
    for (const seat of seats2) {
      const newY = seat.y - deltaY;
      
      const currentSeat = await prisma.seat.findUnique({ where: { id: seat.id } });
      let meta = {};
      try { meta = JSON.parse(currentSeat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || { position: {} };
      meta.canvas.position.y = newY;
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(meta) }
      });
      updated++;
    }
    
    console.log(`Intercambiadas filas ${row1} ↔ ${row2}`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN FINAL ===');
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const finalYAvg = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!finalYAvg[s.rowLabel]) finalYAvg[s.rowLabel] = { sum: 0, count: 0 };
    finalYAvg[s.rowLabel].sum += y;
    finalYAvg[s.rowLabel].count++;
  });
  
  for (const row of ROW_ORDER) {
    if (finalYAvg[row]) {
      const avgY = finalYAvg[row].sum / finalYAvg[row].count;
      const label = row === 'P' ? '(ARRIBA - cerca escenario)' : row === 'A' ? '(ABAJO - lejos escenario)' : '';
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)} ${label}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
