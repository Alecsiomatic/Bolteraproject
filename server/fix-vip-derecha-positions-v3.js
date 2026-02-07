// Regenerar posiciones VIP DERECHA - Siguiendo inclinación del polígono
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Puntos del polígono VIP DERECHA:
// P0: (565.8, 865.5) - esquina izquierda del borde inferior
// P1: (629.1, 976.8) - esquina derecha del borde inferior
// P2: (805.9, 874.4) - esquina derecha del borde superior
// P3: (770.0, 745.2) - esquina izquierda del borde superior

// Las FILAS van paralelas a los bordes superior/inferior del polígono
// Fila 1 está cerca del borde P0-P1 (abajo)
// Fila 8 está cerca del borde P3-P2 (arriba)
// Dentro de cada fila, asientos van de DERECHA (número alto) a IZQUIERDA (número bajo)

async function main() {
  console.log('=== REGENERAR POSICIONES VIP DERECHA ===\n');
  
  // Vértices del polígono
  const P0 = { x: 565.8, y: 865.5 };  // Izquierda inferior
  const P1 = { x: 629.1, y: 976.8 };  // Derecha inferior (ABAJO)
  const P2 = { x: 805.9, y: 874.4 };  // Derecha superior
  const P3 = { x: 770.0, y: 745.2 };  // Izquierda superior (ARRIBA)
  
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
  
  const rowCount = 8;
  const padding = 12; // Margen desde los bordes
  
  const updates = [];
  
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    if (rowSeats.length === 0) continue;
    
    // Ordenar: número más alto primero (DERECHA según Excel)
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber);
    
    // t = 0 para fila 1 (cerca del borde inferior P0-P1)
    // t = 1 para fila 8 (cerca del borde superior P3-P2)
    const t = (row - 1) / (rowCount - 1);
    
    // Punto izquierdo de esta fila (interpolando entre P0 y P3)
    const leftX = P0.x + t * (P3.x - P0.x);
    const leftY = P0.y + t * (P3.y - P0.y);
    
    // Punto derecho de esta fila (interpolando entre P1 y P2)
    const rightX = P1.x + t * (P2.x - P1.x);
    const rightY = P1.y + t * (P2.y - P1.y);
    
    // Aplicar padding
    const rowLeftX = leftX + padding;
    const rowLeftY = leftY;
    const rowRightX = rightX - padding;
    const rowRightY = rightY;
    
    console.log(`Fila ${row}: izq(${rowLeftX.toFixed(0)}, ${rowLeftY.toFixed(0)}) -> der(${rowRightX.toFixed(0)}, ${rowRightY.toFixed(0)})`);
    
    const seatCount = rowSeats.length;
    
    rowSeats.forEach((seat, idx) => {
      // s = 0 para primer asiento (número más alto, a la DERECHA)
      // s = 1 para último asiento (número más bajo, a la IZQUIERDA)
      const s = seatCount > 1 ? idx / (seatCount - 1) : 0.5;
      
      // Interpolar de derecha a izquierda
      const x = rowRightX + s * (rowLeftX - rowRightX);
      const y = rowRightY + s * (rowLeftY - rowRightY);
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x: Math.round(x), y: Math.round(y) };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
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
  
  await prisma.$disconnect();
}

main().catch(console.error);
