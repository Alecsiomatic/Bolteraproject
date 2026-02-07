// Listar todas las secciones
const layout = require('/tmp/layout-structure.json');

const objects = layout.layoutJson?.canvas?.objects || [];
const sections = objects.filter(o => o._customType === 'section');

console.log('Total sections:', sections.length);
sections.forEach((s, i) => {
  console.log(`${i+1}. "${s.name}" - ${s.id}`);
  
  // Buscar el polígono dentro del grupo
  const polygon = s.objects?.find(o => o.type === 'Polygon');
  if (polygon) {
    console.log(`   Polygon points: ${polygon.points?.length}`);
    if (polygon.points?.length) {
      const xs = polygon.points.map(p => p.x);
      const ys = polygon.points.map(p => p.y);
      console.log(`   Bounds: X(${Math.min(...xs).toFixed(0)}-${Math.max(...xs).toFixed(0)}) Y(${Math.min(...ys).toFixed(0)}-${Math.max(...ys).toFixed(0)})`);
    }
  }
});
