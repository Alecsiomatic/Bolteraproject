// CORRECTO: Regenerar VIP DERECHA con filas paralelas al polígono
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Puntos del polígono VIP DERECHA (en sentido horario desde inferior-izquierda)
// P0: (565.8, 865.5) - Inferior izquierda
// P1: (629.1, 976.8) - Inferior derecha  
// P2: (805.9, 874.4) - Superior derecha
// P3: (770.0, 745.2) - Superior izquierda

// El polígono es un paralelogramo inclinado:
//   P3 -------- P2
//    /          /
//   /          /
//  P0 -------- P1
//
// Las FILAS de asientos deben ser PARALELAS al borde P0->P1 (y P3->P2)
// Fila 1 está cerca del borde inferior (P0-P1)
// Fila 8 está cerca del borde superior (P3-P2)
// 
// Dentro de cada fila, los asientos van de DERECHA a IZQUIERDA
// (número alto a la derecha, número bajo a la izquierda)

const P0 = { x: 565.8, y: 865.5 };  // Inferior izquierda
const P1 = { x: 629.1, y: 976.8 };  // Inferior derecha
const P2 = { x: 805.9, y: 874.4 };  // Superior derecha
const P3 = { x: 770.0, y: 745.2 };  // Superior izquierda

function lerp(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

async function main() {
  console.log('=== REGENERAR VIP DERECHA - PARALELO AL POLÍGONO ===\n');
  
  // Verificar geometría del polígono
  const bottomEdge = { x: P1.x - P0.x, y: P1.y - P0.y };
  const bottomAngle = Math.atan2(bottomEdge.y, bottomEdge.x) * 180 / Math.PI;
  console.log(`Borde inferior (P0->P1): ángulo = ${bottomAngle.toFixed(1)}°`);
  
  const topEdge = { x: P2.x - P3.x, y: P2.y - P3.y };
  const topAngle = Math.atan2(topEdge.y, topEdge.x) * 180 / Math.PI;
  console.log(`Borde superior (P3->P2): ángulo = ${topAngle.toFixed(1)}°`);
  
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
  const margin = 0.06; // 6% margen
  
  const updates = [];
  
  for (let row = 1; row <= numRows; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    if (rowSeats.length === 0) continue;
    
    // Ordenar: número más alto primero (DERECHA)
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber);
    
    // t para interpolar entre borde inferior (fila 1) y superior (fila 8)
    const rawT = (row - 1) / (numRows - 1);
    const t = margin + rawT * (1 - 2 * margin);
    
    // Los puntos de INICIO y FIN de cada fila:
    // - Fila 1 (t=0): de P0 a P1 (borde inferior)
    // - Fila 8 (t=1): de P3 a P2 (borde superior)
    
    // Punto IZQUIERDO de la fila (interpolando P0 -> P3)
    const leftPt = lerp(P0, P3, t);
    
    // Punto DERECHO de la fila (interpolando P1 -> P2)
    const rightPt = lerp(P1, P2, t);
    
    console.log(`\nFila ${row} (t=${t.toFixed(2)}): IZQ(${leftPt.x.toFixed(0)}, ${leftPt.y.toFixed(0)}) -> DER(${rightPt.x.toFixed(0)}, ${rightPt.y.toFixed(0)})`);
    
    // Vector de la fila (de izquierda a derecha)
    const rowVec = { x: rightPt.x - leftPt.x, y: rightPt.y - leftPt.y };
    const rowAngle = Math.atan2(rowVec.y, rowVec.x) * 180 / Math.PI;
    console.log(`  Vector fila: (${rowVec.x.toFixed(1)}, ${rowVec.y.toFixed(1)}) Ángulo: ${rowAngle.toFixed(1)}°`);
    
    const seatCount = rowSeats.length;
    
    rowSeats.forEach((seat, idx) => {
      // idx=0 -> asiento más a la DERECHA (número más alto)
      // idx=last -> asiento más a la IZQUIERDA (número más bajo)
      const s = seatCount > 1 ? idx / (seatCount - 1) : 0.5;
      
      // Interpolar de DERECHA (rightPt) a IZQUIERDA (leftPt) con margen
      const sMargin = 0.04;
      const sEffective = sMargin + s * (1 - 2 * sMargin);
      
      const x = rightPt.x + sEffective * (leftPt.x - rightPt.x);
      const y = rightPt.y + sEffective * (leftPt.y - rightPt.y);
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x: Math.round(x), y: Math.round(y) };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
      
      if (idx === 0) {
        console.log(`  Asiento ${seat.columnNumber} (DER): (${x.toFixed(0)}, ${y.toFixed(0)})`);
      }
      if (idx === seatCount - 1) {
        console.log(`  Asiento ${seat.columnNumber} (IZQ): (${x.toFixed(0)}, ${y.toFixed(0)})`);
      }
    });
  }
  
  console.log(`\nActualizando ${updates.length} asientos...`);
  
  for (const upd of updates) {
    await prisma.seat.update({
      where: { id: upd.id },
      data: { metadata: upd.metadata }
    });
  }
  
  console.log('✅ Posiciones actualizadas correctamente');
  
  await prisma.$disconnect();
}

main().catch(console.error);
