// Análisis geométrico del polígono VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Puntos del polígono VIP DERECHA:
const P0 = { x: 565.8, y: 865.5 };  // Esquina A
const P1 = { x: 629.1, y: 976.8 };  // Esquina B
const P2 = { x: 805.9, y: 874.4 };  // Esquina C
const P3 = { x: 770.0, y: 745.2 };  // Esquina D

function vectorSubtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y };
}

function vectorLength(v) {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vectorNormalize(v) {
  const len = vectorLength(v);
  return { x: v.x / len, y: v.y / len };
}

function vectorDot(a, b) {
  return a.x * b.x + a.y * b.y;
}

async function main() {
  console.log('=== ANÁLISIS GEOMÉTRICO VIP DERECHA ===\n');
  
  // Calcular los 4 bordes del polígono
  const edgeBottom = vectorSubtract(P1, P0);  // Borde inferior (P0 -> P1)
  const edgeRight = vectorSubtract(P2, P1);   // Borde derecho (P1 -> P2)
  const edgeTop = vectorSubtract(P3, P2);     // Borde superior (P2 -> P3)
  const edgeLeft = vectorSubtract(P0, P3);    // Borde izquierdo (P3 -> P0)
  
  console.log('Puntos del polígono:');
  console.log(`  P0 (inf-izq): (${P0.x.toFixed(1)}, ${P0.y.toFixed(1)})`);
  console.log(`  P1 (inf-der): (${P1.x.toFixed(1)}, ${P1.y.toFixed(1)})`);
  console.log(`  P2 (sup-der): (${P2.x.toFixed(1)}, ${P2.y.toFixed(1)})`);
  console.log(`  P3 (sup-izq): (${P3.x.toFixed(1)}, ${P3.y.toFixed(1)})`);
  
  console.log('\nVectores de los bordes:');
  console.log(`  Borde inferior (P0->P1): (${edgeBottom.x.toFixed(1)}, ${edgeBottom.y.toFixed(1)}) len=${vectorLength(edgeBottom).toFixed(1)}`);
  console.log(`  Borde derecho (P1->P2): (${edgeRight.x.toFixed(1)}, ${edgeRight.y.toFixed(1)}) len=${vectorLength(edgeRight).toFixed(1)}`);
  console.log(`  Borde superior (P2->P3): (${edgeTop.x.toFixed(1)}, ${edgeTop.y.toFixed(1)}) len=${vectorLength(edgeTop).toFixed(1)}`);
  console.log(`  Borde izquierdo (P3->P0): (${edgeLeft.x.toFixed(1)}, ${edgeLeft.y.toFixed(1)}) len=${vectorLength(edgeLeft).toFixed(1)}`);
  
  // Ángulos de los bordes
  const angleBottom = Math.atan2(edgeBottom.y, edgeBottom.x) * 180 / Math.PI;
  const angleTop = Math.atan2(-edgeTop.y, -edgeTop.x) * 180 / Math.PI;  // Invertido porque va en sentido contrario
  
  console.log('\nÁngulos:');
  console.log(`  Borde inferior: ${angleBottom.toFixed(1)}°`);
  console.log(`  Borde superior: ${angleTop.toFixed(1)}°`);
  
  // Las filas deben ser PARALELAS a los bordes inferior/superior
  // Usar el promedio de ambos ángulos para la inclinación de las filas
  const avgAngle = (angleBottom + angleTop) / 2;
  console.log(`  Ángulo promedio para filas: ${avgAngle.toFixed(1)}°`);
  
  // Vector de dirección de las filas (paralelo al borde)
  const rowDir = vectorNormalize(edgeBottom);
  console.log(`\nVector dirección de filas: (${rowDir.x.toFixed(3)}, ${rowDir.y.toFixed(3)})`);
  
  // Vector perpendicular (dirección entre filas, hacia "arriba" del polígono)
  // Rotar 90° en sentido antihorario: (x,y) -> (-y, x)
  const perpDir = { x: -rowDir.y, y: rowDir.x };
  console.log(`Vector perpendicular (entre filas): (${perpDir.x.toFixed(3)}, ${perpDir.y.toFixed(3)})`);
  
  // Calcular la "altura" del polígono en dirección perpendicular
  // Proyectar P3 (o P2) sobre la línea perpendicular desde P0
  const toP3 = vectorSubtract(P3, P0);
  const heightProjection = vectorDot(toP3, perpDir);
  console.log(`\nAltura del polígono (en dirección perp): ${heightProjection.toFixed(1)}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
