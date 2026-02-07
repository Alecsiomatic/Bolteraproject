// Regenerar PLUS IZQUIERDA - Siguiendo polígono correctamente
// P ARRIBA (cerca escenario, Y bajo), A ABAJO (lejos escenario, Y alto)
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono PLUS IZQUIERDA (6 puntos - forma con hueco para discapacitados)
// P0-P1: borde superior (cerca escenario)
// P2-P3: hueco/muesca para discapacitados
// P4-P5: borde inferior (lejos escenario)
const POLYGON = [
  { x: 1147.40, y: 481.29 },  // P0: esquina superior-izquierda
  { x: 1366.37, y: 604.75 },  // P1: esquina superior-derecha
  { x: 1343.40, y: 646.39 },  // P2: inicio hueco discapacitados
  { x: 1395.81, y: 677.26 },  // P3: fin hueco discapacitados
  { x: 1294.58, y: 862.46 },  // P4: esquina inferior-derecha
  { x: 1079.19, y: 741.14 }   // P5: esquina inferior-izquierda
];

// Filas según Excel: P arriba → A abajo
const EXCEL_ROWS = {
  'P': 26, 'O': 25, 'N': 25, 'M': 31, 'L': 31, 'K': 30, 'J': 30, 'I': 29,
  'H': 29, 'G': 28, 'F': 28, 'E': 27, 'D': 27, 'C': 27, 'B': 26, 'A': 26
};
const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

async function main() {
  console.log('=== REGENERAR PLUS IZQUIERDA ===\n');
  
  // Leer backup para obtener la estructura original
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
      y: s.metadata.canvas?.position?.y || 0,
      metadata: s.metadata
    });
  });
  
  // Ordenar cada fila por columnNumber
  Object.keys(backupByRow).forEach(row => {
    backupByRow[row].sort((a, b) => a.columnNumber - b.columnNumber);
  });
  
  // Analizar estructura del backup
  console.log('=== ESTRUCTURA DEL BACKUP ===');
  console.log('Fila A (backup - arriba):');
  const filaA = backupByRow['A'];
  console.log(`  Asiento 1: X=${filaA[0].x.toFixed(1)}, Y=${filaA[0].y.toFixed(1)}`);
  console.log(`  Asiento ${filaA.length}: X=${filaA[filaA.length-1].x.toFixed(1)}, Y=${filaA[filaA.length-1].y.toFixed(1)}`);
  
  console.log('Fila P (backup - abajo):');
  const filaP = backupByRow['P'];
  console.log(`  Asiento 1: X=${filaP[0].x.toFixed(1)}, Y=${filaP[0].y.toFixed(1)}`);
  console.log(`  Asiento ${filaP.length}: X=${filaP[filaP.length-1].x.toFixed(1)}, Y=${filaP[filaP.length-1].y.toFixed(1)}`);
  
  // El polígono tiene ángulo de ~30°
  // Borde superior (P0→P1): donde debe ir fila P (ARRIBA)
  // Borde inferior (P5→P4): donde debe ir fila A (ABAJO)
  
  // En el backup, las filas van de A (arriba) a P (abajo)
  // Necesitamos INVERTIR: P arriba, A abajo
  
  // La estrategia: usar las posiciones relativas del backup pero asignarlas a las filas invertidas
  // La fila P tomará las posiciones que tenía la fila A
  // La fila A tomará las posiciones que tenía la fila P
  // etc.
  
  // Crear mapeo de intercambio
  const swapMap = {
    'P': 'A', 'O': 'B', 'N': 'C', 'M': 'D', 'L': 'E', 'K': 'F', 'J': 'G', 'I': 'H',
    'H': 'I', 'G': 'J', 'F': 'K', 'E': 'L', 'D': 'M', 'C': 'N', 'B': 'O', 'A': 'P'
  };
  
  // Pero hay un problema: las filas tienen diferentes cantidades de asientos
  // P tiene 26 asientos, A tiene 26 - OK
  // O tiene 25, B tiene 26 - diferente
  // etc.
  
  // Mejor enfoque: Generar las posiciones desde cero siguiendo el polígono
  console.log('\n=== GENERANDO NUEVAS POSICIONES ===');
  
  // Definir los bordes del área utilizable
  // El borde izquierdo va de P0 a P5
  // El borde derecho es más complejo por el hueco de discapacitados
  
  const topLeft = POLYGON[0];     // P0
  const topRight = POLYGON[1];    // P1
  const bottomLeft = POLYGON[5];  // P5
  const bottomRight = POLYGON[4]; // P4
  
  // Para simplificar, uso los 4 puntos principales (ignorando el hueco por ahora)
  // Las filas de arriba (P) usan el borde superior, las de abajo (A) el inferior
  
  const numRows = ROW_ORDER.length;
  const padding = 8;
  
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowLabel = ROW_ORDER[rowIdx];
    const numSeats = EXCEL_ROWS[rowLabel];
    const t = rowIdx / (numRows - 1); // 0 para P (arriba), 1 para A (abajo)
    
    // Interpolar entre borde superior e inferior para esta fila
    // Punto izquierdo de la fila
    const leftX = topLeft.x + t * (bottomLeft.x - topLeft.x);
    const leftY = topLeft.y + t * (bottomLeft.y - topLeft.y);
    
    // Punto derecho de la fila
    const rightX = topRight.x + t * (bottomRight.x - topRight.x);
    const rightY = topRight.y + t * (bottomRight.y - topRight.y);
    
    // Los asientos van de derecha a izquierda (DERECHA A IZQ según Excel)
    // Asiento 1 está a la derecha (mayor X)
    for (let seatIdx = 0; seatIdx < numSeats; seatIdx++) {
      const seatT = seatIdx / (numSeats - 1); // 0 para asiento 1 (derecha), 1 para último (izquierda)
      
      // Interpolar de derecha a izquierda
      const x = rightX - padding + seatT * (leftX + padding - rightX + padding);
      const y = rightY - padding + seatT * (leftY + padding - rightY + padding);
      
      const seatId = `plus-izquierda-${rowLabel}-${seatIdx + 1}`;
      
      // Buscar el asiento en la DB
      const seat = await prisma.seat.findUnique({ where: { id: seatId } });
      if (seat) {
        let meta = {};
        try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
        
        meta.canvas = meta.canvas || { position: {}, size: { width: 7, height: 7 } };
        meta.canvas.position = { x, y };
        
        await prisma.seat.update({
          where: { id: seatId },
          data: { metadata: JSON.stringify(meta) }
        });
        updated++;
      }
    }
    
    console.log(`Fila ${rowLabel}: ${numSeats} asientos, Y≈${((leftY + rightY)/2).toFixed(0)}`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN FINAL ===');
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  // Mostrar ejemplos
  for (const row of ['P', 'A']) {
    const rowSeats = seats.filter(s => s.rowLabel === row).sort((a, b) => a.columnNumber - b.columnNumber);
    if (rowSeats.length > 0) {
      const first = rowSeats[0];
      const last = rowSeats[rowSeats.length - 1];
      let fm = {}, lm = {};
      try { fm = JSON.parse(first.metadata); lm = JSON.parse(last.metadata); } catch(e) {}
      console.log(`Fila ${row}:`);
      console.log(`  Asiento 1: X=${fm.canvas?.position?.x?.toFixed(1)}, Y=${fm.canvas?.position?.y?.toFixed(1)}`);
      console.log(`  Asiento ${last.columnNumber}: X=${lm.canvas?.position?.x?.toFixed(1)}, Y=${lm.canvas?.position?.y?.toFixed(1)}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
