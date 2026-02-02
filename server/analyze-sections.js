const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';
  
  console.log('='.repeat(80));
  console.log('ANÁLISIS DE SECCIONES Y SU ORDEN ESPACIAL');
  console.log('='.repeat(80));
  
  // Obtener todos los asientos agrupados por sección
  const seats = await prisma.seat.findMany({
    where: { layoutId: LAYOUT_ID },
    select: { sectionName: true, zone: true, x: true, y: true }
  });
  
  console.log('\nTotal asientos:', seats.length);
  
  // Agrupar manualmente
  const sections = {};
  for (const seat of seats) {
    const key = `${seat.zone}|${seat.sectionName}`;
    if (!sections[key]) {
      sections[key] = {
        zone: seat.zone,
        sectionName: seat.sectionName,
        count: 0,
        sumX: 0,
        sumY: 0,
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
      };
    }
    sections[key].count++;
    sections[key].sumX += seat.x;
    sections[key].sumY += seat.y;
    sections[key].minX = Math.min(sections[key].minX, seat.x);
    sections[key].maxX = Math.max(sections[key].maxX, seat.x);
    sections[key].minY = Math.min(sections[key].minY, seat.y);
    sections[key].maxY = Math.max(sections[key].maxY, seat.y);
  }
  
  // Calcular promedios
  const sectionList = Object.values(sections).map(s => ({
    ...s,
    avgX: s.sumX / s.count,
    avgY: s.sumY / s.count
  }));
  
  // Ordenar por zona y luego por Y descendente
  sectionList.sort((a, b) => {
    const zoneOrder = { VIP: 1, PLUS: 2, PREFERENTE: 3 };
    const zoneCompare = (zoneOrder[a.zone] || 99) - (zoneOrder[b.zone] || 99);
    if (zoneCompare !== 0) return zoneCompare;
    return b.avgY - a.avgY; // Y descendente (mayor Y = más cerca del escenario)
  });
  
  console.log('\n📊 SECCIONES ORDENADAS POR ZONA Y POSICIÓN:');
  console.log('=' .repeat(80));
  
  let currentZone = '';
  for (const s of sectionList) {
    if (s.zone !== currentZone) {
      currentZone = s.zone;
      console.log(`\n🔹 ${currentZone}:`);
    }
    console.log(`   ${s.sectionName.padEnd(22)} | ${s.count.toString().padStart(4)} asientos | Centro: X=${s.avgX.toFixed(0).padStart(4)}, Y=${s.avgY.toFixed(0).padStart(4)} | Rango X: ${s.minX.toFixed(0)}-${s.maxX.toFixed(0)} | Rango Y: ${s.minY.toFixed(0)}-${s.maxY.toFixed(0)}`);
  }
  
  // Análisis de orden espacial
  console.log('\n\n📊 ORDEN ESPACIAL (de izquierda a derecha por X promedio):');
  console.log('=' .repeat(80));
  
  const byZone = {};
  for (const s of sectionList) {
    if (!byZone[s.zone]) byZone[s.zone] = [];
    byZone[s.zone].push(s);
  }
  
  for (const [zone, zoneSections] of Object.entries(byZone)) {
    console.log(`\n🔹 ${zone}:`);
    const sortedByX = [...zoneSections].sort((a, b) => a.avgX - b.avgX);
    sortedByX.forEach((s, i) => {
      const position = s.sectionName.includes('Izquierda') ? '(esperado: IZQUIERDA)' :
                       s.sectionName.includes('Central') ? '(esperado: CENTRO)' :
                       s.sectionName.includes('Derecha') ? '(esperado: DERECHA)' : '';
      console.log(`   ${i + 1}. ${s.sectionName.padEnd(22)} | X promedio: ${s.avgX.toFixed(0)} ${position}`);
    });
  }
  
  // Verificación del orden
  console.log('\n\n📊 VERIFICACIÓN DE ORDEN CORRECTO:');
  console.log('=' .repeat(80));
  
  for (const [zone, zoneSections] of Object.entries(byZone)) {
    console.log(`\n🔹 ${zone}:`);
    const sortedByX = [...zoneSections].sort((a, b) => a.avgX - b.avgX);
    
    for (let i = 0; i < sortedByX.length; i++) {
      const s = sortedByX[i];
      let expected = '';
      let status = '❓';
      
      if (sortedByX.length === 3) {
        if (i === 0) expected = 'Izquierda';
        else if (i === 1) expected = 'Central';
        else expected = 'Derecha';
      }
      
      if (expected) {
        if (s.sectionName.includes(expected)) {
          status = '✅';
        } else {
          status = '❌';
        }
      }
      
      console.log(`   ${status} Posición ${i + 1} (X más bajo → más alto): ${s.sectionName} ${expected ? `(se esperaba: ${expected})` : ''}`);
    }
  }
  
  // Verificar filas
  console.log('\n\n📊 VERIFICACIÓN DE FILAS (orden Y - cerca/lejos del escenario):');
  console.log('=' .repeat(80));
  
  // Para VIP Central
  const vipCentralSeats = seats.filter(s => s.sectionName === 'VIP Central');
  const vipRows = {};
  for (const seat of vipCentralSeats) {
    // Agrupar por Y aproximado (filas)
    const yBand = Math.round(seat.y / 10) * 10;
    if (!vipRows[yBand]) vipRows[yBand] = { count: 0, sumY: 0 };
    vipRows[yBand].count++;
    vipRows[yBand].sumY += seat.y;
  }
  
  console.log('\n🔹 VIP Central - Bandas de Y (filas):');
  const vipRowsList = Object.entries(vipRows)
    .map(([y, data]) => ({ y: parseFloat(y), avgY: data.sumY / data.count, count: data.count }))
    .sort((a, b) => b.avgY - a.avgY);
  
  vipRowsList.forEach((r, i) => {
    console.log(`   Fila ${i + 1}: Y promedio = ${r.avgY.toFixed(0)}, ${r.count} asientos`);
  });
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
