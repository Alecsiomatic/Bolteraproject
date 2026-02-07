// Inspeccionar estructura del layout
const API_BASE = 'https://update.compratuboleto.mx/api';
const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

async function inspect() {
  const res = await fetch(`${API_BASE}/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`);
  const layout = await res.json();
  
  console.log('Layout keys:', Object.keys(layout));
  console.log('Layout version:', layout.version);
  console.log('Layout data type:', typeof layout.data);
  
  if (layout.data) {
    console.log('\nLayout.data keys:', Object.keys(layout.data));
    
    if (layout.data.sections) {
      console.log('\nSections count:', layout.data.sections.length);
      layout.data.sections.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name} (${s.id}) - ${s.points?.length || 0} points`);
      });
    } else if (layout.data.objects) {
      console.log('\nObjects count:', layout.data.objects?.length);
      const sections = layout.data.objects?.filter(o => o.type === 'section' || o.type === 'polygon');
      console.log('Sections/Polygons:', sections?.length);
      sections?.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.name || s.label} (${s.id}) - type: ${s.type}`);
      });
    }
  }
  
  // Guardar layout para analizar
  const fs = require('fs');
  fs.writeFileSync('/tmp/layout-structure.json', JSON.stringify(layout, null, 2));
  console.log('\nLayout guardado en /tmp/layout-structure.json');
}

inspect().catch(console.error);
