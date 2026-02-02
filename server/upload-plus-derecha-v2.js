const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const BASE_URL = 'update.compratuboleto.mx';

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function getVenue() {
  const res = await httpsRequest({
    hostname: BASE_URL,
    port: 443,
    path: `/api/venues/${VENUE_ID}`,
    method: 'GET'
  });
  return JSON.parse(res.data);
}

async function main() {
  const args = process.argv.slice(2);
  const UPLOAD = args.includes('--upload');
  
  console.log('=== ACTUALIZAR PLUS DERECHA (V2) ===\n');
  console.log('Modo:', UPLOAD ? '🚀 UPLOAD REAL' : '👁️ PREVIEW (usa --upload para subir)');
  
  // Cargar asientos corregidos (con inclinación)
  const newSeats = JSON.parse(fs.readFileSync('server/plus-derecha-inclinado.json', 'utf8'));
  console.log('Asientos nuevos a subir:', newSeats.length);
  
  // Obtener venue actual
  const venue = await getVenue();
  const currentSeats = venue.seats || [];
  const sections = venue.layoutJson?.sections || [];
  const canvas = venue.layoutJson?.canvas || {};
  const zones = venue.layoutJson?.zones || [];
  const plusDerSection = sections.find(s => s.name === 'PLUS DERECHA');
  
  console.log('Section ID:', plusDerSection?.id);
  console.log('Total asientos actuales:', currentSeats.length);
  
  // Separar asientos: PLUS DERECHA vs otros
  const plusDerCurrentIds = new Set(
    currentSeats.filter(s => s.id.startsWith('plus-derecha-')).map(s => s.id)
  );
  const otherSeats = currentSeats.filter(s => !s.id.startsWith('plus-derecha-'));
  
  console.log('Asientos PLUS DERECHA actuales:', plusDerCurrentIds.size);
  console.log('Asientos de otras secciones:', otherSeats.length);
  
  // Convertir nuevos asientos al formato de API
  const apiNewSeats = newSeats.map(seat => ({
    id: seat.id,
    label: seat.label,
    rowLabel: seat.row,
    columnNumber: parseInt(seat.number),
    sectionId: seat.sectionId,
    status: 'AVAILABLE',
    position: {
      x: seat.x,
      y: seat.y
    },
    size: {
      width: 7,
      height: 7
    },
    metadata: {
      fill: '#9b59b6',
      stroke: '#8e44ad',
      sectionName: 'PLUS DERECHA',
      displayLabel: `${seat.row}-${seat.number}`
    }
  }));
  
  // Convertir otros asientos al formato de API
  const apiOtherSeats = otherSeats.map(seat => ({
    id: seat.id,
    label: seat.label || seat.metadata?.canvas?.label || seat.id,
    rowLabel: seat.rowLabel || seat.metadata?.canvas?.label?.split('-')[0],
    columnNumber: seat.columnNumber || parseInt(seat.metadata?.canvas?.label?.split('-')[1]) || 1,
    sectionId: seat.metadata?.sectionId || seat.sectionId,
    status: seat.status || 'AVAILABLE',
    position: seat.metadata?.canvas?.position || { x: 0, y: 0 },
    size: seat.metadata?.canvas?.size || { width: 7, height: 7 },
    metadata: seat.metadata || {}
  }));
  
  // Combinar todos los asientos
  const allSeats = [...apiOtherSeats, ...apiNewSeats];
  
  console.log('\n=== RESUMEN ===');
  console.log('Asientos otras secciones:', apiOtherSeats.length);
  console.log('Asientos PLUS DERECHA nuevos:', apiNewSeats.length);
  console.log('TOTAL:', allSeats.length);
  
  if (!UPLOAD) {
    console.log('\n⚠️ PREVIEW - NO SE SUBIRÁ NADA');
    console.log('Ejecuta con --upload para aplicar cambios');
    return;
  }
  
  console.log('\n🚀 SUBIENDO CAMBIOS...');
  
  // Actualizar canvas objects - filtrar los de plus-derecha y agregar nuevos
  const canvasObjects = canvas.objects || [];
  const filteredCanvasObjects = canvasObjects.filter(obj => {
    if (obj.type === 'Group') return true;
    const id = obj.id || obj.name || '';
    return !id.startsWith('plus-derecha-');
  });
  
  // Crear canvas objects para los nuevos asientos
  const newCanvasObjects = [];
  newSeats.forEach(seat => {
    newCanvasObjects.push({
      type: 'Circle',
      id: seat.id,
      name: seat.id,
      left: seat.x,
      top: seat.y,
      radius: 3.5,
      fill: '#9b59b6',
      stroke: '#8e44ad',
      strokeWidth: 1,
      selectable: false,
      evented: true,
      originX: 'center',
      originY: 'center'
    });
    newCanvasObjects.push({
      type: 'IText',
      id: `${seat.id}-label`,
      name: `${seat.id}-label`,
      left: seat.x,
      top: seat.y + 8,
      text: seat.number,
      fontSize: 6,
      fill: '#333',
      fontFamily: 'Arial',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });
  });
  
  const finalCanvasObjects = [...filteredCanvasObjects, ...newCanvasObjects];
  
  console.log('Canvas objects:', canvasObjects.length, '->', finalCanvasObjects.length);
  
  // Preparar payload
  const payload = {
    layoutId: LAYOUT_ID,
    layoutJson: {
      canvas: {
        ...canvas,
        objects: finalCanvasObjects
      },
      zones: zones,
      sections: sections
    },
    seats: allSeats
  };
  
  const postData = JSON.stringify(payload);
  console.log('Payload size:', (postData.length / 1024).toFixed(1), 'KB');
  
  // Enviar
  const saveResponse = await httpsRequest({
    hostname: BASE_URL,
    port: 443,
    path: `/api/venues/${VENUE_ID}/layout`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  
  console.log('Response status:', saveResponse.statusCode);
  
  if (saveResponse.statusCode === 200 || saveResponse.statusCode === 201) {
    const result = JSON.parse(saveResponse.data);
    console.log('\n✅ GUARDADO EXITOSAMENTE!');
    console.log('Nueva versión:', result.version);
    if (result.sync) {
      console.log('Asientos creados:', result.sync.seats?.created || 0);
      console.log('Asientos actualizados:', result.sync.seats?.updated || 0);
    }
    
    // Verificar
    console.log('\n=== VERIFICACIÓN ===');
    const verifyVenue = await getVenue();
    const verifySeats = verifyVenue.seats || [];
    const verifyPlusDer = verifySeats.filter(s => s.id.startsWith('plus-derecha-'));
    console.log('Total asientos:', verifySeats.length);
    console.log('PLUS DERECHA:', verifyPlusDer.length);
  } else {
    console.log('\n❌ Error:', saveResponse.data.substring(0, 500));
  }
}

main().catch(console.error);
