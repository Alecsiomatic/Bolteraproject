// Regenerar posiciones VIP DERECHA - Fila 1 abajo, Fila 8 arriba
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Puntos del polígono VIP DERECHA:
// P0: (565.8, 865.5) - esquina inferior izquierda
// P1: (629.1, 976.8) - esquina inferior derecha (ABAJO - fila 1)
// P2: (805.9, 874.4) - esquina superior derecha
// P3: (770.0, 745.2) - esquina superior izquierda (ARRIBA - fila 8)

// Borde inferior (fila 1): de P0 a P1
// Borde superior (fila 8): de P3 a P2 
// El polígono tiene inclinación - derecha a izquierda, arriba a abajo

async function main() {
  console.log('=== REGENERAR POSICIONES VIP DERECHA ===\n');
  
  // Obtener asientos
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s);
  });
  
  // Contar asientos por fila para saber distribución
  console.log('\nAsientos por fila:');
  for (let row = 1; row <= 8; row++) {
    const r = byRow[String(row)] || [];
    r.sort((a, b) => b.columnNumber - a.columnNumber); // Mayor a menor (derecha a izquierda)
    console.log(`  Fila ${row}: ${r.length} asientos (${r[0]?.columnNumber}-${r[r.length-1]?.columnNumber})`);
  }
  
  // Definir los 4 vértices del polígono
  const bottomLeft = { x: 565.8, y: 865.5 };   // P0
  const bottomRight = { x: 629.1, y: 976.8 };  // P1 - ABAJO DERECHA (fila 1 empieza aquí)
  const topRight = { x: 805.9, y: 874.4 };     // P2
  const topLeft = { x: 770.0, y: 745.2 };      // P3 - ARRIBA (fila 8)
  
  // Calcular vectores para interpolar entre filas
  // Fila 1 está en el borde inferior (bottomLeft-bottomRight)
  // Fila 8 está en el borde superior (topLeft-topRight)
  
  const rowCount = 8;
  const padding = 15; // Margen desde los bordes
  
  const updates = [];
  
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    if (rowSeats.length === 0) continue;
    
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber); // Mayor número primero (DERECHA)
    
    // t = 0 para fila 1 (abajo), t = 1 para fila 8 (arriba)
    const t = (row - 1) / (rowCount - 1);
    
    // Interpolar entre borde inferior y superior
    // Punto inicial de la fila (lado derecho del polígono)
    const rowStartX = bottomRight.x + t * (topRight.x - bottomRight.x);
    const rowStartY = bottomRight.y + t * (topRight.y - bottomRight.y);
    
    // Punto final de la fila (lado izquierdo del polígono)
    const rowEndX = bottomLeft.x + t * (topLeft.x - bottomLeft.x);
    const rowEndY = bottomLeft.y + t * (topLeft.y - bottomLeft.y);
    
    console.log(`\nFila ${row} (t=${t.toFixed(2)}): start(${rowStartX.toFixed(0)}, ${rowStartY.toFixed(0)}) -> end(${rowEndX.toFixed(0)}, ${rowEndY.toFixed(0)})`);
    
    // Distribuir asientos a lo largo de esta línea
    const seatCount = rowSeats.length;
    
    rowSeats.forEach((seat, idx) => {
      // s = 0 para el primer asiento (derecha), s = 1 para el último (izquierda)
      const s = seatCount > 1 ? idx / (seatCount - 1) : 0;
      
      // Interpolar con padding
      const effectiveStartX = rowStartX - padding;
      const effectiveStartY = rowStartY - padding;
      const effectiveEndX = rowEndX + padding;
      const effectiveEndY = rowEndY + padding;
      
      const x = effectiveStartX + s * (effectiveEndX - effectiveStartX);
      const y = effectiveStartY + s * (effectiveEndY - effectiveStartY);
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x: Math.round(x), y: Math.round(y) };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
      
      if (idx === 0 || idx === seatCount - 1) {
        console.log(`  Asiento ${seat.columnNumber}: (${x.toFixed(0)}, ${y.toFixed(0)})`);
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
  
  console.log('✅ Posiciones actualizadas');
  
  // Verificar resultado
  console.log('\n=== VERIFICACIÓN ===');
  const check = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-1-' } },
    select: { columnNumber: true, metadata: true },
    take: 3
  });
  
  check.forEach(s => {
    const m = JSON.parse(s.metadata);
    console.log(`Fila 1, asiento ${s.columnNumber}: (${m.canvas.position.x}, ${m.canvas.position.y})`);
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
