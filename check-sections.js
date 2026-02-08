const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
  
  const layoutId = '35694cf1-597f-46f4-a5c3-66e3fa4563f5';
  
  // Ver secciones en el layoutJson
  const [ljson] = await c.execute('SELECT layoutJson FROM VenueLayout WHERE id=?', [layoutId]);
  if (ljson[0]?.layoutJson) {
    const data = JSON.parse(ljson[0].layoutJson);
    console.log('=== Sections in layout ===');
    console.log('Total sections:', data.sections?.length || 0);
    if (data.sections) {
      data.sections.forEach(s => {
        console.log(' -', s.name);
        console.log('   id:', s.id);
        console.log('   admissionType:', s.admissionType || 'NOT SET');
        console.log('   capacity:', s.capacity);
        console.log('   basePrice:', s.basePrice);
      });
    }
  }
  
  await c.end();
})();
