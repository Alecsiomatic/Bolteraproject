// Analizar y corregir VIP CENTRAL
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== ANALIZAR VIP CENTRAL ===\n');
  
  // Obtener polígono
  const layout = await prisma.venueLayout.findFirst({
    where: { venueId: VENUE_ID, isDefault: true },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(layout.layoutJson);
  const vipCentral = data.sections.find(s => s.name === 'VIP CENTRAL');
  
  console.log('Polígono VIP CENTRAL:');
  const P = vipCentral.polygonPoints;
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
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-central-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`\nTotal asientos: ${seats.length}`);
  
  // Agrupar por fila y ver Y
  const byRow = {};
  seats.forEach(s => {
    let meta = {};
    try { meta = JSON.parse(s.metadata || '{}'); } catch(e) {}
    const y = meta.canvas?.position?.y || 0;
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = { minY: Infinity, maxY: -Infinity };
    byRow[s.rowLabel].minY = Math.min(byRow[s.rowLabel].minY, y);
    byRow[s.rowLabel].maxY = Math.max(byRow[s.rowLabel].maxY, y);
  });
  
  console.log('\nPosición Y por fila (actual):');
  for (let row = 1; row <= 8; row++) {
    const r = byRow[String(row)];
    if (r) console.log(`  Fila ${row}: Y = ${r.minY.toFixed(0)} - ${r.maxY.toFixed(0)}`);
  }
  
  await prisma.$disconnect();
}

main();
