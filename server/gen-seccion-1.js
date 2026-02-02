/**
 * LIMPIAR Y REGENERAR UNA SECCIÓN
 * ================================
 * Paso 1: Borrar TODOS los asientos
 * Paso 2: Generar solo PREFERENTE CENTRAL
 */

const https = require('https');

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

function puntoEnPoligono(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function encontrarLimitesX(polygon, y) {
  const intersecciones = [];
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const yi = polygon[i].y, yj = polygon[j].y;
    const xi = polygon[i].x, xj = polygon[j].x;
    if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
      const t = (y - yi) / (yj - yi);
      intersecciones.push(xi + t * (xj - xi));
    }
  }
  intersecciones.sort((a, b) => a - b);
  return intersecciones.length >= 2 ? { minX: intersecciones[0], maxX: intersecciones[intersecciones.length - 1] } : null;
}

function generarPreferenteCentral(section) {
  const polygon = section.polygonPoints;
  const TOTAL = 792, FILAS = 16;
  
  const ys = polygon.map(p => p.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  
  const asientosPorFila = Math.floor(TOTAL / FILAS);
  const asientosExtra = TOTAL % FILAS;
  
  const margenY = 8;
  const espacioY = ((maxY - minY) - 2 * margenY) / (FILAS - 1);
  const seatSize = 9;
  
  const seats = [];
  const labels = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];
  let num = 1;
  
  for (let f = 0; f < FILAS; f++) {
    const y = minY + margenY + f * espacioY;
    const enFila = asientosPorFila + (f < asientosExtra ? 1 : 0);
    const lim = encontrarLimitesX(polygon, y);
    if (!lim) continue;
    
    const margenX = 5;
    const xMin = lim.minX + margenX, xMax = lim.maxX - margenX;
    const espacioX = (xMax - xMin) / (enFila - 1);
    
    for (let i = 0; i < enFila; i++) {
      const x = xMin + i * espacioX;
      seats.push({
        id: `prfc-${labels[f]}-${num}`,
        label: `PRFC-${labels[f]}${num}`,
        rowLabel: labels[f],
        columnNumber: num,
        sectionId: section.id,
        status: 'AVAILABLE',
        position: { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 },
        size: { width: seatSize, height: seatSize },
        metadata: { fill: section.color, sectionName: section.name, displayLabel: `${labels[f]}-${num}` }
      });
      num++;
    }
  }
  
  return seats;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧹 LIMPIANDO Y GENERANDO PREFERENTE CENTRAL');
  console.log('='.repeat(60));
  
  // 1. Obtener layout
  const getResp = await httpsRequest({
    hostname: BASE_URL, port: 443,
    path: `/api/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`,
    method: 'GET'
  });
  
  const layout = JSON.parse(getResp.data);
  const sections = layout.layoutJson?.sections || [];
  const section = sections.find(s => s.name === 'PREFERENTE CENTRAL');
  
  console.log(`\n✅ Layout v${layout.version}`);
  
  // 2. Generar asientos
  const nuevosAsientos = generarPreferenteCentral(section);
  console.log(`✅ Generados: ${nuevosAsientos.length} asientos`);
  
  // 3. Guardar SOLO estos asientos (limpiar todo lo demás)
  console.log('\n💾 Guardando (reemplazando TODO)...');
  
  // Actualizar capacity
  const seccionesAct = sections.map(s => ({
    ...s,
    capacity: s.id === section.id ? nuevosAsientos.length : 0
  }));
  
  const payload = {
    layoutId: LAYOUT_ID,
    layoutJson: {
      canvas: layout.layoutJson?.canvas || {},
      zones: layout.layoutJson?.zones || [],
      sections: seccionesAct
    },
    seats: nuevosAsientos  // Solo esta sección
  };
  
  const postData = JSON.stringify(payload);
  
  const saveResp = await httpsRequest({
    hostname: BASE_URL, port: 443,
    path: `/api/venues/${VENUE_ID}/layout`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, postData);
  
  if (saveResp.statusCode === 200) {
    const r = JSON.parse(saveResp.data);
    console.log(`✅ Guardado! v${r.version}, seats: ${r.sync?.seats?.created}`);
  } else {
    console.log(`❌ Error ${saveResp.statusCode}: ${saveResp.data.substring(0, 200)}`);
  }
}

main().catch(console.error);
