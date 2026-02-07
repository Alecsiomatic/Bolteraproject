// CORREGIR VIP DERECHA - Basado en cómo funciona VIP IZQUIERDA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono VIP DERECHA
// P0: (565.8, 865.5)
// P1: (629.1, 976.8) - ABAJO DERECHA
// P2: (805.9, 874.4) - ARRIBA DERECHA  
// P3: (770.0, 745.2) - ARRIBA IZQUIERDA

// En VIP IZQUIERDA:
// - Fila 1 está abajo (Y ~963), Fila 8 arriba (Y ~871)
// - Asiento 1 está a la DERECHA (X alto), asiento mayor a la IZQUIERDA (X bajo)
// - Filas tienen ángulo -151° (van de derecha hacia izquierda-arriba)

// En VIP DERECHA (espejo):
// - Fila 1 debe estar ABAJO (cerca de P1 con Y=976)
// - Fila 8 debe estar ARRIBA (cerca de P2-P3 con Y bajo)
// - Las filas deben ser paralelas al borde P1->P2 (ángulo -30°)
// - Asiento mayor (derecha) a asiento menor (izquierda)

// El borde P1->P2 es el "largo" de las filas (donde van los asientos)
// El borde P0->P1 y P3->P2 son los "cortos" (altura de la sección)

const P0 = { x: 565.8, y: 865.5 };
const P1 = { x: 629.1, y: 976.8 };  // Inferior derecha
const P2 = { x: 805.9, y: 874.4 };  // Superior derecha
const P3 = { x: 770.0, y: 745.2 };  // Superior izquierda

function lerp(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

async function main() {
  console.log('=== CORREGIR VIP DERECHA - USANDO BORDES CORRECTOS ===\n');
  
  // Las filas son PARALELAS al borde P1->P2 (el borde largo inferior-derecho a superior-derecho)
  // Fila 1 está cerca del borde P0->P1 (lado izquierdo-inferior)
  // Fila 8 está cerca del borde P3->P2... no, espera
  
  // Mirando el diagrama:
  //     P3 -------- P2
  //    /            /
  //   /            /
  //  P0 -------- P1
  //
  // NO. El polígono no es así. Veamos los puntos:
  // P0 (565, 865), P1 (629, 977), P2 (805, 874), P3 (770, 745)
  //
  // P3 (770, 745) está arriba-derecha
  // P2 (805, 874) está abajo-derecha  
  // P1 (629, 977) está abajo-izquierda (el más abajo de todos)
  // P0 (565, 865) está arriba-izquierda
  
  // Entonces el polígono es:
  //  P0 ----------- P3
  //   \              \
  //    \              \
  //     P1 ----------- P2
  //
  // El borde INFERIOR es P1->P2 (de izquierda a derecha, yendo hacia arriba)
  // El borde SUPERIOR es P0->P3 (de izquierda a derecha)
  
  // Fila 1 (abajo) está cerca de P1-P2
  // Fila 8 (arriba) está cerca de P0-P3
  
  const bottomLeft = P1;   // (629, 977)
  const bottomRight = P2;  // (806, 874)
  const topLeft = P0;      // (566, 866)
  const topRight = P3;     // (770, 745)
  
  console.log('Geometría corregida:');
  console.log(`  Bottom-Left (P1): (${bottomLeft.x.toFixed(0)}, ${bottomLeft.y.toFixed(0)})`);
  console.log(`  Bottom-Right (P2): (${bottomRight.x.toFixed(0)}, ${bottomRight.y.toFixed(0)})`);
  console.log(`  Top-Left (P0): (${topLeft.x.toFixed(0)}, ${topLeft.y.toFixed(0)})`);
  console.log(`  Top-Right (P3): (${topRight.x.toFixed(0)}, ${topRight.y.toFixed(0)})`);
  
  // Ángulo del borde inferior
  const bottomEdge = { x: bottomRight.x - bottomLeft.x, y: bottomRight.y - bottomLeft.y };
  const bottomAngle = Math.atan2(bottomEdge.y, bottomEdge.x) * 180 / Math.PI;
  console.log(`\nBorde inferior (P1->P2): ángulo = ${bottomAngle.toFixed(1)}°`);
  
  // Obtener asientos
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`\nTotal asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s);
  });
  
  const numRows = 8;
  const margin = 0.05;
  
  const updates = [];
  
  for (let row = 1; row <= numRows; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    if (rowSeats.length === 0) continue;
    
    // Ordenar: número más alto primero (derecha en VIP DERECHA)
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber);
    
    // t = 0 para fila 1 (cerca del borde inferior)
    // t = 1 para fila 8 (cerca del borde superior)
    const rawT = (row - 1) / (numRows - 1);
    const t = margin + rawT * (1 - 2 * margin);
    
    // Punto izquierdo de la fila (interpolando bottomLeft -> topLeft)
    const rowLeft = lerp(bottomLeft, topLeft, t);
    
    // Punto derecho de la fila (interpolando bottomRight -> topRight)
    const rowRight = lerp(bottomRight, topRight, t);
    
    // Calcular ángulo de esta fila
    const rowVec = { x: rowRight.x - rowLeft.x, y: rowRight.y - rowLeft.y };
    const rowAngle = Math.atan2(rowVec.y, rowVec.x) * 180 / Math.PI;
    
    console.log(`\nFila ${row}: L(${rowLeft.x.toFixed(0)}, ${rowLeft.y.toFixed(0)}) -> R(${rowRight.x.toFixed(0)}, ${rowRight.y.toFixed(0)}) ángulo=${rowAngle.toFixed(1)}°`);
    
    const seatCount = rowSeats.length;
    const seatMargin = 0.03;
    
    rowSeats.forEach((seat, idx) => {
      // idx=0 -> número más alto (DERECHA)
      // idx=last -> número más bajo (IZQUIERDA)
      const s = seatCount > 1 ? idx / (seatCount - 1) : 0.5;
      const sEff = seatMargin + s * (1 - 2 * seatMargin);
      
      // Interpolar de DERECHA a IZQUIERDA
      const x = rowRight.x + sEff * (rowLeft.x - rowRight.x);
      const y = rowRight.y + sEff * (rowLeft.y - rowRight.y);
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x: Math.round(x), y: Math.round(y) };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
      
      if (idx === 0) console.log(`  ${seat.columnNumber} (DER): (${x.toFixed(0)}, ${y.toFixed(0)})`);
      if (idx === seatCount - 1) console.log(`  ${seat.columnNumber} (IZQ): (${x.toFixed(0)}, ${y.toFixed(0)})`);
    });
  }
  
  console.log(`\nActualizando ${updates.length} asientos...`);
  
  for (const upd of updates) {
    await prisma.seat.update({
      where: { id: upd.id },
      data: { metadata: upd.metadata }
    });
  }
  
  console.log('✅ Completado');
  
  await prisma.$disconnect();
}

main().catch(console.error);
