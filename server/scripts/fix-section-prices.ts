import mysql from 'mysql2/promise';

async function fixSectionPrices() {
  // Parse DATABASE_URL from environment
  const dbUrl = process.env.DATABASE_URL || 'mysql://u191251575_eventOS:Alecs.com2006@srv440.hstgr.io:3306/u191251575_eventOS';
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  const [, user, password, host, port, database] = match;
  
  const conn = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database
  });

  try {
    // Obtener TODOS los eventos que tienen precios sin sectionId vinculado
    const [events] = await conn.query(`
      SELECT DISTINCT e.id, e.name, e.venueId 
      FROM Event e
      JOIN EventPriceTier pt ON pt.eventId = e.id
      WHERE pt.sectionId IS NULL
    `);
    
    console.log(`Found ${(events as any[]).length} events with unlinked price tiers`);

    for (const event of events as any[]) {
      console.log(`\n--- Processing event: ${event.name} (${event.id}) ---`);

      // Obtener el layout del venue/evento
      const [layouts] = await conn.query(
        'SELECT id FROM VenueLayout WHERE venueId = ? LIMIT 1', 
        [event.venueId]
      );
      
      if ((layouts as any[]).length === 0) {
        console.log('  No layout found, skipping');
        continue;
      }
      
      const layout = (layouts as any[])[0];
      console.log(`  Layout: ${layout.id}`);

      // Obtener las secciones del layout
      const [sections] = await conn.query(
        'SELECT id, name FROM LayoutSection WHERE parentLayoutId = ?', 
        [layout.id]
      );
      
      if ((sections as any[]).length === 0) {
        console.log('  No sections in layout, skipping');
        continue;
      }
      
      console.log(`  Sections: ${(sections as any[]).map((s: any) => s.name).join(', ')}`);

      // Obtener los tiers del evento sin sectionId
      const [tiers] = await conn.query(
        'SELECT id, label, sectionId FROM EventPriceTier WHERE eventId = ? AND sectionId IS NULL', 
        [event.id]
      );
      
      console.log(`  Tiers without sectionId: ${(tiers as any[]).length}`);

      // Vincular tiers con secciones por nombre
      for (const tier of tiers as any[]) {
        const match = (sections as any[]).find(
          (s: any) => s.name.trim().toLowerCase() === tier.label.trim().toLowerCase()
        );
        
        if (match) {
          console.log(`  ✓ Linking tier "${tier.label}" -> section ${match.id}`);
          await conn.query(
            'UPDATE EventPriceTier SET sectionId = ? WHERE id = ?', 
            [match.id, tier.id]
          );
        } else {
          console.log(`  ✗ No matching section for tier "${tier.label}"`);
        }
      }
    }

    // Mostrar resumen final
    const [remaining] = await conn.query(
      'SELECT COUNT(*) as count FROM EventPriceTier WHERE sectionId IS NULL'
    );
    console.log(`\n=== Done! Remaining tiers without sectionId: ${(remaining as any[])[0].count} ===`);

  } finally {
    await conn.end();
  }
}

fixSectionPrices().catch(console.error);
