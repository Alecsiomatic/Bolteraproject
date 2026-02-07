// Fix PLUS IZQUIERDA - Recalcular posiciones correctamente
// P ARRIBA (Y más bajo), A ABAJO (Y más alto)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

async function main() {
  console.log('=== FIX PLUS IZQUIERDA V2 ===\n');
  
  // Obtener el polígono de PLUS IZQUIERDA
  const section = await prisma.section.findFirst({
    where: { layoutId: LAYOUT_ID, name: 'PLUS IZQUIERDA' }
  });
  
  if (!section) {
    console.log('ERROR: No se encontró la sección PLUS IZQUIERDA');
    return;
  }
  
  let polygon = [];
  try {
    const meta = JSON.parse(section.metadata || '{}');
    polygon = meta.canvas?.polygon || [];
  } catch(e) {}
  
  console.log('Polígono PLUS IZQUIERDA:', JSON.stringify(polygon));
  
  // Orden de filas: P arriba (cerca del escenario), A abajo (lejos)
  // En el canvas: Y bajo = arriba, Y alto = abajo
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  const numRows = rowOrder.length; // 16 filas
  
  // Obtener asientos actuales
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Analizar las posiciones X actuales (mantener el ángulo)
  // Agrupar por fila para obtener las X
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const x = meta.canvas?.position?.x || 0;
    const y = meta.canvas?.position?.y || 0;
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({ ...s, x, y, meta });
  });
  
  // Encontrar el rango de posiciones de una fila para entender el ángulo
  // Usar la fila M que tiene 31 asientos (la más ancha)
  const filaM = byRow['M'] || [];
  if (filaM.length > 0) {
    filaM.sort((a, b) => a.columnNumber - b.columnNumber);
    const firstSeat = filaM[0];
    const lastSeat = filaM[filaM.length - 1];
    console.log(`\nFila M (referencia):`);
    console.log(`  Asiento 1: X=${firstSeat.x.toFixed(0)}, Y=${firstSeat.y.toFixed(0)}`);
    console.log(`  Asiento ${lastSeat.columnNumber}: X=${lastSeat.x.toFixed(0)}, Y=${lastSeat.y.toFixed(0)}`);
    
    // Calcular el ángulo de la fila
    const dx = lastSeat.x - firstSeat.x;
    const dy = lastSeat.y - firstSeat.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    console.log(`  Ángulo: ${angle.toFixed(1)}°`);
  }
  
  // Definir el área para las filas
  // Basándome en el polígono, necesito distribuir las 16 filas
  // P arriba (Y bajo) → A abajo (Y alto)
  
  // Encontrar los bounds del polígono
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  console.log(`\nBounds del polígono:`);
  console.log(`  X: ${minX.toFixed(0)} - ${maxX.toFixed(0)}`);
  console.log(`  Y: ${minY.toFixed(0)} - ${maxY.toFixed(0)}`);
  
  // Distribuir las filas uniformemente en Y
  // Fila P (índice 0) → Y más bajo (arriba)
  // Fila A (índice 15) → Y más alto (abajo)
  const padding = 10;
  const startY = minY + padding;  // Y para fila P (arriba)
  const endY = maxY - padding;    // Y para fila A (abajo)
  const rowSpacing = (endY - startY) / (numRows - 1);
  
  console.log(`\nDistribución de filas:`);
  console.log(`  Fila P (arriba): Y = ${startY.toFixed(0)}`);
  console.log(`  Fila A (abajo): Y = ${endY.toFixed(0)}`);
  console.log(`  Espaciado: ${rowSpacing.toFixed(1)}`);
  
  // Calcular las nuevas posiciones
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (let rowIdx = 0; rowIdx < rowOrder.length; rowIdx++) {
    const rowLabel = rowOrder[rowIdx];
    const rowSeats = byRow[rowLabel] || [];
    
    if (rowSeats.length === 0) continue;
    
    // Calcular Y base para esta fila
    const baseY = startY + rowIdx * rowSpacing;
    
    // Ordenar asientos por columnNumber
    rowSeats.sort((a, b) => a.columnNumber - b.columnNumber);
    
    // Obtener el desplazamiento X actual de la fila (mantener la forma)
    // Asiento 1 debe estar a la derecha (X mayor) porque es "DERECHA A IZQ"
    // Pero también debo considerar el ángulo del polígono
    
    // Calcular el ancho que necesitamos para esta fila
    const seatSpacing = 10; // espaciado entre asientos
    const numSeats = rowSeats.length;
    const rowWidth = (numSeats - 1) * seatSpacing;
    
    // El polígono tiene forma de trapecio inclinado
    // Las filas de arriba (P) son más cortas, las de abajo (A) más anchas
    // Calcular la X inicial basada en la posición Y en el polígono
    
    // Interpolar entre los bordes izquierdo y derecho del polígono
    const t = rowIdx / (numRows - 1); // 0 para P, 1 para A
    
    // Para sección izquierda, el asiento 1 está a la derecha (mayor X)
    // El ángulo del polígono es ~30° (inclinado hacia arriba-derecha)
    
    // Punto de referencia: usar el centro X del polígono
    const centerX = (minX + maxX) / 2;
    
    // Calcular X start considerando que las filas de arriba son más cortas
    // y están más a la derecha
    const widthFactor = 0.6 + 0.4 * t; // filas de arriba más cortas
    const effectiveWidth = rowWidth * widthFactor;
    
    // Ajuste para el ángulo del polígono (~30°)
    const angleRad = 30 * Math.PI / 180;
    const xOffset = rowIdx * rowSpacing * Math.tan(angleRad) * 0.3;
    
    const startX = centerX + effectiveWidth / 2 - xOffset;
    
    // Actualizar cada asiento
    for (let seatIdx = 0; seatIdx < rowSeats.length; seatIdx++) {
      const seat = rowSeats[seatIdx];
      
      // Dirección DERECHA A IZQ: asiento 1 está a la derecha (X mayor)
      const seatX = startX - seatIdx * seatSpacing;
      
      // Pequeño ajuste Y por el ángulo de las filas
      const seatY = baseY + seatIdx * 0.5; // ligera inclinación
      
      seat.meta.canvas = seat.meta.canvas || { position: {} };
      seat.meta.canvas.position = { x: seatX, y: seatY };
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      
      updated++;
    }
    
    console.log(`Fila ${rowLabel}: ${rowSeats.length} asientos, Y base = ${baseY.toFixed(0)}`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  const verifySeats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, columnNumber: true, metadata: true },
    orderBy: [{ rowLabel: 'asc' }, { columnNumber: 'asc' }]
  });
  
  // Mostrar algunos ejemplos
  for (const row of ['P', 'A']) {
    const rowSeats = verifySeats.filter(s => s.rowLabel === row).sort((a, b) => a.columnNumber - b.columnNumber);
    const first = rowSeats[0];
    const last = rowSeats[rowSeats.length - 1];
    
    let firstMeta = {};
    let lastMeta = {};
    try { firstMeta = JSON.parse(first.metadata); } catch(e) {}
    try { lastMeta = JSON.parse(last.metadata); } catch(e) {}
    
    console.log(`Fila ${row}:`);
    console.log(`  Asiento 1: X=${firstMeta.canvas?.position?.x?.toFixed(0)}, Y=${firstMeta.canvas?.position?.y?.toFixed(0)}`);
    console.log(`  Asiento ${last.columnNumber}: X=${lastMeta.canvas?.position?.x?.toFixed(0)}, Y=${lastMeta.canvas?.position?.y?.toFixed(0)}`);
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
