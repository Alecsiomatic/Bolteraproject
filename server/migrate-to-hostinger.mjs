import mysql from 'mysql2/promise';

// ============================================
// MIGRACIÓN: VPS Local → Hostinger
// ============================================
// EJECUTAR EN EL VPS: node migrate-to-hostinger.mjs
// ============================================

const VPS_CONFIG = {
  host: 'localhost',  // Desde el VPS es localhost
  port: 3306,
  user: 'root',
  password: 'Alecs.com2741',
  database: 'boletera'
};

const HOSTINGER_CONFIG = {
  host: 'srv440.hstgr.io',
  port: 3306,
  user: 'u191251575_eventOS',
  password: 'Alecs.com2006',
  database: 'u191251575_eventOS'
};

async function migrate() {
  console.log('🚀 MIGRACIÓN: VPS Local → Hostinger\n');
  
  let vpsConn, hostingerConn;
  
  try {
    // Conectar a ambas bases de datos
    console.log('📡 Conectando a VPS...');
    vpsConn = await mysql.createConnection(VPS_CONFIG);
    console.log('✅ VPS conectado');
    
    console.log('📡 Conectando a Hostinger...');
    hostingerConn = await mysql.createConnection(HOSTINGER_CONFIG);
    console.log('✅ Hostinger conectado\n');
    
    // ============================================
    // 1. EXPORTAR VENUES DEL VPS
    // ============================================
    console.log('📦 Exportando venues del VPS...');
    const [vpsVenues] = await vpsConn.query('SELECT * FROM venues');
    console.log(`   Encontrados: ${vpsVenues.length} venues`);
    
    for (const venue of vpsVenues) {
      console.log(`   - ${venue.name} (ID: ${venue.id})`);
    }
    
    // ============================================
    // 2. EXPORTAR SECTIONS DEL VPS
    // ============================================
    console.log('\n📦 Exportando sections del VPS...');
    const [vpsSections] = await vpsConn.query('SELECT * FROM sections');
    console.log(`   Encontradas: ${vpsSections.length} sections`);
    
    // ============================================
    // 3. EXPORTAR SEATS DEL VPS
    // ============================================
    console.log('\n📦 Exportando seats del VPS...');
    const [vpsSeats] = await vpsConn.query('SELECT * FROM seats');
    console.log(`   Encontrados: ${vpsSeats.length} seats`);
    
    // ============================================
    // 4. VERIFICAR QUÉ YA EXISTE EN HOSTINGER
    // ============================================
    console.log('\n🔍 Verificando datos existentes en Hostinger...');
    const [hostingerVenues] = await hostingerConn.query('SELECT id, name FROM venues');
    const existingVenueNames = hostingerVenues.map(v => v.name.toLowerCase());
    console.log(`   Venues existentes: ${hostingerVenues.map(v => v.name).join(', ') || 'ninguno'}`);
    
    // ============================================
    // 5. MIGRAR VENUES (solo los nuevos)
    // ============================================
    console.log('\n📥 Migrando venues a Hostinger...');
    const venueIdMap = {}; // oldId -> newId
    
    for (const venue of vpsVenues) {
      if (existingVenueNames.includes(venue.name.toLowerCase())) {
        console.log(`   ⏭️  Saltando "${venue.name}" (ya existe)`);
        // Buscar el ID existente
        const existing = hostingerVenues.find(v => v.name.toLowerCase() === venue.name.toLowerCase());
        venueIdMap[venue.id] = existing.id;
        continue;
      }
      
      // Insertar nuevo venue
      const [result] = await hostingerConn.query(
        `INSERT INTO venues (name, address, city, state, country, capacity, description, image_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          venue.name,
          venue.address || null,
          venue.city || null,
          venue.state || null,
          venue.country || null,
          venue.capacity || 0,
          venue.description || null,
          venue.image_url || null,
          venue.created_at || new Date(),
          venue.updated_at || new Date()
        ]
      );
      
      venueIdMap[venue.id] = result.insertId;
      console.log(`   ✅ "${venue.name}" migrado (VPS ID ${venue.id} → Hostinger ID ${result.insertId})`);
    }
    
    // ============================================
    // 6. MIGRAR SECTIONS
    // ============================================
    console.log('\n📥 Migrando sections a Hostinger...');
    const sectionIdMap = {}; // oldId -> newId
    
    // Verificar sections existentes
    const [hostingerSections] = await hostingerConn.query('SELECT id, venue_id, name FROM sections');
    
    for (const section of vpsSections) {
      const newVenueId = venueIdMap[section.venue_id];
      if (!newVenueId) {
        console.log(`   ⚠️  Saltando section "${section.name}" (venue no mapeado)`);
        continue;
      }
      
      // Verificar si ya existe esta sección para este venue
      const existing = hostingerSections.find(
        s => s.venue_id === newVenueId && s.name.toLowerCase() === section.name.toLowerCase()
      );
      
      if (existing) {
        console.log(`   ⏭️  Saltando "${section.name}" (ya existe en venue ${newVenueId})`);
        sectionIdMap[section.id] = existing.id;
        continue;
      }
      
      // Insertar nueva section
      const [result] = await hostingerConn.query(
        `INSERT INTO sections (venue_id, name, capacity, price, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          newVenueId,
          section.name,
          section.capacity || 0,
          section.price || 0,
          section.color || '#808080',
          section.created_at || new Date(),
          section.updated_at || new Date()
        ]
      );
      
      sectionIdMap[section.id] = result.insertId;
      console.log(`   ✅ "${section.name}" migrada (VPS ID ${section.id} → Hostinger ID ${result.insertId})`);
    }
    
    // ============================================
    // 7. MIGRAR SEATS (en batches)
    // ============================================
    console.log('\n📥 Migrando seats a Hostinger...');
    
    // Agrupar seats por section
    const seatsBySection = {};
    for (const seat of vpsSeats) {
      if (!seatsBySection[seat.section_id]) {
        seatsBySection[seat.section_id] = [];
      }
      seatsBySection[seat.section_id].push(seat);
    }
    
    let totalMigrated = 0;
    let totalSkipped = 0;
    
    for (const [oldSectionId, seats] of Object.entries(seatsBySection)) {
      const newSectionId = sectionIdMap[oldSectionId];
      if (!newSectionId) {
        console.log(`   ⚠️  Saltando ${seats.length} seats (section ${oldSectionId} no mapeada)`);
        totalSkipped += seats.length;
        continue;
      }
      
      // Verificar si ya hay seats en esta section
      const [existingSeats] = await hostingerConn.query(
        'SELECT COUNT(*) as count FROM seats WHERE section_id = ?',
        [newSectionId]
      );
      
      if (existingSeats[0].count > 0) {
        console.log(`   ⏭️  Saltando section ${newSectionId} (ya tiene ${existingSeats[0].count} seats)`);
        totalSkipped += seats.length;
        continue;
      }
      
      // Insertar seats en batches de 100
      const batchSize = 100;
      for (let i = 0; i < seats.length; i += batchSize) {
        const batch = seats.slice(i, i + batchSize);
        const values = batch.map(seat => [
          newSectionId,
          seat.row_name || seat.row_label || '',
          seat.seat_number || 0,
          seat.label || `${seat.row_name || ''}${seat.seat_number || ''}`,
          seat.status || 'available',
          seat.x || 0,
          seat.y || 0,
          seat.price || null,
          seat.created_at || new Date(),
          seat.updated_at || new Date()
        ]);
        
        await hostingerConn.query(
          `INSERT INTO seats (section_id, row_name, seat_number, label, status, x, y, price, created_at, updated_at)
           VALUES ?`,
          [values]
        );
        
        totalMigrated += batch.length;
      }
      
      console.log(`   ✅ Section ${newSectionId}: ${seats.length} seats migrados`);
    }
    
    console.log(`\n   Total migrados: ${totalMigrated}`);
    console.log(`   Total saltados: ${totalSkipped}`);
    
    // ============================================
    // 8. VERIFICACIÓN FINAL
    // ============================================
    console.log('\n' + '='.repeat(50));
    console.log('📊 VERIFICACIÓN FINAL EN HOSTINGER');
    console.log('='.repeat(50));
    
    const [finalVenues] = await hostingerConn.query('SELECT id, name FROM venues');
    const [finalSections] = await hostingerConn.query('SELECT COUNT(*) as count FROM sections');
    const [finalSeats] = await hostingerConn.query('SELECT COUNT(*) as count FROM seats');
    const [finalEvents] = await hostingerConn.query('SELECT COUNT(*) as count FROM events');
    
    console.log(`\nVenues: ${finalVenues.length}`);
    for (const v of finalVenues) {
      const [sectionCount] = await hostingerConn.query(
        'SELECT COUNT(*) as count FROM sections WHERE venue_id = ?', [v.id]
      );
      const [seatCount] = await hostingerConn.query(
        'SELECT COUNT(*) as count FROM seats WHERE section_id IN (SELECT id FROM sections WHERE venue_id = ?)', [v.id]
      );
      console.log(`  - ${v.name}: ${sectionCount[0].count} sections, ${seatCount[0].count} seats`);
    }
    
    console.log(`\nTotal sections: ${finalSections[0].count}`);
    console.log(`Total seats: ${finalSeats[0].count}`);
    console.log(`Total events: ${finalEvents[0].count}`);
    
    console.log('\n✅ MIGRACIÓN COMPLETADA');
    console.log('\n📋 PRÓXIMO PASO:');
    console.log('   Cambiar el .env del VPS para apuntar a Hostinger:');
    console.log('   DATABASE_URL=mysql://u191251575_eventOS:Alecs.com2006@srv440.hstgr.io:3306/u191251575_eventOS');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error(error);
  } finally {
    if (vpsConn) await vpsConn.end();
    if (hostingerConn) await hostingerConn.end();
  }
}

migrate();
