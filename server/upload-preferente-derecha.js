const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const BASE_URL = 'update.compratuboleto.mx';
const SECTION_PREFIX = 'preferente-derecha';
const SECTION_DISPLAY = 'PREFERENTE DERECHA';

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(180000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function getVenue() {
  const res = await httpsRequest({
    hostname: BASE_URL, port: 443,
    path: `/api/venues/${VENUE_ID}`, method: 'GET'
  });
  return JSON.parse(res.data);
}

async function main() {
  const args = process.argv.slice(2);
  const UPLOAD = args.includes('--upload');
  
  console.log(`=== ACTUALIZAR ${SECTION_DISPLAY} ===\n`);
  console.log('Modo:', UPLOAD ? '🚀 UPLOAD REAL' : '👁️ PREVIEW');
  
  const newSeats = JSON.parse(fs.readFileSync(`server/${SECTION_PREFIX}-fixed.json`, 'utf8'));
  console.log('Asientos nuevos:', newSeats.length);
  
  const venue = await getVenue();
  const currentSeats = venue.seats || [];
  const sections = venue.layoutJson?.sections || [];
  const canvas = venue.layoutJson?.canvas || {};
  const zones = venue.layoutJson?.zones || [];
  
  const otherSeats = currentSeats.filter(s => !s.id.startsWith(SECTION_PREFIX + '-'));
  
  console.log(`Asientos ${SECTION_DISPLAY} actuales:`, currentSeats.filter(s => s.id.startsWith(SECTION_PREFIX + '-')).length);
  console.log('Asientos otras secciones:', otherSeats.length);
  
  const apiNewSeats = newSeats.map(seat => ({
    id: seat.id, label: seat.label, rowLabel: seat.row,
    columnNumber: parseInt(seat.number), sectionId: seat.sectionId,
    status: 'AVAILABLE', position: { x: seat.x, y: seat.y },
    size: { width: 7, height: 7 },
    metadata: { fill: '#22c55e', stroke: '#16a34a', sectionName: SECTION_DISPLAY }
  }));
  
  const apiOtherSeats = otherSeats.map(seat => ({
    id: seat.id, label: seat.label || seat.id,
    rowLabel: seat.rowLabel, columnNumber: seat.columnNumber || 1,
    sectionId: seat.sectionId, status: seat.status || 'AVAILABLE',
    position: seat.metadata?.canvas?.position || { x: 0, y: 0 },
    size: seat.metadata?.canvas?.size || { width: 7, height: 7 },
    metadata: seat.metadata || {}
  }));
  
  const allSeats = [...apiOtherSeats, ...apiNewSeats];
  console.log('\nTOTAL a subir:', allSeats.length);
  
  if (!UPLOAD) { console.log('\n⚠️ PREVIEW'); return; }
  
  console.log('\n🚀 SUBIENDO...');
  
  const canvasObjects = canvas.objects || [];
  const filteredCanvasObjects = canvasObjects.filter(obj => {
    if (obj.type === 'Group') return true;
    const id = obj.id || obj.name || '';
    return !id.startsWith(SECTION_PREFIX + '-');
  });
  
  const newCanvasObjects = newSeats.map(seat => ({
    type: 'Circle', id: seat.id, name: seat.id,
    left: seat.x, top: seat.y, radius: 3.5,
    fill: '#22c55e', stroke: '#16a34a', strokeWidth: 1,
    selectable: false, evented: true, originX: 'center', originY: 'center'
  }));
  
  const payload = {
    layoutId: LAYOUT_ID,
    layoutJson: { canvas: { ...canvas, objects: [...filteredCanvasObjects, ...newCanvasObjects] }, zones, sections },
    seats: allSeats
  };
  
  const postData = JSON.stringify(payload);
  console.log('Payload:', (postData.length / 1024).toFixed(1), 'KB');
  
  const saveResponse = await httpsRequest({
    hostname: BASE_URL, port: 443,
    path: `/api/venues/${VENUE_ID}/layout`, method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, postData);
  
  console.log('Response:', saveResponse.statusCode);
  
  if (saveResponse.statusCode === 200 || saveResponse.statusCode === 201) {
    const result = JSON.parse(saveResponse.data);
    console.log('\n✅ GUARDADO! Versión:', result.version);
    const verifyVenue = await getVenue();
    const verifySeats = verifyVenue.seats || [];
    console.log('Total asientos:', verifySeats.length);
    console.log(`${SECTION_DISPLAY}:`, verifySeats.filter(s => s.id.startsWith(SECTION_PREFIX + '-')).length);
  } else {
    console.log('\n❌ Error:', saveResponse.data.substring(0, 500));
  }
}

main().catch(console.error);
