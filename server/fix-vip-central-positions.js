// CORREGIR VIP CENTRAL - Fila 1 abajo, Fila 8 arriba
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono VIP CENTRAL:
// P0: (813.7, 717.7) - Superior izquierda
// P1: (1032.1, 717.2) - Superior derecha
// P2: (997.9, 851.1) - Inferior derecha
// P3: (846.0, 851.1) - Inferior izquierda

// El polígono es un trapecio:
//   P0 -------- P1  (arriba, Y ~717)
//    \          /
//     \        /
//      P3 ---- P2   (abajo, Y ~851)

// Fila 1 debe estar ABAJO (cerca de P2-P3, Y alto ~851)
// Fila 8 debe estar ARRIBA (cerca de P0-P1, Y bajo ~717)

const P0 = { x: 813.7, y: 717.7 };  // Superior izquierda
const P1 = { x: 1032.1, y: 717.2 }; // Superior derecha
const P2 = { x: 997.9, y: 851.1 };  // Inferior derecha
const P3 = { x: 846.0, y: 851.1 };  // Inferior izquierda

function lerp(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

async function main() {
  console.log('=== CORREGIR VIP CENTRAL ===\n');
  
  // Definir esquinas
  const bottomLeft = P3;   // (846, 851)
  const bottomRight = P2;  // (998, 851)
  const topLeft = P0;      // (814, 718)
  const topRight = P1;     // (1032, 717)
  
  console.log('Geometría:');
  console.log(`  Bottom-Left (P3): (${bottomLeft.x.toFixed(0)}, ${bottomLeft.y.toFixed(0)})`);
  console.log(`  Bottom-Right (P2): (${bottomRight.x.toFixed(0)}, ${bottomRight.y.toFixed(0)})`);
  console.log(`  Top-Left (P0): (${topLeft.x.toFixed(0)}, ${topLeft.y.toFixed(0)})`);
  console.log(`  Top-Right (P1): (${topRight.x.toFixed(0)}, ${topRight.y.toFixed(0)})`);
  
  // Obtener asientos
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-central-' } },
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
    
    // Ordenar: número más alto primero (derecha)
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber);
    
    // t = 0 para fila 1 (ABAJO), t = 1 para fila 8 (ARRIBA)
    const rawT = (row - 1) / (numRows - 1);
    const t = margin + rawT * (1 - 2 * margin);
    
    // Punto izquierdo de la fila (bottomLeft -> topLeft)
    const rowLeft = lerp(bottomLeft, topLeft, t);
    
    // Punto derecho de la fila (bottomRight -> topRight)
    const rowRight = lerp(bottomRight, topRight, t);
    
    console.log(`\nFila ${row}: L(${rowLeft.x.toFixed(0)}, ${rowLeft.y.toFixed(0)}) -> R(${rowRight.x.toFixed(0)}, ${rowRight.y.toFixed(0)})`);
    
    const seatCount = rowSeats.length;
    const seatMargin = 0.03;
    
    rowSeats.forEach((seat, idx) => {
      // idx=0 -> número más alto (DERECHA)
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
  
  console.log('✅ VIP CENTRAL corregido');
  
  await prisma.$disconnect();
}

main().catch(console.error);
