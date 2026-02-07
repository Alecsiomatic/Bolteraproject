// Fix PLUS IZQUIERDA - Simple: invertir Y manteniendo estructura
// P ARRIBA (Y más bajo), A ABAJO (Y más alto)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== FIX PLUS IZQUIERDA V3 ===\n');
  
  // Obtener asientos actuales
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Orden correcto de filas: P arriba → A abajo
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  // Obtener Y promedio actual por cada fila
  const currentYByRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!currentYByRow[s.rowLabel]) currentYByRow[s.rowLabel] = { sum: 0, count: 0 };
    currentYByRow[s.rowLabel].sum += y;
    currentYByRow[s.rowLabel].count++;
  });
  
  console.log('\n=== ESTADO ACTUAL ===');
  for (const row of rowOrder) {
    if (currentYByRow[row]) {
      const avgY = currentYByRow[row].sum / currentYByRow[row].count;
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)}`);
    }
  }
  
  // Definir las posiciones Y correctas para cada fila
  // Usando un rango similar al original pero invertido
  const startY = 557;  // Y para P (arriba)
  const endY = 787;    // Y para A (abajo)
  const numRows = rowOrder.length;
  const rowSpacing = (endY - startY) / (numRows - 1);
  
  // Crear mapeo de fila -> nuevo Y base
  const targetYByRow = {};
  rowOrder.forEach((row, idx) => {
    targetYByRow[row] = startY + idx * rowSpacing;
  });
  
  console.log('\n=== OBJETIVO ===');
  for (const row of rowOrder) {
    console.log(`Fila ${row}: Y objetivo = ${targetYByRow[row].toFixed(0)}`);
  }
  
  // Ahora, para cada asiento, calcular el desplazamiento relativo dentro de su fila
  // y aplicar ese mismo desplazamiento pero con el nuevo Y base
  
  // Agrupar asientos por fila
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({ ...s, meta, x: meta.canvas?.position?.x || 0, y: meta.canvas?.position?.y || 0 });
  });
  
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (const row of rowOrder) {
    const rowSeats = byRow[row] || [];
    if (rowSeats.length === 0) continue;
    
    // Calcular Y promedio actual y el objetivo
    const currentAvgY = currentYByRow[row].sum / currentYByRow[row].count;
    const targetAvgY = targetYByRow[row];
    
    // El desplazamiento a aplicar
    const deltaY = targetAvgY - currentAvgY;
    
    for (const seat of rowSeats) {
      // Nuevo Y = Y actual + delta
      const newY = seat.y + deltaY;
      
      seat.meta.canvas = seat.meta.canvas || { position: {} };
      seat.meta.canvas.position.y = newY;
      // Mantener X igual
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      
      updated++;
    }
    
    console.log(`Fila ${row}: deltaY = ${deltaY.toFixed(0)}, ${rowSeats.length} asientos`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== VERIFICACIÓN FINAL ===');
  const verifySeats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const finalYByRow = {};
  verifySeats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!finalYByRow[s.rowLabel]) finalYByRow[s.rowLabel] = { sum: 0, count: 0 };
    finalYByRow[s.rowLabel].sum += y;
    finalYByRow[s.rowLabel].count++;
  });
  
  for (const row of rowOrder) {
    if (finalYByRow[row]) {
      const avgY = finalYByRow[row].sum / finalYByRow[row].count;
      const label = row === 'P' ? '(ARRIBA)' : row === 'A' ? '(ABAJO)' : '';
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)} ${label}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
