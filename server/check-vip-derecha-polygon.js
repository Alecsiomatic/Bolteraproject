// Ver polígono VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const l = await prisma.venueLayout.findUnique({
    where: { id: '463cd0db-a5f8-43da-b416-b704f0e3fdba' },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(l.layoutJson);
  
  const vipDerecha = data.sections.find(s => s.name === 'VIP DERECHA');
  
  if (vipDerecha) {
    console.log('VIP DERECHA encontrada:');
    console.log('ID:', vipDerecha.id);
    console.log('Polygon:', JSON.stringify(vipDerecha.polygon, null, 2));
    
    if (vipDerecha.polygon && vipDerecha.polygon.points) {
      const points = vipDerecha.polygon.points;
      console.log('\nPuntos del polígono:');
      points.forEach((p, i) => console.log(`  P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
      
      // Calcular bounding box
      const xs = points.map(p => p.x);
      const ys = points.map(p => p.y);
      console.log(`\nBounding box:`);
      console.log(`  X: ${Math.min(...xs).toFixed(1)} - ${Math.max(...xs).toFixed(1)}`);
      console.log(`  Y: ${Math.min(...ys).toFixed(1)} - ${Math.max(...ys).toFixed(1)}`);
    }
  } else {
    console.log('VIP DERECHA no encontrada');
    console.log('Secciones:', data.sections.map(s => s.name));
  }
  
  await prisma.$disconnect();
}
main();
