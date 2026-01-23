const mysql = require('mysql2/promise');

async function main() {
  console.log('Conectando a la base de datos...');
  
  const conn = await mysql.createConnection({
    host: 'srv440.hstgr.io',
    port: 3306,
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
  
  console.log('Conectado!\n');
  
  // Find the specific event "evento-1" 
  const eventSlug = 'evento-1';
  const eventId = '9b914e84-1618-4ed6-9581-c17d04d4b4ce';
  
  console.log('=== INVESTIGANDO EVENTO:', eventSlug, '===\n');
  
  // 1. Get event details
  const [events] = await conn.query('SELECT * FROM Event WHERE id = ?', [eventId]);
  console.log('1. EVENTO:', JSON.stringify(events[0], null, 2));
  
  // 2. Get layout for this event
  const [eventLayout] = await conn.query('SELECT * FROM VenueLayout WHERE eventId = ?', [eventId]);
  console.log('\n2. LAYOUT DEL EVENTO:', JSON.stringify(eventLayout, null, 2));
  
  // 3. Get seats for this event's layout
  if (eventLayout.length > 0) {
    const [seats] = await conn.query('SELECT COUNT(*) as count FROM Seat WHERE layoutId = ?', [eventLayout[0].id]);
    console.log('\n3. ASIENTOS EN LAYOUT DEL EVENTO:', seats[0].count);
  }
  
  // 4. Get template layout (what should have been copied)
  const venueId = events[0]?.venueId;
  console.log('\n4. VENUE ID:', venueId);
  
  const [templateLayouts] = await conn.query(
    'SELECT id, name, isDefault, isTemplate FROM VenueLayout WHERE venueId = ? AND eventId IS NULL',
    [venueId]
  );
  console.log('\n5. TEMPLATE LAYOUTS:', JSON.stringify(templateLayouts, null, 2));
  
  // 5. Check seats in template
  for (const tmpl of templateLayouts) {
    const [seats] = await conn.query('SELECT COUNT(*) as count FROM Seat WHERE layoutId = ?', [tmpl.id]);
    console.log(`   - Template "${tmpl.name}" (${tmpl.id}) tiene ${seats[0].count} asientos`);
  }
  
  // 6. Sample a few seats to see their structure
  console.log('\n6. MUESTRA DE ASIENTOS DEL TEMPLATE:');
  const [sampleSeats] = await conn.query(
    'SELECT id, layoutId, zoneId, label, metadata FROM Seat WHERE layoutId = ? LIMIT 3',
    [templateLayouts[0]?.id]
  );
  console.log(JSON.stringify(sampleSeats, null, 2));
  
  // 7. Now let's manually copy the seats!
  console.log('\n\n=== COPIANDO ASIENTOS MANUALMENTE ===');
  const eventLayoutId = eventLayout[0]?.id;
  const templateLayoutId = templateLayouts[0]?.id;
  
  if (!eventLayoutId || !templateLayoutId) {
    console.log('ERROR: No se encontraron layouts');
    await conn.end();
    return;
  }
  
  // Get all seats from template
  const [templateSeats] = await conn.query(
    'SELECT * FROM Seat WHERE layoutId = ?',
    [templateLayoutId]
  );
  console.log(`Encontrados ${templateSeats.length} asientos en el template`);
  
  // Copy each seat
  let copied = 0;
  for (const seat of templateSeats) {
    const newSeatId = `${seat.id}-copy-${eventId.slice(0,6)}`;
    try {
      await conn.query(
        `INSERT INTO Seat (id, venueId, layoutId, zoneId, tableId, label, rowLabel, columnNumber, status, metadata, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, NOW(), NOW())`,
        [newSeatId, seat.venueId, eventLayoutId, seat.zoneId, seat.tableId, seat.label, seat.rowLabel, seat.columnNumber, seat.metadata]
      );
      copied++;
    } catch (err) {
      // Ignore duplicates
      if (!err.message.includes('Duplicate')) {
        console.error('Error copying seat:', err.message);
      }
    }
  }
  console.log(`Copiados ${copied} asientos al layout del evento`);
  
  // Also update the layoutJson
  const [tmplLayout] = await conn.query('SELECT layoutJson, metadata FROM VenueLayout WHERE id = ?', [templateLayoutId]);
  await conn.query(
    'UPDATE VenueLayout SET layoutJson = ?, metadata = ? WHERE id = ?',
    [tmplLayout[0].layoutJson, tmplLayout[0].metadata, eventLayoutId]
  );
  console.log('LayoutJson actualizado');
  
  // Verify
  const [finalCount] = await conn.query('SELECT COUNT(*) as count FROM Seat WHERE layoutId = ?', [eventLayoutId]);
  console.log(`\nVerificación: El layout del evento ahora tiene ${finalCount[0].count} asientos`);
  
  await conn.end();
  console.log('\nConexión cerrada.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
