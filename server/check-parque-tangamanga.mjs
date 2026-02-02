import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  try {
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    console.log('✅ Conectado a la base de datos online');
    
    // Buscar el venue "parque tangamanga"
    console.log('\n📍 Buscando venue "parque tangamanga"...\n');
    const [venues] = await conn.execute(
      'SELECT id, name, slug, address, city, capacity, layoutJson FROM Venue WHERE LOWER(name) LIKE ?',
      ['%parque tangamanga%']
    );
    
    if (venues.length === 0) {
      console.log('❌ No se encontró el venue "parque tangamanga"');
      await conn.end();
      return;
    }
    
    const venue = venues[0];
    console.log('=== VENUE ENCONTRADO ===');
    console.log(`ID: ${venue.id}`);
    console.log(`Nombre: ${venue.name}`);
    console.log(`Slug: ${venue.slug}`);
    console.log(`Dirección: ${venue.address}`);
    console.log(`Ciudad: ${venue.city}`);
    console.log(`Capacidad: ${venue.capacity}`);
    
    // Obtener las secciones (zonas)
    console.log('\n=== SECCIONES/ZONAS ===');
    const [zones] = await conn.execute(
      'SELECT id, name, capacity, colorCode, polygon, metadata FROM VenueZone WHERE venueId = ?',
      [venue.id]
    );
    
    console.log(`Total de secciones: ${zones.length}\n`);
    
    for (const zone of zones) {
      console.log(`📦 Sección: ${zone.name}`);
      console.log(`   ID: ${zone.id}`);
      console.log(`   Capacidad: ${zone.capacity}`);
      console.log(`   Color: ${zone.colorCode}`);
      
      // Mostrar el polígono
      if (zone.polygon) {
        const polygon = JSON.parse(zone.polygon);
        console.log(`   Vértices del polígono: ${polygon.length || 'N/A'}`);
        if (Array.isArray(polygon) && polygon.length > 0) {
          console.log(`   Coordenadas:`);
          polygon.slice(0, 3).forEach((point, i) => {
            console.log(`      [${i}]: x=${point.x}, y=${point.y}`);
          });
          if (polygon.length > 3) {
            console.log(`      ... (${polygon.length - 3} puntos más)`);
          }
        }
      }
      
      // Metadatos
      if (zone.metadata) {
        const meta = JSON.parse(zone.metadata);
        console.log(`   Metadatos: ${JSON.stringify(meta).substring(0, 100)}...`);
      }
      console.log('');
    }
    
    // Obtener los asientos por sección
    console.log('=== ASIENTOS POR SECCIÓN ===');
    const [seatsPerZone] = await conn.execute(`
      SELECT vz.name as zone_name, COUNT(s.id) as total_seats, s.status
      FROM VenueZone vz
      LEFT JOIN Seat s ON vz.id = s.sectionId
      WHERE vz.venueId = ?
      GROUP BY vz.id, vz.name, s.status
      ORDER BY vz.name
    `, [venue.id]);
    
    for (const row of seatsPerZone) {
      console.log(`${row.zone_name}: ${row.total_seats} asientos (${row.status || 'sin estado'})`);
    }
    
    // Mostrar el JSON del layout si existe
    if (venue.layoutJson) {
      console.log('\n=== LAYOUT JSON (primeros 500 caracteres) ===');
      const jsonPreview = venue.layoutJson.substring(0, 500);
      console.log(jsonPreview + '...\n');
    }
    
    await conn.end();
    console.log('✅ Consulta completada');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
