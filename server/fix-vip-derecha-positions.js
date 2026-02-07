// Regenerar posiciones de VIP DERECHA con fila 1 abajo y fila 8 arriba
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

// Polígono VIP DERECHA (necesito obtenerlo del layout)
async function main() {
  console.log('=== REGENERAR POSICIONES VIP DERECHA ===\n');
  
  // Obtener layout para ver el polígono
  const layout = await prisma.venueLayout.findUnique({
    where: { id: LAYOUT_ID },
    select: { layoutJson: true }
  });
  
  const canvasData = JSON.parse(layout.layoutJson);
  
  // Buscar sección VIP DERECHA
  const vipDerecha = canvasData.objects.find(o => 
    o.customType === 'section' && o.label && o.label.toUpperCase().includes('VIP DERECHA')
  );
  
  if (!vipDerecha) {
    console.log('❌ No encontré sección VIP DERECHA en canvas');
    // Listar secciones disponibles
    const sections = canvasData.objects.filter(o => o.customType === 'section');
    console.log('Secciones disponibles:');
    sections.forEach(s => console.log(`  - ${s.label} (${s.id})`));
    await prisma.$disconnect();
    return;
  }
  
  console.log('Polígono VIP DERECHA encontrado:', vipDerecha.id);
  console.log('Points:', JSON.stringify(vipDerecha.points));
  console.log('Left:', vipDerecha.left, 'Top:', vipDerecha.top);
  
  // Calcular puntos absolutos del polígono
  const points = vipDerecha.points.map(p => ({
    x: p.x + vipDerecha.left,
    y: p.y + vipDerecha.top
  }));
  
  console.log('\nPuntos absolutos:');
  points.forEach((p, i) => console.log(`  P${i}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`));
  
  // Encontrar los bordes del polígono
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  
  console.log(`\nBounding box: X(${minX.toFixed(1)}-${maxX.toFixed(1)}), Y(${minY.toFixed(1)}-${maxY.toFixed(1)})`);
  
  // El polígono típicamente tiene forma de paralelogramo inclinado
  // Necesito encontrar: borde inferior (fila 1), borde superior (fila 8)
  // Y distribuir las filas entre ellos
  
  // Para VIP DERECHA, asumo:
  // - El borde inferior derecho es donde va fila 1
  // - El borde superior izquierdo es donde va fila 8
  
  // Obtener asientos actuales
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, rowLabel: true, columnNumber: true, metadata: true }
  });
  
  console.log(`\nTotal asientos: ${seats.length}`);
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s);
  });
  
  // Definir las posiciones de fila 1 (abajo) a fila 8 (arriba)
  // Fila 1 tiene Y más alto (más abajo en canvas), Fila 8 tiene Y más bajo (más arriba)
  
  const rowCount = 8;
  const seatSpacing = 9; // Espacio entre asientos
  const rowSpacing = 11; // Espacio entre filas
  
  // Calcular inclinación del polígono (ángulo)
  // Usando los puntos del polígono para determinar la inclinación
  
  // Punto base: esquina inferior derecha (donde empieza fila 1, asiento más alto)
  // Vamos a usar un enfoque simple: distribuir en el bounding box con inclinación
  
  const baseX = maxX - 30; // Empezar cerca del borde derecho
  const baseY = maxY - 20; // Empezar cerca del borde inferior
  
  // Inclinación: por cada fila que subimos, nos movemos a la izquierda
  const inclinationX = -8; // Mover a la izquierda por fila
  const inclinationY = -12; // Mover arriba por fila
  
  // Inclinación de asientos dentro de la fila
  const seatInclineX = -3; // Por cada asiento, mover a la izquierda
  const seatInclineY = -4; // Por cada asiento, mover arriba
  
  const updates = [];
  
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const rowSeats = byRow[rowStr] || [];
    rowSeats.sort((a, b) => b.columnNumber - a.columnNumber); // Mayor número primero (derecha)
    
    const rowIndex = row - 1; // 0 para fila 1, 7 para fila 8
    
    // Posición base de la fila (fila 1 más abajo, fila 8 más arriba)
    const rowBaseX = baseX + rowIndex * inclinationX;
    const rowBaseY = baseY + rowIndex * inclinationY;
    
    console.log(`Fila ${row}: base (${rowBaseX.toFixed(0)}, ${rowBaseY.toFixed(0)}), ${rowSeats.length} asientos`);
    
    rowSeats.forEach((seat, seatIndex) => {
      const x = rowBaseX + seatIndex * seatInclineX - seatIndex * seatSpacing;
      const y = rowBaseY + seatIndex * seatInclineY;
      
      let meta = {};
      try { meta = JSON.parse(seat.metadata || '{}'); } catch(e) {}
      
      meta.canvas = meta.canvas || {};
      meta.canvas.position = { x, y };
      meta.canvas.size = { width: 7, height: 7 };
      
      updates.push({
        id: seat.id,
        metadata: JSON.stringify(meta)
      });
    });
  }
  
  console.log(`\nActualizando ${updates.length} asientos...`);
  
  // Actualizar en batch
  for (const upd of updates) {
    await prisma.seat.update({
      where: { id: upd.id },
      data: { metadata: upd.metadata }
    });
  }
  
  console.log('✅ Posiciones actualizadas');
  
  await prisma.$disconnect();
}

main().catch(console.error);
