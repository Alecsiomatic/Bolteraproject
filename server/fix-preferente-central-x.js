// Fix PREFERENTE CENTRAL - Invertir orden X en cada fila
// El asiento con número menor debe estar a la DERECHA (X mayor)
// El asiento con número mayor debe estar a la IZQUIERDA (X menor)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== INVERTIR ORDEN X EN PREFERENTE CENTRAL ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-central-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    byRow[s.rowLabel].push({
      id: s.id,
      columnNumber: s.columnNumber,
      x: meta.canvas?.position?.x || 0,
      y: meta.canvas?.position?.y || 0,
      meta
    });
  });
  
  const ROW_ORDER = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  
  console.log('\n=== ANTES ===');
  // Mostrar ejemplo de fila A antes
  const filaA = byRow['A'];
  if (filaA) {
    filaA.sort((a, b) => a.columnNumber - b.columnNumber);
    console.log(`Fila A: asiento ${filaA[0].columnNumber} X=${filaA[0].x.toFixed(0)}, asiento ${filaA[filaA.length-1].columnNumber} X=${filaA[filaA.length-1].x.toFixed(0)}`);
    
    // Verificar si está invertido: número menor debería tener X mayor (derecha)
    if (filaA[0].x < filaA[filaA.length-1].x) {
      console.log('  → INCORRECTO: número menor tiene X menor (está a la izquierda)');
    } else {
      console.log('  → CORRECTO: número menor tiene X mayor (está a la derecha)');
    }
  }
  
  console.log('\n=== INVIRTIENDO X EN CADA FILA ===');
  let updated = 0;
  
  for (const row of ROW_ORDER) {
    const rowSeats = byRow[row];
    if (!rowSeats || rowSeats.length === 0) continue;
    
    // Ordenar por columnNumber
    rowSeats.sort((a, b) => a.columnNumber - b.columnNumber);
    
    // Obtener todas las posiciones X ordenadas de menor a mayor
    const xPositions = rowSeats.map(s => s.x).sort((a, b) => a - b);
    
    // Asignar: el asiento con número menor obtiene la X mayor (derecha)
    // Asiento con número mayor obtiene la X menor (izquierda)
    for (let i = 0; i < rowSeats.length; i++) {
      const seat = rowSeats[i];
      // Invertir: índice 0 (menor número) obtiene xPositions[length-1] (mayor X)
      const newX = xPositions[rowSeats.length - 1 - i];
      
      seat.meta.canvas = seat.meta.canvas || { position: {} };
      seat.meta.canvas.position.x = newX;
      // Mantener Y igual
      
      await prisma.seat.update({
        where: { id: seat.id },
        data: { metadata: JSON.stringify(seat.meta) }
      });
      updated++;
    }
    
    console.log(`Fila ${row}: invertida (${rowSeats.length} asientos)`);
  }
  
  console.log(`\nTotal actualizados: ${updated}`);
  
  // Verificación
  console.log('\n=== DESPUÉS ===');
  const verifySeats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'preferente-central-A-' } },
    select: { columnNumber: true, metadata: true }
  });
  
  verifySeats.sort((a, b) => a.columnNumber - b.columnNumber);
  if (verifySeats.length > 0) {
    const first = verifySeats[0];
    const last = verifySeats[verifySeats.length - 1];
    let fm = {}, lm = {};
    try { fm = JSON.parse(first.metadata); lm = JSON.parse(last.metadata); } catch(e) {}
    console.log(`Fila A: asiento ${first.columnNumber} X=${fm.canvas?.position?.x?.toFixed(0)}, asiento ${last.columnNumber} X=${lm.canvas?.position?.x?.toFixed(0)}`);
    
    if (fm.canvas?.position?.x > lm.canvas?.position?.x) {
      console.log('  → CORRECTO: número menor tiene X mayor (está a la derecha)');
    }
  }
  
  await prisma.$disconnect();
  console.log('\n✅ COMPLETADO');
}

main().catch(console.error);
