// Regenerar VIP DERECHA - Filas paralelas a la inclinación del polígono
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Puntos del polígono VIP DERECHA
const P0 = { x: 565.8, y: 865.5 };  // Inferior izquierda
const P1 = { x: 629.1, y: 976.8 };  // Inferior derecha
const P2 = { x: 805.9, y: 874.4 };  // Superior derecha
const P3 = { x: 770.0, y: 745.2 };  // Superior izquierda

// Funciones de vectores
function lerp(a, b, t) {
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

function vectorSub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
function vectorAdd(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
function vectorScale(v, s) { return { x: v.x * s, y: v.y * s }; }
function vectorLen(v) { return Math.sqrt(v.x * v.x + v.y * v.y); }
function vectorNorm(v) { const l = vectorLen(v); return { x: v.x / l, y: v.y / l }; }

async function main() {
  console.log('=== REGENERAR VIP DERECHA - CORRECTAMENTE ===\n');
  
  // Obtener asientos
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`Total asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s);
  });
  
  const numRows = 8;
  const margin = 0.08; // 8% de margen desde los bordes
  
  // Para cada fila:
  // - Fila 1 está cerca del borde inferior (P0-P1)
  // - Fila 8 está cerca del borde superior (P3-P2)
  // - Las filas son PARALELAS entre sí, siguiendo la inclinación del polígono
  
  // Borde izquierdo: P0 -> P3
  // Borde derecho: P1 -> P2
  // Para fila i, interpolamos t = (i-1)/(numRows-1) con margen
  
  const updates = [];
  
  for (let row = 1; row <= numRows; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    if (rowSeats.length === 0) continue;
    
    // Ordenar por número de asiento: mayor primero (derecha a izquierda visualmente)
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber);
    
    // t para interpolar entre borde inferior y superior
    // Con margen para no pegar a los bordes
    const rawT = (row - 1) / (numRows - 1);
    const t = margin + rawT * (1 - 2 * margin);
    
    // Punto en el borde izquierdo del polígono para esta fila
    const leftPoint = lerp(P0, P3, t);
    
    // Punto en el borde derecho del polígono para esta fila
    const rightPoint = lerp(P1, P2, t);
    
    // Vector de la fila (de izquierda a derecha)
    const rowVector = vectorSub(rightPoint, leftPoint);
    const rowLength = vectorLen(rowVector);
    const rowDir = vectorNorm(rowVector);
    
    // Distribuir asientos a lo largo de esta fila
    const seatCount = rowSeats.length;
    const seatMargin = 0.05; // 5% margen en cada extremo de la fila
    const usableLength = rowLength * (1 - 2 * seatMargin);
    const startOffset = rowLength * seatMargin;
    
    console.log(`Fila ${row}: ${seatCount} asientos, L=(${leftPoint.x.toFixed(0)},${leftPoint.y.toFixed(0)}) R=(${rightPoint.x.toFixed(0)},${rightPoint.y.toFixed(0)})`);
    
    rowSeats.forEach((seat, idx) => {
      // idx=0 es el asiento más a la DERECHA (número más alto)
      // idx=last es el asiento más a la IZQUIERDA (número más bajo)
      
      // Posición a lo largo de la fila (0 = derecha, 1 = izquierda)
      const s = seatCount > 1 ? idx / (seatCount - 1) : 0.5;
      
      // Calcular posición: empezar desde rightPoint y moverse hacia leftPoint
      // offset desde rightPoint hacia leftPoint
      const distFromRight = startOffset + s * usableLength;
      
      // Posición final: rightPoint - distFromRight * rowDir (porque rowDir va de izq a der)
      const pos = vectorSub(rightPoint, vectorScale(rowDir, distFromRight));
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x: Math.round(pos.x), y: Math.round(pos.y) };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
    });
  }
  
  console.log(`\nActualizando ${updates.length} asientos...`);
  
  for (const upd of updates) {
    await prisma.seat.update({
      where: { id: upd.id },
      data: { metadata: upd.metadata }
    });
  }
  
  console.log('✅ Posiciones actualizadas');
  
  // Verificación
  console.log('\n=== VERIFICACIÓN ===');
  for (let row = 1; row <= 8; row++) {
    const sample = await prisma.seat.findFirst({
      where: { venueId: VENUE_ID, id: { startsWith: `vip-derecha-${row}-` } },
      select: { columnNumber: true, metadata: true }
    });
    if (sample) {
      const m = JSON.parse(sample.metadata);
      console.log(`Fila ${row}, asiento ${sample.columnNumber}: (${m.canvas.position.x}, ${m.canvas.position.y})`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
