/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *                    DIAGNÓSTICO COMPLETO DEL SISTEMA BOLETERA
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Este script analiza el estado actual del sistema para entender la situación
 * de las bases de datos.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const HOSTINGER_CONFIG = {
  host: 'srv440.hstgr.io',
  port: 3306,
  user: 'u191251575_eventOS',
  password: 'Alecs.com2006',
  database: 'u191251575_eventOS'
};

const VPS_API = 'https://update.compratuboleto.mx';

async function fetchJSON(url) {
  const response = await fetch(url);
  return response.json();
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           DIAGNÓSTICO COMPLETO - SISTEMA BOLETERA                          ║');
  console.log('║                                                                            ║');
  console.log('║   Analizando: Base de datos Hostinger vs API del VPS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // ==================== HOSTINGER ====================
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│  📊 BASE DE DATOS: HOSTINGER (srv440.hstgr.io)                             │');
  console.log('│  📁 Configurada en: server/.env (tu entorno local)                         │');
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');
  
  const hostinger = await mysql.createConnection(HOSTINGER_CONFIG);
  
  // Venues
  const [hVenues] = await hostinger.query('SELECT id, name, createdAt FROM Venue ORDER BY createdAt');
  console.log(`\n  📍 VENUES (${hVenues.length}):`);
  hVenues.forEach(v => {
    const date = new Date(v.createdAt).toLocaleDateString('es-MX');
    console.log(`     • ${v.name}`);
    console.log(`       ID: ${v.id}`);
    console.log(`       Creado: ${date}`);
  });

  // Events
  const [hEvents] = await hostinger.query(`
    SELECT e.id, e.name, e.status, e.createdAt, v.name as venueName 
    FROM Event e 
    LEFT JOIN Venue v ON v.id = e.venueId 
    ORDER BY e.createdAt
  `);
  console.log(`\n  🎫 EVENTOS (${hEvents.length}):`);
  hEvents.forEach(e => {
    const date = new Date(e.createdAt).toLocaleDateString('es-MX');
    console.log(`     • ${e.name} [${e.status}]`);
    console.log(`       Venue: ${e.venueName || 'Sin venue'}`);
    console.log(`       Creado: ${date}`);
  });

  // Sessions
  const [hSessions] = await hostinger.query(`
    SELECT es.id, es.startsAt, e.name as eventName
    FROM EventSession es
    JOIN Event e ON e.id = es.eventId
  `);
  console.log(`\n  📅 SESIONES (${hSessions.length}):`);
  hSessions.forEach(s => {
    const date = new Date(s.startsAt);
    console.log(`     • ${s.eventName}: ${date.toLocaleDateString('es-MX')} ${date.toLocaleTimeString('es-MX')}`);
  });

  // Seats count
  const [hSeats] = await hostinger.query('SELECT COUNT(*) as total FROM Seat');
  console.log(`\n  💺 ASIENTOS TOTALES: ${hSeats[0].total}`);

  await hostinger.end();

  // ==================== VPS API ====================
  console.log('\n');
  console.log('┌─────────────────────────────────────────────────────────────────────────────┐');
  console.log('│  🌐 API VPS: update.compratuboleto.mx                                       │');
  console.log('│  📁 Conecta a: MySQL local del VPS (configuración desconocida)             │');
  console.log('└─────────────────────────────────────────────────────────────────────────────┘');

  // Venues
  const vpsVenues = await fetchJSON(`${VPS_API}/api/venues`);
  console.log(`\n  📍 VENUES (${vpsVenues.length}):`);
  vpsVenues.forEach(v => {
    const date = new Date(v.createdAt).toLocaleDateString('es-MX');
    console.log(`     • ${v.name}`);
    console.log(`       ID: ${v.id}`);
    console.log(`       Creado: ${date}`);
    console.log(`       Asientos: ${v.stats?.totalSeats || 0}`);
  });

  // Events
  const vpsEvents = await fetchJSON(`${VPS_API}/api/events?all=true`);
  console.log(`\n  🎫 EVENTOS (${vpsEvents.events?.length || 0}):`);
  if (vpsEvents.events?.length === 0) {
    console.log('     ⚠️  NO HAY EVENTOS EN EL VPS');
  }

  // Categories
  const vpsCategories = await fetchJSON(`${VPS_API}/api/categories`);
  console.log(`\n  🏷️  CATEGORÍAS (${vpsCategories.length}):`);
  vpsCategories.forEach(c => console.log(`     • ${c.name}`));

  // ==================== CONCLUSIONES ====================
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              CONCLUSIONES                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('  🔴 PROBLEMA IDENTIFICADO:');
  console.log('     El sistema tiene DOS bases de datos SEPARADAS e INDEPENDIENTES:');
  console.log('');
  console.log('     1️⃣  HOSTINGER (srv440.hstgr.io)');
  console.log('        └─ Contiene: demooo, parque tangamanga + 4 eventos');
  console.log('        └─ Usada por: Tu entorno local (server/.env)');
  console.log('        └─ Creados: Diciembre 2025 - Enero 2026');
  console.log('');
  console.log('     2️⃣  VPS LOCAL (update.compratuboleto.mx)');
  console.log('        └─ Contiene: Teatro de la Ciudad, Teatro Nacional + 0 eventos');
  console.log('        └─ Usada por: Servidor de producción');
  console.log('        └─ Creados: Enero 2026 (recientemente)');
  console.log('');
  console.log('  📋 LÍNEA DE TIEMPO:');
  console.log('     • Dic 19, 2025: Venue "demooo" creado en HOSTINGER');
  console.log('     • Dic 21, 2025: Venue "parque tangamanga" creado en HOSTINGER');
  console.log('     • Ene 7-8, 2026: 4 eventos creados en HOSTINGER');
  console.log('     • Ene 10, 2026: Venue "Teatro Nacional" creado en VPS');
  console.log('     • Ene 29, 2026: Venue "Teatro de la Ciudad" creado en VPS');
  console.log('');
  console.log('  🎯 CAUSA RAÍZ:');
  console.log('     El VPS tiene un archivo .env que apunta a MySQL LOCAL,');
  console.log('     NO a Hostinger. Por eso son bases de datos diferentes.');
  console.log('');
  console.log('  💡 SOLUCIONES (de menor a mayor impacto):');
  console.log('');
  console.log('     OPCIÓN A: Unificar usando Hostinger (recomendado si es tu fuente de verdad)');
  console.log('        1. SSH al VPS');
  console.log('        2. Editar /var/www/.../server/.env');
  console.log('        3. Cambiar DATABASE_URL a Hostinger');
  console.log('        4. Reiniciar servidor (pm2 restart)');
  console.log('        ⚠️  Perderás: Teatro de la Ciudad con 792 asientos');
  console.log('');
  console.log('     OPCIÓN B: Unificar usando VPS MySQL (si quieres mantener el Teatro)');
  console.log('        1. Exportar eventos de Hostinger');
  console.log('        2. Importar en VPS MySQL');
  console.log('        3. Cambiar tu .env local para apuntar al VPS');
  console.log('        ⚠️  Necesitas credenciales MySQL del VPS');
  console.log('');
  console.log('     OPCIÓN C: Mantener ambas y crear eventos nuevos en VPS');
  console.log('        1. Crear eventos directamente en update.compratuboleto.mx');
  console.log('        2. Los eventos de Hostinger quedan como "legacy"');
  console.log('        ✅ No requiere cambios de infraestructura');
  console.log('');
}

main().catch(console.error);
