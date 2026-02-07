// Ver estructura completa para corregir VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  const layout = await prisma.venueLayout.findFirst({
    where: { venueId: VENUE_ID, isDefault: true },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(layout.layoutJson);
  const vipDer = data.sections.find(s => s.name === 'VIP DERECHA');
  
  console.log('VIP DERECHA - Polígono:');
  const P = vipDer.polygonPoints;
  P.forEach((p, i) => console.log(`P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
  
  // Calcular bordes y ángulos
  console.log('\nBordes:');
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    const dx = P[j].x - P[i].x;
    const dy = P[j].y - P[i].y;
    const len = Math.sqrt(dx*dx + dy*dy);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    console.log(`P${i}->P${j}: (${dx.toFixed(1)}, ${dy.toFixed(1)}) len=${len.toFixed(1)}, angle=${angle.toFixed(1)}°`);
  }
  
  // Identificar qué borde es el "inferior" (donde va fila 1) y "superior" (fila 8)
  // Basándome en VIP IZQUIERDA:
  // - Fila 1 tiene Y alto (~963), Fila 8 tiene Y bajo (~871)
  // - Las filas tienen ángulo -151° (van hacia arriba-izquierda)
  
  // Para VIP DERECHA, necesito encontrar:
  // - El borde con Y más alto (fila 1)
  // - El borde con Y más bajo (fila 8)
  // - La dirección de las filas (paralela a esos bordes)
  
  console.log('\nAnálisis de Y de cada punto:');
  P.forEach((p, i) => console.log(`P${i}: Y = ${p.y.toFixed(1)}`));
  
  // P1 tiene Y=976.8 (más abajo visualmente en canvas)
  // P3 tiene Y=745.2 (más arriba)
  // Entonces el borde P0-P1 y P1-P2 están cerca del "fondo" (Y alto)
  // Y el borde P3-P0 y P2-P3 están cerca de "arriba" (Y bajo)
  
  await prisma.$disconnect();
}

main();
