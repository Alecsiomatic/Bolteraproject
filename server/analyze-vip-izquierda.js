// Ver cómo está configurado VIP IZQUIERDA (el que está bien)
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== VIP IZQUIERDA - ANÁLISIS (REFERENCIA) ===\n');
  
  // Obtener polígono de VIP IZQUIERDA
  const layout = await prisma.venueLayout.findFirst({
    where: { venueId: VENUE_ID, isDefault: true },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(layout.layoutJson);
  const vipIzq = data.sections.find(s => s.name === 'VIP IZQUIERDA');
  
  console.log('Polígono VIP IZQUIERDA:');
  if (vipIzq && vipIzq.polygonPoints) {
    vipIzq.polygonPoints.forEach((p, i) => {
      console.log(`  P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
    });
  }
  
  // Obtener asientos de VIP IZQUIERDA
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-izquierda-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`\nTotal asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const x = meta.canvas?.position?.x;
    const y = meta.canvas?.position?.y;
    
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push({ num: s.columnNumber, x, y });
  });
  
  // Mostrar posiciones por fila
  console.log('\nPosiciones por fila:');
  for (let row = 1; row <= 8; row++) {
    const r = byRow[String(row)];
    if (!r) continue;
    
    r.sort((a, b) => a.num - b.num); // Ordenar por número de asiento
    const first = r[0];
    const last = r[r.length - 1];
    
    // Calcular ángulo de la fila
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    console.log(`Fila ${row}: ${r.length} asientos`);
    console.log(`  Asiento ${first.num} (menor): (${first.x}, ${first.y})`);
    console.log(`  Asiento ${last.num} (mayor): (${last.x}, ${last.y})`);
    console.log(`  Vector: (${dx.toFixed(1)}, ${dy.toFixed(1)}) Ángulo: ${angle.toFixed(1)}°`);
  }
  
  await prisma.$disconnect();
}

main();
