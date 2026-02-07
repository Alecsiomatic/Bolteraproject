// Ver puntos del polígono DIAMANTE DERECHA para calcular inclinación
const layout = require('/tmp/layout-structure.json');

const objects = layout.layoutJson?.canvas?.objects || [];
const section = objects.find(o => o.id === 'section-1770168306199');

if (section) {
  console.log('DIAMANTE DERECHA (section-1770168306199)');
  console.log('Left:', section.left, 'Top:', section.top);
  console.log('Width:', section.width, 'Height:', section.height);
  console.log('Angle:', section.angle);
  
  const polygon = section.objects?.find(o => o.type === 'Polygon');
  if (polygon) {
    console.log('\nPolygon points:');
    polygon.points.forEach((p, i) => {
      console.log(`  ${i}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    });
    
    // Calcular ángulo de la primera línea (borde superior)
    if (polygon.points.length >= 2) {
      const p0 = polygon.points[0];
      const p1 = polygon.points[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = angleRad * 180 / Math.PI;
      console.log(`\nÁngulo borde superior: ${angleDeg.toFixed(2)}°`);
    }
  }
}

// También ver DIAMANTE IZQUIERDA
const sectionIzq = objects.find(o => o.id === 'section-1770168352717');
if (sectionIzq) {
  console.log('\n\nDIAMANTE IZQUIERDA (section-1770168352717)');
  console.log('Left:', sectionIzq.left, 'Top:', sectionIzq.top);
  console.log('Angle:', sectionIzq.angle);
  
  const polygon = sectionIzq.objects?.find(o => o.type === 'Polygon');
  if (polygon) {
    console.log('\nPolygon points:');
    polygon.points.forEach((p, i) => {
      console.log(`  ${i}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    });
    
    if (polygon.points.length >= 2) {
      const p0 = polygon.points[0];
      const p1 = polygon.points[1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = angleRad * 180 / Math.PI;
      console.log(`\nÁngulo borde superior: ${angleDeg.toFixed(2)}°`);
    }
  }
}
