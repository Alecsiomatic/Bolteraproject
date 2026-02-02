/**
 * Script de diagnóstico completo para comparar bases de datos
 * Ejecutar: node diagnostic-db.mjs
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

async function connectHostinger() {
  return mysql.createConnection({
    host: 'srv440.hstgr.io',
    port: 3306,
    user: 'u191251575_eventOS',
    password: 'Alecs.com2006',
    database: 'u191251575_eventOS'
  });
}

async function main() {
  console.log(`${colors.bold}${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}║        DIAGNÓSTICO DE BASES DE DATOS - BOLETERA              ║${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}`);
  console.log('');

  // === HOSTINGER ===
  console.log(`${colors.yellow}━━━ BASE DE DATOS: HOSTINGER (srv440.hstgr.io) ━━━${colors.reset}`);
  try {
    const hostinger = await connectHostinger();
    
    // Venues
    const [hVenues] = await hostinger.query('SELECT id, name, slug FROM Venue');
    console.log(`${colors.green}✓ Conexión exitosa${colors.reset}`);
    console.log(`  Venues (${hVenues.length}):`);
    hVenues.forEach(v => console.log(`    - ${v.name} [${v.id.substring(0,8)}...]`));
    
    // Events
    const [hEvents] = await hostinger.query('SELECT id, name, status, venueId FROM Event');
    console.log(`  Eventos (${hEvents.length}):`);
    hEvents.forEach(e => console.log(`    - ${e.name} (${e.status}) -> venue: ${e.venueId?.substring(0,8) || 'NULL'}...`));
    
    // Sessions
    const [hSessions] = await hostinger.query('SELECT es.id, e.name, es.startsAt FROM EventSession es JOIN Event e ON es.eventId = e.id');
    console.log(`  Sesiones (${hSessions.length}):`);
    hSessions.forEach(s => console.log(`    - ${s.name}: ${s.startsAt}`));

    // Categories
    const [hCategories] = await hostinger.query('SELECT id, name FROM Category');
    console.log(`  Categorías (${hCategories.length}):`);
    hCategories.forEach(c => console.log(`    - ${c.name}`));

    // Users
    const [hUsers] = await hostinger.query('SELECT id, email, role FROM User');
    console.log(`  Usuarios (${hUsers.length}):`);
    hUsers.forEach(u => console.log(`    - ${u.email} (${u.role})`));
    
    await hostinger.end();
  } catch (err) {
    console.log(`${colors.red}✗ Error conectando a Hostinger: ${err.message}${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.yellow}━━━ API VPS: update.compratuboleto.mx ━━━${colors.reset}`);
  
  // Fetch from VPS API
  try {
    const venuesRes = await fetch('https://update.compratuboleto.mx/api/venues');
    const venues = await venuesRes.json();
    console.log(`${colors.green}✓ API respondiendo${colors.reset}`);
    console.log(`  Venues (${venues.length}):`);
    venues.forEach(v => console.log(`    - ${v.name} [${v.id.substring(0,8)}...]`));
    
    const eventsRes = await fetch('https://update.compratuboleto.mx/api/events?all=true');
    const eventsData = await eventsRes.json();
    console.log(`  Eventos (${eventsData.events?.length || 0}):`);
    (eventsData.events || []).forEach(e => console.log(`    - ${e.name} (${e.status})`));

    const categoriesRes = await fetch('https://update.compratuboleto.mx/api/categories');
    const categories = await categoriesRes.json();
    console.log(`  Categorías (${categories.length}):`);
    categories.forEach(c => console.log(`    - ${c.name}`));
    
  } catch (err) {
    console.log(`${colors.red}✗ Error con API VPS: ${err.message}${colors.reset}`);
  }

  console.log('');
  console.log(`${colors.bold}${colors.red}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.red}                        CONCLUSIÓN                              ${colors.reset}`);
  console.log(`${colors.bold}${colors.red}════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}El VPS (update.compratuboleto.mx) está usando una BASE DE DATOS${colors.reset}`);
  console.log(`${colors.yellow}DIFERENTE a Hostinger. Probablemente MySQL local en el VPS.${colors.reset}`);
  console.log('');
  console.log(`${colors.cyan}OPCIONES PARA RESOLVER:${colors.reset}`);
  console.log('');
  console.log('1. ${colors.green}Configurar VPS para usar Hostinger:${colors.reset}');
  console.log('   Editar /var/www/.../server/.env en el VPS y poner:');
  console.log('   DATABASE_URL="mysql://u191251575_eventOS:Alecs.com2006@srv440.hstgr.io:3306/u191251575_eventOS"');
  console.log('');
  console.log('2. ${colors.green}Migrar datos de Hostinger al VPS:${colors.reset}');
  console.log('   Exportar de Hostinger e importar en MySQL del VPS');
  console.log('');
  console.log('3. ${colors.green}Crear eventos nuevos en el VPS:${colors.reset}');
  console.log('   Si el VPS es tu producción, crear eventos desde la UI');
  console.log('');
}

main().catch(console.error);
