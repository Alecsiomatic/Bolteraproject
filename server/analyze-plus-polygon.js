// Analizar polígono de PLUS IZQUIERDA
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const layouts = await prisma.venueLayout.findMany({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b' }
  });
  
  for (const layout of layouts) {
    let meta = {};
    try { meta = JSON.parse(layout.metadata || '{}'); } catch(e) {}
    const sections = meta.sections || [];
    const plusIzq = sections.find(s => s.name === 'PLUS IZQUIERDA');
    if (plusIzq) {
      console.log('=== PLUS IZQUIERDA POLYGON ===');
      console.log(JSON.stringify(plusIzq.polygon, null, 2));
      
      // Analizar el polígono
      const poly = plusIzq.polygon;
      if (poly && poly.length > 0) {
        console.log('\n=== ANÁLISIS DEL POLÍGONO ===');
        for (let i = 0; i < poly.length; i++) {
          console.log(`P${i}: x=${poly[i].x.toFixed(1)}, y=${poly[i].y.toFixed(1)}`);
        }
        
        // Encontrar bounds
        const xs = poly.map(p => p.x);
        const ys = poly.map(p => p.y);
        console.log(`\nBounds: X[${Math.min(...xs).toFixed(0)}, ${Math.max(...xs).toFixed(0)}] Y[${Math.min(...ys).toFixed(0)}, ${Math.max(...ys).toFixed(0)}]`);
      }
    }
  }
  
  await prisma.$disconnect();
}
main();
