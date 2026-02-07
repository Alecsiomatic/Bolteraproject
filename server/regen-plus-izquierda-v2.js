// Regenerar PLUS IZQUIERDA - Con hueco de discapacitados
// P ARRIBA (cerca escenario), A ABAJO (lejos escenario)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono PLUS IZQUIERDA (6 puntos)
const P0 = { x: 1147.40, y: 481.29 };  // esquina superior-izquierda
const P1 = { x: 1366.37, y: 604.75 };  // esquina superior-derecha
const P2 = { x: 1343.40, y: 646.39 };  // inicio hueco discapacitados (hacia adentro)
const P3 = { x: 1395.81, y: 677.26 };  // fin hueco discapacitados (hacia afuera)
const P4 = { x: 1294.58, y: 862.46 };  // esquina inferior-derecha
const P5 = { x: 1079.19, y: 741.14 };  // esquina inferior-izquierda

// Filas según Excel
const EXCEL_ROWS = {
  'P': 26, 'O': 25, 'N': 25, 'M': 31, 'L': 31, 'K': 30, 'J': 30, 'I': 29,
  'H': 29, 'G': 28, 'F': 28, 'E': 27, 'D': 27, 'C': 27, 'B': 26, 'A': 26
};
const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

// Función para interpolar entre dos puntos
function lerp(p1, p2, t) {
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
}

// Función para calcular el punto en el borde derecho dado un Y
function getRightEdgeX(y) {
  // El borde derecho tiene 3 segmentos:
  // 1. P1 → P2: Y de 604.75 a 646.39 (hacia adentro, X decrece)
  // 2. P2 → P3: Y de 646.39 a 677.26 (hacia afuera, X aumenta) - HUECO
  // 3. P3 → P4: Y de 677.26 a 862.46 (hacia adentro, X decrece)
  
  if (y <= P1.y) {
    // Arriba del borde, usar P0→P1
    const t = (y - P0.y) / (P1.y - P0.y);
    return lerp(P0, P1, t).x;
  } else if (y <= P2.y) {
    // Segmento P1→P2 (antes del hueco)
    const t = (y - P1.y) / (P2.y - P1.y);
    return lerp(P1, P2, t).x;
  } else if (y <= P3.y) {
    // Segmento P2→P3 (EL HUECO - usar P2 como límite, no seguir hacia P3)
    // En esta zona el borde se mete hacia adentro, usamos el X de P2
    return P2.x;
  } else {
    // Segmento P3→P4 (después del hueco)
    const t = (y - P3.y) / (P4.y - P3.y);
    return lerp(P3, P4, t).x;
  }
}

// Función para calcular el punto en el borde izquierdo dado un Y
function getLeftEdgeX(y) {
  // El borde izquierdo va de P0 a P5
  if (y <= P0.y) return P0.x;
  if (y >= P5.y) return P5.x;
  
  const t = (y - P0.y) / (P5.y - P0.y);
  return lerp(P0, P5, t).x;
}

async function main() {
  console.log('=== REGENERAR PLUS IZQUIERDA CON HUECO ===\n');
  
  console.log('Polígono:');
  console.log(`  P0 (sup-izq): (${P0.x.toFixed(0)}, ${P0.y.toFixed(0)})`);
  console.log(`  P1 (sup-der): (${P1.x.toFixed(0)}, ${P1.y.toFixed(0)})`);
  console.log(`  P2 (hueco inicio): (${P2.x.toFixed(0)}, ${P2.y.toFixed(0)})`);
  console.log(`  P3 (hueco fin): (${P3.x.toFixed(0)}, ${P3.y.toFixed(0)})`);
  console.log(`  P4 (inf-der): (${P4.x.toFixed(0)}, ${P4.y.toFixed(0)})`);
  console.log(`  P5 (inf-izq): (${P5.x.toFixed(0)}, ${P5.y.toFixed(0)})`);
  
  console.log('\nZona del hueco: Y entre', P2.y.toFixed(0), 'y', P3.y.toFixed(0));
  
  const numRows = ROW_ORDER.length;
  const padding = 10;
  
  // Rango Y para las filas
  const startY = P0.y + padding;  // Fila P (arriba)
  const endY = P4.y - padding;    // Fila A (abajo)
  const rowSpacing = (endY - startY) / (numRows - 1);
  
  console.log(`\nRango Y: ${startY.toFixed(0)} a ${endY.toFixed(0)}, spacing: ${rowSpacing.toFixed(1)}`);
  
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowLabel = ROW_ORDER[rowIdx];
    const numSeats = EXCEL_ROWS[rowLabel];
    const rowY = startY + rowIdx * rowSpacing;
    
    // Calcular bordes para esta fila
    const leftX = getLeftEdgeX(rowY) + padding;
    const rightX = getRightEdgeX(rowY) - padding;
    
    // Verificar si esta fila está en la zona del hueco
    const inHueco = rowY > P2.y && rowY < P3.y;
    
    // Calcular espaciado entre asientos
    const rowWidth = rightX - leftX;
    const seatSpacing = rowWidth / (numSeats - 1);
    
    for (let seatIdx = 0; seatIdx < numSeats; seatIdx++) {
      const seatNum = seatIdx + 1;
      const seatId = `plus-izquierda-${rowLabel}-${seatNum}`;
      
      // Asiento 1 a la derecha (mayor X), último a la izquierda
      const x = rightX - seatIdx * seatSpacing;
      
      // Pequeño ajuste en Y para seguir el ángulo (~30°)
      const angleOffset = seatIdx * 0.17 * seatSpacing;
      const y = rowY - angleOffset * 0.5;
      
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
    
    const huecoMark = inHueco ? ' [EN HUECO]' : '';
    console.log(`Fila ${rowLabel}: Y=${rowY.toFixed(0)}, X=[${leftX.toFixed(0)}-${rightX.toFixed(0)}], ${numSeats} asientos${huecoMark}`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  for (const row of ['P', 'M', 'J', 'A']) {
    const seats = await prisma.seat.findMany({
      where: { venueId: VENUE_ID, id: { startsWith: `plus-izquierda-${row}-` } },
      select: { columnNumber: true, metadata: true }
    });
    seats.sort((a, b) => a.columnNumber - b.columnNumber);
    
    if (seats.length > 0) {
      const first = seats[0];
      const last = seats[seats.length - 1];
      let fm = {}, lm = {};
      try { fm = JSON.parse(first.metadata); lm = JSON.parse(last.metadata); } catch(e) {}
      console.log(`Fila ${row} (${seats.length}): Asiento 1 X=${fm.canvas?.position?.x?.toFixed(0)}, Asiento ${last.columnNumber} X=${lm.canvas?.position?.x?.toFixed(0)}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
