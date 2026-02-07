// Regenerar PLUS IZQUIERDA - Con hueco de discapacitados v3
// P ARRIBA (cerca escenario), A ABAJO (lejos escenario)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono PLUS IZQUIERDA (6 puntos)
const P0 = { x: 1147.40, y: 481.29 };  // esquina superior-izquierda
const P1 = { x: 1366.37, y: 604.75 };  // esquina superior-derecha
const P2 = { x: 1343.40, y: 646.39 };  // inicio hueco discapacitados
const P3 = { x: 1395.81, y: 677.26 };  // fin hueco discapacitados
const P4 = { x: 1294.58, y: 862.46 };  // esquina inferior-derecha
const P5 = { x: 1079.19, y: 741.14 };  // esquina inferior-izquierda

// Filas según Excel
const EXCEL_ROWS = {
  'P': 26, 'O': 25, 'N': 25, 'M': 31, 'L': 31, 'K': 30, 'J': 30, 'I': 29,
  'H': 29, 'G': 28, 'F': 28, 'E': 27, 'D': 27, 'C': 27, 'B': 26, 'A': 26
};
const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];

// Función para interpolar entre dos puntos
function lerp(a, b, t) {
  return a + t * (b - a);
}

async function main() {
  console.log('=== REGENERAR PLUS IZQUIERDA CON HUECO V3 ===\n');
  
  const numRows = ROW_ORDER.length; // 16
  const padding = 8;
  
  // Usar interpolación directa entre los bordes del polígono
  // Borde izquierdo: P0 → P5
  // Borde derecho: P0-P1 (arriba), luego P1-P2-P3-P4 (con hueco)
  
  // Para simplificar, defino los puntos clave para cada borde
  // Left edge: línea recta de P0 a P5
  // Right edge: más complejo
  
  console.log('=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowLabel = ROW_ORDER[rowIdx];
    const numSeats = EXCEL_ROWS[rowLabel];
    const t = rowIdx / (numRows - 1); // 0 para P (arriba), 1 para A (abajo)
    
    // Borde izquierdo (línea recta P0 → P5)
    const leftX = lerp(P0.x, P5.x, t) + padding;
    const leftY = lerp(P0.y, P5.y, t) + padding;
    
    // Borde derecho (más complejo por el hueco)
    // Divido en 3 zonas:
    // - Filas 0-4 (P,O,N,M,L): zona superior, borde va de P0 hacia P1
    // - Filas 5-8 (K,J,I,H): zona del hueco, borde limitado por P2
    // - Filas 9-15 (G,F,E,D,C,B,A): zona inferior, borde va de P3 hacia P4
    
    let rightX, rightY;
    
    if (rowIdx <= 4) {
      // Zona superior: interpolar de cerca de P0 hacia P1
      const tLocal = rowIdx / 4;
      rightX = lerp(P0.x + 50, P1.x, tLocal) - padding;
      rightY = lerp(P0.y + 30, P1.y, tLocal) + padding;
    } else if (rowIdx <= 8) {
      // Zona del hueco: usar P2 como límite (el borde se mete hacia adentro)
      const tLocal = (rowIdx - 5) / 3;
      // En esta zona, el X está limitado por P2.x
      rightX = P2.x - padding;
      rightY = lerp(P1.y, P3.y, tLocal) + padding;
    } else {
      // Zona inferior: interpolar de P3 hacia P4
      const tLocal = (rowIdx - 9) / 6;
      rightX = lerp(P3.x, P4.x, tLocal) - padding;
      rightY = lerp(P3.y, P4.y, tLocal) + padding;
    }
    
    // Calcular Y promedio de la fila
    const rowY = (leftY + rightY) / 2;
    
    // Calcular el ángulo de la fila
    const dx = rightX - leftX;
    const dy = rightY - leftY;
    const angle = Math.atan2(dy, dx);
    
    // Distribuir asientos a lo largo de la fila
    const rowLength = Math.sqrt(dx * dx + dy * dy);
    const seatSpacing = rowLength / (numSeats - 1);
    
    const inHueco = rowIdx >= 5 && rowIdx <= 8;
    
    for (let seatIdx = 0; seatIdx < numSeats; seatIdx++) {
      const seatNum = seatIdx + 1;
      const seatId = `plus-izquierda-${rowLabel}-${seatNum}`;
      
      // Asiento 1 a la derecha, último a la izquierda
      const dist = seatIdx * seatSpacing;
      const x = rightX - dist * Math.cos(angle);
      const y = rightY - dist * Math.sin(angle);
      
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
    
    const huecoMark = inHueco ? ' [HUECO]' : '';
    console.log(`Fila ${rowLabel}: X=[${leftX.toFixed(0)}-${rightX.toFixed(0)}], ${numSeats} asientos${huecoMark}`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  for (const row of ['P', 'K', 'I', 'G', 'A']) {
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
      console.log(`${row}: 1→(${fm.canvas?.position?.x?.toFixed(0)},${fm.canvas?.position?.y?.toFixed(0)}) | ${last.columnNumber}→(${lm.canvas?.position?.x?.toFixed(0)},${lm.canvas?.position?.y?.toFixed(0)})`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
