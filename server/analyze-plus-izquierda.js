// Analizar PLUS IZQUIERDA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== ANALIZAR PLUS IZQUIERDA ===\n');
  
  // Obtener polígono
  const layout = await prisma.venueLayout.findFirst({
    where: { venueId: VENUE_ID, isDefault: true },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(layout.layoutJson);
  const plusIzq = data.sections.find(s => s.name === 'PLUS IZQUIERDA');
  
  console.log('Polígono PLUS IZQUIERDA:');
  const P = plusIzq.polygonPoints;
  P.forEach((p, i) => console.log(`  P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
  
  // Calcular bordes
  console.log('\nBordes:');
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    const dx = P[j].x - P[i].x;
    const dy = P[j].y - P[i].y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    console.log(`  P${i}->P${j}: len=${len.toFixed(1)}, angle=${angle.toFixed(1)}°`);
  }
  
  // Ver posiciones actuales
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'plus-izquierda-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`\nTotal asientos: ${seats.length}`);
  
  // Obtener filas únicas
  const rows = [...new Set(seats.map(s => s.rowLabel))].sort();
  console.log(`Filas: ${rows.join(', ')}`);
  
  // Agrupar por fila y ver Y
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    const x = meta.canvas?.position?.x || 0;
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = { count: 0, minY: Infinity, maxY: -Infinity, minX: Infinity, maxX: -Infinity };
    byRow[s.rowLabel].count++;
    byRow[s.rowLabel].minY = Math.min(byRow[s.rowLabel].minY, y);
    byRow[s.rowLabel].maxY = Math.max(byRow[s.rowLabel].maxY, y);
    byRow[s.rowLabel].minX = Math.min(byRow[s.rowLabel].minX, x);
    byRow[s.rowLabel].maxX = Math.max(byRow[s.rowLabel].maxX, x);
  });
  
  console.log('\nPosición por fila (actual):');
  console.log('Fila | Count | Y range     | X range');
  console.log('-----|-------|-------------|------------');
  for (const row of rows) {
    const r = byRow[row];
    if (r) console.log(`  ${row.padEnd(2)} |  ${String(r.count).padStart(2)}   | ${r.minY.toFixed(0).padStart(4)}-${r.maxY.toFixed(0).padEnd(4)} | ${r.minX.toFixed(0).padStart(4)}-${r.maxX.toFixed(0)}`);
  }
  
  // Mostrar cuál fila tiene Y más bajo (arriba) y cuál más alto (abajo)
  let minYRow = null, maxYRow = null;
  let minYVal = Infinity, maxYVal = -Infinity;
  for (const row of rows) {
    const avgY = (byRow[row].minY + byRow[row].maxY) / 2;
    if (avgY < minYVal) { minYVal = avgY; minYRow = row; }
    if (avgY > maxYVal) { maxYVal = avgY; maxYRow = row; }
  }
  
  console.log(`\nFila más ARRIBA (Y bajo): ${minYRow} (Y avg = ${minYVal.toFixed(0)})`);
  console.log(`Fila más ABAJO (Y alto): ${maxYRow} (Y avg = ${maxYVal.toFixed(0)})`);
  console.log(`\nEsperado: A arriba, P abajo`);
  
  await prisma.$disconnect();
}

main();
