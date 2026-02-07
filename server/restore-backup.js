const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';

async function getBackupSeats() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '72.60.168.4',
      port: 22,
    };
    // Usar curl via SSH no funciona bien, voy a hacer fetch HTTP
    https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        // Necesitamos el backup del servidor
        reject(new Error('Necesitamos el backup del servidor'));
      });
    });
  });
}

// Descargar backup primero
console.log('Descargando backup del servidor...');
const { execSync } = require('child_process');

try {
  execSync('scp root@72.60.168.4:/var/www/update.compratuboleto.mx/server/backup-layout-20260203.json ./server/backup-restore.json', {
    stdio: 'inherit'
  });
  console.log('Backup descargado.');
} catch (e) {
  console.error('Error descargando backup:', e.message);
  process.exit(1);
}

// Cargar backup
const backup = require('./backup-restore.json');
console.log('Asientos en backup:', backup.seats.length);

// Obtener layout actual (con las 12 secciones)
https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const current = JSON.parse(data);
    const layoutJson = current.layoutJson;
    
    console.log('Secciones actuales:', layoutJson.sections.length);
    console.log('Restaurando', backup.seats.length, 'asientos...');
    
    const payload = JSON.stringify({
      layoutId: LAYOUT_ID,
      layoutJson: layoutJson,
      zones: [],
      seats: backup.seats,
      tables: []
    });
    
    const options = {
      hostname: 'update.compratuboleto.mx',
      port: 443,
      path: `/api/venues/${VENUE_ID}/layout`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };
    
    const req = https.request(options, (res2) => {
      let d = '';
      res2.on('data', c => d += c);
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        try {
          const r = JSON.parse(d);
          console.log('✅ Versión:', r.version);
          console.log('Asientos restaurados!');
        } catch (e) {
          console.log('Response:', d.substring(0, 500));
        }
      });
    });
    
    req.on('error', e => console.error('Error:', e.message));
    req.write(payload);
    req.end();
  });
}).on('error', e => console.error('Error obteniendo layout actual:', e.message));
