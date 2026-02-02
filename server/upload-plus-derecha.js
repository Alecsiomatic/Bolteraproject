const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const API_BASE = 'https://update.compratuboleto.mx/api/venues';

function apiRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function getVenue() {
  const res = await apiRequest('GET', `/${VENUE_ID}`);
  return res.data;
}

async function main() {
  const args = process.argv.slice(2);
  const UPLOAD = args.includes('--upload');
  
  console.log('=== ACTUALIZAR PLUS DERECHA ===\n');
  console.log('Modo:', UPLOAD ? 'UPLOAD REAL' : 'PREVIEW (usa --upload para subir)');
  
  // Cargar asientos corregidos
  const newSeats = JSON.parse(fs.readFileSync('server/plus-derecha-fixed.json', 'utf8'));
  console.log('Asientos nuevos a subir:', newSeats.length);
  
  // Obtener venue actual
  const venue = await getVenue();
  const currentSeats = venue.seats || [];
  const sections = venue.layoutJson?.sections || [];
  const plusDerSection = sections.find(s => s.name === 'PLUS DERECHA');
  
  console.log('Section ID:', plusDerSection?.id);
  
  // Identificar asientos actuales de PLUS DERECHA
  const plusDerCurrentSeats = currentSeats.filter(s => s.id.startsWith('plus-derecha-'));
  console.log('Asientos actuales PLUS DERECHA:', plusDerCurrentSeats.length);
  
  // Asientos de otras secciones (NO tocar)
  const otherSeats = currentSeats.filter(s => !s.id.startsWith('plus-derecha-'));
  console.log('Asientos de otras secciones:', otherSeats.length);
  
  if (!UPLOAD) {
    console.log('\n=== PREVIEW - NO SE SUBIRÁ NADA ===');
    console.log('Asientos que se eliminarán:', plusDerCurrentSeats.length);
    console.log('Asientos que se agregarán:', newSeats.length);
    console.log('Total final esperado:', otherSeats.length + newSeats.length);
    console.log('\nEjecuta con --upload para aplicar cambios');
    return;
  }
  
  console.log('\n=== SUBIENDO CAMBIOS ===');
  
  // Preparar canvas objects
  // Obtener los objetos canvas que NO son de plus-derecha
  const canvasObjects = venue.layoutJson?.canvas?.objects || [];
  const otherCanvasObjects = canvasObjects.filter(obj => {
    // Mantener secciones (Groups)
    if (obj.type === 'Group') return true;
    // Filtrar circles y texts de plus-derecha
    if (obj.type === 'Circle' || obj.type === 'IText') {
      const isPlsDer = obj.id?.startsWith('plus-derecha-') || obj.name?.startsWith('plus-derecha-');
      return !isPlsDer;
    }
    return true;
  });
  
  console.log('Canvas objects originales:', canvasObjects.length);
  console.log('Canvas objects después de filtrar:', otherCanvasObjects.length);
  
  // Crear nuevos canvas objects para los asientos
  const newCanvasObjects = [];
  newSeats.forEach(seat => {
    // Circle para el asiento
    newCanvasObjects.push({
      type: 'Circle',
      id: seat.id,
      name: seat.id,
      left: seat.x,
      top: seat.y,
      radius: 3.5,
      fill: '#9b59b6', // Color plus
      stroke: '#8e44ad',
      strokeWidth: 1,
      selectable: false,
      evented: true,
      originX: 'center',
      originY: 'center'
    });
    
    // Label para el asiento
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
  
  // Combinar
  const finalCanvasObjects = [...otherCanvasObjects, ...newCanvasObjects];
  console.log('Canvas objects finales:', finalCanvasObjects.length);
  
  // Preparar seats para la API
  const apiSeats = newSeats.map(seat => ({
    id: seat.id,
    visibleId: seat.id,
    label: seat.label,
    row: seat.row,
    number: seat.number,
    seatType: 'STANDARD',
    status: 'AVAILABLE',
    metadata: {
      canvas: {
        position: { x: seat.x, y: seat.y, angle: 0 },
        size: { width: 7, height: 7 },
        label: seat.label
      },
      sectionId: seat.sectionId,
      seatType: 'STANDARD'
    }
  }));
  
  // Primero eliminar asientos antiguos de PLUS DERECHA
  console.log('\n1. Eliminando asientos antiguos de PLUS DERECHA...');
  const deleteIds = plusDerCurrentSeats.map(s => s.id);
  
  // Eliminar en batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < deleteIds.length; i += BATCH_SIZE) {
    const batch = deleteIds.slice(i, i + BATCH_SIZE);
    const res = await apiRequest('DELETE', `/${VENUE_ID}/seats`, { seatIds: batch });
    console.log(`  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} eliminados (status: ${res.status})`);
  }
  
  // Subir nuevos asientos
  console.log('\n2. Subiendo nuevos asientos...');
  for (let i = 0; i < apiSeats.length; i += BATCH_SIZE) {
    const batch = apiSeats.slice(i, i + BATCH_SIZE);
    const res = await apiRequest('POST', `/${VENUE_ID}/seats`, { seats: batch });
    console.log(`  Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} subidos (status: ${res.status})`);
  }
  
  // Actualizar canvas
  console.log('\n3. Actualizando canvas...');
  const layoutUpdate = {
    layoutJson: {
      ...venue.layoutJson,
      canvas: {
        ...venue.layoutJson.canvas,
        objects: finalCanvasObjects
      }
    }
  };
  
  const layoutRes = await apiRequest('PUT', `/${VENUE_ID}`, layoutUpdate);
  console.log('Layout actualizado:', layoutRes.status);
  
  // Verificar
  console.log('\n=== VERIFICACIÓN ===');
  const verifyVenue = await getVenue();
  const verifySeats = verifyVenue.seats || [];
  const verifyPlusDer = verifySeats.filter(s => s.id.startsWith('plus-derecha-'));
  console.log('Total asientos en servidor:', verifySeats.length);
  console.log('Asientos PLUS DERECHA:', verifyPlusDer.length);
  
  if (verifyPlusDer.length === 435) {
    console.log('✅ PLUS DERECHA actualizado correctamente!');
  } else {
    console.log('⚠️ Cantidad no coincide, verificar manualmente');
  }
}

main().catch(console.error);
