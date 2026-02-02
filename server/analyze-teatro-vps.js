const fs = require('fs');

const data = JSON.parse(fs.readFileSync('teatro-layout.json', 'utf8'));

console.log('='.repeat(80));
console.log('ANÁLISIS DEL TEATRO DE LA CIUDAD - VPS');
console.log('='.repeat(80));

console.log('\n📊 VENUE INFO:');
console.log('  ID:', data.id);
console.log('  Name:', data.name);
console.log('  layoutVersion:', data.layoutVersion);

if (data.layoutJson) {
  let layout;
  try {
    layout = typeof data.layoutJson === 'string' ? JSON.parse(data.layoutJson) : data.layoutJson;
  } catch(e) {
    layout = data.layoutJson;
  }
  
  console.log('\n📊 LAYOUT JSON:');
  console.log('  Keys:', Object.keys(layout));
  
  // Sections
  if (layout.sections && layout.sections.length > 0) {
    console.log('\n📍 SECTIONS:', layout.sections.length);
    
    // Ordenar por posición Y (de arriba hacia abajo en el canvas)
    const sortedSections = [...layout.sections].sort((a, b) => {
      const avgYa = a.polygonPoints ? a.polygonPoints.reduce((s, p) => s + p.y, 0) / a.polygonPoints.length : 0;
      const avgYb = b.polygonPoints ? b.polygonPoints.reduce((s, p) => s + p.y, 0) / b.polygonPoints.length : 0;
      return avgYa - avgYb;
    });
    
    sortedSections.forEach((s, i) => {
      console.log(`\n  ${i + 1}. ${s.name}`);
      console.log(`     ID: ${s.id}`);
      if (s.zone) console.log(`     Zone: ${s.zone}`);
      if (s.color) console.log(`     Color: ${s.color}`);
      if (s.capacity) console.log(`     Capacity: ${s.capacity}`);
      
      if (s.polygonPoints && s.polygonPoints.length > 0) {
        console.log(`     Polígono: ${s.polygonPoints.length} puntos`);
        const avgX = s.polygonPoints.reduce((sum, p) => sum + p.x, 0) / s.polygonPoints.length;
        const avgY = s.polygonPoints.reduce((sum, p) => sum + p.y, 0) / s.polygonPoints.length;
        console.log(`     Centro: X=${avgX.toFixed(0)}, Y=${avgY.toFixed(0)}`);
        
        // Mostrar los puntos del polígono
        console.log(`     Puntos:`);
        s.polygonPoints.forEach((p, j) => {
          console.log(`       ${j + 1}. X=${p.x.toFixed(0)}, Y=${p.y.toFixed(0)}`);
        });
      }
    });
  }
  
  // Zones
  if (layout.zones && layout.zones.length > 0) {
    console.log('\n📍 ZONES:', layout.zones.length);
    layout.zones.forEach((z, i) => {
      console.log(`  ${i + 1}. ${z.name} | color: ${z.color}`);
    });
  }
  
  // Canvas objects
  if (layout.canvas && layout.canvas.objects) {
    const types = {};
    layout.canvas.objects.forEach(o => {
      types[o.type] = (types[o.type] || 0) + 1;
    });
    console.log('\n📍 CANVAS OBJECTS:', layout.canvas.objects.length);
    console.log('  Tipos:', JSON.stringify(types));
  }
}

// Resumen de orden espacial
console.log('\n\n' + '='.repeat(80));
console.log('RESUMEN DE ORDEN ESPACIAL');
console.log('='.repeat(80));

if (data.layoutJson) {
  const layout = typeof data.layoutJson === 'string' ? JSON.parse(data.layoutJson) : data.layoutJson;
  
  if (layout.sections) {
    // Agrupar por zona
    const byZone = {};
    layout.sections.forEach(s => {
      const zone = s.zone || 'Sin zona';
      if (!byZone[zone]) byZone[zone] = [];
      
      const avgX = s.polygonPoints ? s.polygonPoints.reduce((sum, p) => sum + p.x, 0) / s.polygonPoints.length : 0;
      const avgY = s.polygonPoints ? s.polygonPoints.reduce((sum, p) => sum + p.y, 0) / s.polygonPoints.length : 0;
      
      byZone[zone].push({ name: s.name, avgX, avgY });
    });
    
    for (const [zone, sections] of Object.entries(byZone)) {
      console.log(`\n🔹 ${zone}:`);
      
      // Ordenar por X (izquierda a derecha)
      sections.sort((a, b) => a.avgX - b.avgX);
      sections.forEach((s, i) => {
        const position = i === 0 ? '(IZQUIERDA)' : i === sections.length - 1 ? '(DERECHA)' : '(CENTRO)';
        console.log(`   ${i + 1}. ${s.name.padEnd(25)} X=${s.avgX.toFixed(0).padStart(5)} ${position}`);
      });
    }
  }
}
