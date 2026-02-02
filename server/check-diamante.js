const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const venue = JSON.parse(data);
    const sections = venue.layoutJson?.sections || [];
    
    // Filtrar secciones DIAMANTE
    const diamante = sections.filter(s => s.name.includes('DIAMANTE'));
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║       REVISIÓN DE 3 POLÍGONOS ZONA DIAMANTE                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    diamante.forEach((s, i) => {
      console.log(`\n📍 ${i+1}. ${s.name}`);
      console.log('─'.repeat(50));
      console.log(`   ID: ${s.id}`);
      console.log(`   Color: ${s.color}`);
      console.log(`   Capacity: ${s.capacity}`);
      console.log(`   Display Order: ${s.displayOrder}`);
      console.log(`   Visible: ${s.visible}`);
      console.log(`   isActive: ${s.isActive}`);
      
      console.log(`\n   📐 Puntos del polígono (${s.polygonPoints.length} vértices):`);
      s.polygonPoints.forEach((p, j) => {
        console.log(`      Punto ${j+1}: x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)}`);
      });
      
      // Calcular área aproximada del polígono
      let area = 0;
      const pts = s.polygonPoints;
      for (let j = 0; j < pts.length; j++) {
        const k = (j + 1) % pts.length;
        area += pts[j].x * pts[k].y;
        area -= pts[k].x * pts[j].y;
      }
      area = Math.abs(area / 2);
      
      // Calcular dimensiones del bounding box
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));
      const minY = Math.min(...pts.map(p => p.y));
      const maxY = Math.max(...pts.map(p => p.y));
      
      console.log(`\n   📊 Métricas:`);
      console.log(`      Área aprox: ${area.toFixed(0)} px²`);
      console.log(`      Ancho (X): ${(maxX - minX).toFixed(1)} px`);
      console.log(`      Alto (Y): ${(maxY - minY).toFixed(1)} px`);
      console.log(`      Bounding box: (${minX.toFixed(1)}, ${minY.toFixed(1)}) - (${maxX.toFixed(1)}, ${maxY.toFixed(1)})`);
      
      console.log(`\n   🏷️  Label Position: (${s.labelPosition.x.toFixed(2)}, ${s.labelPosition.y.toFixed(2)})`);
    });
    
    console.log('\n\n═══════════════════════════════════════════════════════════════');
    console.log('RESUMEN:');
    console.log(`  Total secciones DIAMANTE: ${diamante.length}`);
    console.log(`  Total secciones en venue: ${sections.length}`);
    console.log('═══════════════════════════════════════════════════════════════');
    
    // Verificar si están bien posicionados (entre VIP y debajo del escenario)
    console.log('\n✅ VALIDACIÓN DE POSICIÓN:');
    diamante.forEach(s => {
      const avgY = s.polygonPoints.reduce((sum, p) => sum + p.y, 0) / s.polygonPoints.length;
      const avgX = s.polygonPoints.reduce((sum, p) => sum + p.x, 0) / s.polygonPoints.length;
      console.log(`   ${s.name}: Centro aprox (${avgX.toFixed(0)}, ${avgY.toFixed(0)})`);
    });
  });
}).on('error', e => console.error(e));
