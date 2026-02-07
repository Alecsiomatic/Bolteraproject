// Fix PLUS IZQUIERDA - Invertir posiciones Y
// P debe estar ARRIBA (Y bajo), A debe estar ABAJO (Y alto)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== FIX PLUS IZQUIERDA POSITIONS ===\n');
  console.log('Objetivo: P arriba (Y bajo), A abajo (Y alto)\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Obtener las posiciones Y actuales por fila
  const rowData = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!rowData[s.rowLabel]) rowData[s.rowLabel] = { sumY: 0, count: 0, minY: Infinity, maxY: -Infinity };
    rowData[s.rowLabel].sumY += y;
    rowData[s.rowLabel].count++;
    rowData[s.rowLabel].minY = Math.min(rowData[s.rowLabel].minY, y);
    rowData[s.rowLabel].maxY = Math.max(rowData[s.rowLabel].maxY, y);
  });
  
  // Calcular avgY por fila y ordenar
  const rowOrder = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  console.log('\n=== ANTES (actual) ===');
  const currentYAvgs = {};
  for (const row of rowOrder) {
    if (rowData[row]) {
      currentYAvgs[row] = rowData[row].sumY / rowData[row].count;
      console.log(`Fila ${row}: Y avg = ${currentYAvgs[row].toFixed(0)}`);
    }
  }
  
  // Encontrar Y mínimo y máximo global
  const allYAvgs = Object.values(currentYAvgs);
  const minY = Math.min(...allYAvgs); // ~557 (actualmente A, arriba)
  const maxY = Math.max(...allYAvgs); // ~787 (actualmente P, abajo)
  
  console.log(`\nRango Y: ${minY.toFixed(0)} - ${maxY.toFixed(0)}`);
  
  // La inversión: nuevo_y = minY + maxY - viejo_y
  // Si viejo_y = minY (557), nuevo_y = 557 + 787 - 557 = 787
  // Si viejo_y = maxY (787), nuevo_y = 557 + 787 - 787 = 557
  
  console.log('\n=== DESPUÉS (corregido) ===');
  for (const row of rowOrder) {
    const newY = minY + maxY - currentYAvgs[row];
    console.log(`Fila ${row}: Y avg = ${newY.toFixed(0)} ${row === 'P' ? '(ARRIBA)' : row === 'A' ? '(ABAJO)' : ''}`);
  }
  
  // Aplicar cambios
  console.log('\n=== APLICANDO CAMBIOS ===');
  let updated = 0;
  
  for (const seat of seats) {
    let meta = {};
    try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
    
    if (meta.canvas?.position?.y !== undefined) {
      const oldY = meta.canvas.position.y;
      const newY = minY + maxY - oldY;
      
      meta.canvas.position.y = newY;
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(meta) }
      });
      
      updated++;
    }
  }
  
  console.log(`Actualizados: ${updated} asientos`);
  
  // Verificar resultado
  console.log('\n=== VERIFICACIÓN ===');
  const verifySeats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, metadata: true }
  });
  
  const newRowData = {};
  verifySeats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!newRowData[s.rowLabel]) newRowData[s.rowLabel] = { sumY: 0, count: 0 };
    newRowData[s.rowLabel].sumY += y;
    newRowData[s.rowLabel].count++;
  });
  
  for (const row of rowOrder) {
    if (newRowData[row]) {
      const avgY = newRowData[row].sumY / newRowData[row].count;
      console.log(`Fila ${row}: Y avg = ${avgY.toFixed(0)} ${row === 'P' ? '(debe ser ARRIBA ~557)' : row === 'A' ? '(debe ser ABAJO ~787)' : ''}`);
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
