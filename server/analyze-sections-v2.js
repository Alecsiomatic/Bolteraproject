const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const LAYOUT_ID = 'ad44b249-13ad-4c51-b1ff-f73ce9b80c9b';
  
  console.log('='.repeat(80));
  console.log('ANÁLISIS DE SECCIONES Y SU ORDEN ESPACIAL');
  console.log('='.repeat(80));
  
  // Obtener todos los asientos con metadata
  const seats = await prisma.seat.findMany({
    where: { layoutId: LAYOUT_ID },
    select: { id: true, label: true, rowLabel: true, metadata: true }
  });
  
  console.log('\nTotal asientos:', seats.length);
  
  // Parsear metadata para extraer sectionName, zone, x, y
  const parsedSeats = seats.map(seat => {
    let meta = {};
    try {
      meta = seat.metadata ? JSON.parse(seat.metadata) : {};
    } catch (e) {}
    
    return {
      id: seat.id,
      label: seat.label,
      rowLabel: seat.rowLabel,
      sectionName: meta.sectionName || meta.canvas?.sectionName || 'Desconocido',
      zone: meta.zone || meta.canvas?.zone || 'Desconocido',
      row: meta.row || meta.canvas?.row || seat.rowLabel || '',
      x: meta.canvas?.x || meta.x || 0,
      y: meta.canvas?.y || meta.y || 0
    };
  });
  
  // Agrupar por sección
  const sections = {};
  for (const seat of parsedSeats) {
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
        maxY: -Infinity,
        rows: new Set()
      };
    }
    sections[key].count++;
    sections[key].sumX += seat.x;
    sections[key].sumY += seat.y;
    sections[key].minX = Math.min(sections[key].minX, seat.x);
    sections[key].maxX = Math.max(sections[key].maxX, seat.x);
    sections[key].minY = Math.min(sections[key].minY, seat.y);
    sections[key].maxY = Math.max(sections[key].maxY, seat.y);
    sections[key].rows.add(seat.row);
  }
  
  // Calcular promedios
  const sectionList = Object.values(sections).map(s => ({
    ...s,
    avgX: s.sumX / s.count,
    avgY: s.sumY / s.count,
    rows: Array.from(s.rows).sort()
  }));
  
  // Ordenar por zona y luego por X
  sectionList.sort((a, b) => {
    const zoneOrder = { VIP: 1, PLUS: 2, PREFERENTE: 3 };
    const zoneCompare = (zoneOrder[a.zone] || 99) - (zoneOrder[b.zone] || 99);
    if (zoneCompare !== 0) return zoneCompare;
    return a.avgX - b.avgX;
  });
  
  console.log('\n📊 SECCIONES ORDENADAS POR ZONA Y POSICIÓN X (izquierda a derecha):');
  console.log('='.repeat(100));
  
  let currentZone = '';
  for (const s of sectionList) {
    if (s.zone !== currentZone) {
      currentZone = s.zone;
      console.log(`\n🔹 ${currentZone}:`);
      console.log('   ' + '-'.repeat(90));
    }
    console.log(`   ${s.sectionName.padEnd(22)} | ${s.count.toString().padStart(4)} asientos | Centro: X=${s.avgX.toFixed(0).padStart(5)}, Y=${s.avgY.toFixed(0).padStart(5)} | X: ${s.minX.toFixed(0)}-${s.maxX.toFixed(0)} | Filas: ${s.rows.join(', ')}`);
  }
  
  // Verificación del orden espacial
  console.log('\n\n📊 VERIFICACIÓN DE ORDEN ESPACIAL:');
  console.log('='.repeat(80));
  
  const byZone = {};
  for (const s of sectionList) {
    if (!byZone[s.zone]) byZone[s.zone] = [];
    byZone[s.zone].push(s);
  }
  
  for (const [zone, zoneSections] of Object.entries(byZone)) {
    console.log(`\n🔹 ${zone}:`);
    const sortedByX = [...zoneSections].sort((a, b) => a.avgX - b.avgX);
    
    for (let i = 0; i < sortedByX.length; i++) {
      const s = sortedByX[i];
      let status = '';
      
      if (sortedByX.length === 3) {
        if (i === 0) {
          status = s.sectionName.toLowerCase().includes('izquierda') ? '✅ CORRECTO' : '❌ INCORRECTO - debería ser Izquierda';
        } else if (i === 1) {
          status = s.sectionName.toLowerCase().includes('central') ? '✅ CORRECTO' : '❌ INCORRECTO - debería ser Central';
        } else {
          status = s.sectionName.toLowerCase().includes('derecha') ? '✅ CORRECTO' : '❌ INCORRECTO - debería ser Derecha';
        }
      }
      
      console.log(`   ${i + 1}. X promedio: ${s.avgX.toFixed(0).padStart(5)} | ${s.sectionName.padEnd(22)} ${status}`);
    }
  }
  
  // Análisis de filas por sección
  console.log('\n\n📊 ANÁLISIS DE FILAS POR SECCIÓN:');
  console.log('='.repeat(80));
  
  for (const s of sectionList) {
    const sectionSeats = parsedSeats.filter(seat => seat.sectionName === s.sectionName && seat.zone === s.zone);
    
    // Agrupar por fila
    const rowGroups = {};
    for (const seat of sectionSeats) {
      if (!rowGroups[seat.row]) {
        rowGroups[seat.row] = { count: 0, sumY: 0, seats: [] };
      }
      rowGroups[seat.row].count++;
      rowGroups[seat.row].sumY += seat.y;
      rowGroups[seat.row].seats.push(seat);
    }
    
    const rowList = Object.entries(rowGroups)
      .map(([row, data]) => ({
        row,
        count: data.count,
        avgY: data.sumY / data.count,
        seatNums: data.seats.map(s => {
          // Extraer número de asiento del label
          const match = s.label.match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        }).sort((a, b) => a - b)
      }))
      .sort((a, b) => b.avgY - a.avgY); // Ordenar por Y descendente (mayor Y = más cerca del escenario)
    
    console.log(`\n🔹 ${s.zone} - ${s.sectionName}:`);
    console.log('   Filas ordenadas de CERCA a LEJOS del escenario (Y alto → Y bajo):');
    
    for (const r of rowList) {
      const minSeat = Math.min(...r.seatNums);
      const maxSeat = Math.max(...r.seatNums);
      console.log(`   Fila ${r.row.toString().padStart(2)} | Y=${r.avgY.toFixed(0).padStart(5)} | ${r.count.toString().padStart(2)} asientos (${minSeat}-${maxSeat})`);
    }
  }
  
  await prisma.$disconnect();
}

main().catch(e => { 
  console.error('Error:', e); 
  process.exit(1); 
});
