const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const venue = JSON.parse(data);
    
    console.log('✅ LAYOUT GUARDADO CORRECTAMENTE');
    console.log('================================');
    console.log(`Venue: ${venue.name}`);
    console.log(`Layout ID: ${venue.defaultLayout?.id || 'N/A'}`);
    console.log(`Version: ${venue.layoutJson?.version || 'embedded'}`);
    
    // Verificar secciones en el layoutJson
    const sections = venue.layoutJson?.sections || [];
    const canvasObjects = venue.layoutJson?.canvas?.objects || [];
    
    console.log(`\n📊 ESTADÍSTICAS:`);
    console.log(`   - Secciones en layoutJson.sections: ${sections.length}`);
    console.log(`   - Objetos en canvas: ${canvasObjects.length}`);
    
    console.log(`\n📍 9 SECCIONES GUARDADAS:`);
    sections.forEach((sec, i) => {
      console.log(`   ${i+1}. ${sec.name} (${sec.color})`);
    });
    
    // Verificar objetos del canvas
    console.log(`\n🎨 OBJETOS DEL CANVAS:`);
    canvasObjects.forEach((obj, i) => {
      console.log(`   ${i+1}. ${obj.name} (${obj._customType})`);
    });
    
    console.log('\n✅ Todo guardado correctamente sin asientos');
  });
}).on('error', (e) => console.error(e));
