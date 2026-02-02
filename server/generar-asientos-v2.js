/**
 * GENERADOR DE ASIENTOS V2 - TEATRO DE LA CIUDAD
 * ===============================================
 * Genera 3,869 asientos siguiendo el PDF
 * Usa el formato correcto de la API (seats como array separado)
 */

const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const BASE_URL = 'update.compratuboleto.mx';

const SEAT_SIZE = 10;

// TOTALES EXACTOS del PDF
const TOTALES_PDF = {
  'PREFERENTE DERECHA': { total: 631, filas: 16 },
  'PREFERENTE CENTRAL': { total: 792, filas: 16 },
  'PREFERENTE IZQUIERDA': { total: 638, filas: 16 },
  'PLUS DERECHA': { total: 435, filas: 16 },
  'PLUS CENTRAL': { total: 414, filas: 16 },
  'PLUS IZQUIERDA': { total: 445, filas: 16 },
  'VIP DERECHA': { total: 182, filas: 8 },
  'VIP CENTRAL': { total: 144, filas: 8 },
  'VIP IZQUIERDA': { total: 188, filas: 8 }
};

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

function getLimites(polygon) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys)
  };
}

function generarAsientosExactos(section, totalAsientos, numFilas, startNumber) {
  const polygon = section.polygonPoints;
  const limites = getLimites(polygon);
  
  const esVIP = section.name.includes('VIP');
  const filasLabels = esVIP 
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  
  const seats = [];
  const asientosPorFila = Math.floor(totalAsientos / numFilas);
  const asientosExtra = totalAsientos % numFilas;
  const alturaTotal = limites.maxY - limites.minY;
  const espacioVertical = alturaTotal / (numFilas + 1);
  
  console.log(`\n  ${section.name}:`);
  console.log(`    Total: ${totalAsientos}, Filas: ${numFilas}, ~${asientosPorFila}/fila`);
  
  let seatCounter = 0;
  
  for (let filaIdx = 0; filaIdx < numFilas; filaIdx++) {
    const filaLabel = filasLabels[filaIdx];
    const y = limites.minY + espacioVertical * (filaIdx + 1);
    const asientosEnFila = asientosPorFila + (filaIdx < asientosExtra ? 1 : 0);
    
    const anchoFila = limites.maxX - limites.minX;
    const espacioX = anchoFila / (asientosEnFila + 1);
    
    for (let i = 0; i < asientosEnFila; i++) {
      let x = limites.minX + espacioX * (i + 1);
      
      // Ajustar si está fuera del polígono
      if (!puntoEnPoligono(x, y, polygon)) {
        for (let offset = 1; offset <= 50; offset++) {
          if (puntoEnPoligono(x + offset, y, polygon)) { x = x + offset; break; }
          if (puntoEnPoligono(x - offset, y, polygon)) { x = x - offset; break; }
        }
      }
      
      const seatNumber = startNumber + seatCounter;
      seatCounter++;
      
      // Prefijo de zona para labels únicos
      const zonaPrefix = section.name.includes('PREFERENTE') ? 'PRF' : 
                        section.name.includes('PLUS') ? 'PLS' : 'VIP';
      const posPrefix = section.name.includes('DERECHA') ? 'D' :
                       section.name.includes('CENTRAL') ? 'C' : 'I';
      
      // Formato que espera la API
      seats.push({
        id: `seat-${section.id}-${filaLabel}-${seatNumber}`,
        label: `${zonaPrefix}${posPrefix}-${filaLabel}${seatNumber}`,  // Ej: PRFD-A1, PLSC-B25
        rowLabel: filaLabel,
        columnNumber: seatNumber,
        sectionId: section.id,
        status: 'AVAILABLE',
        position: {
          x: Math.round(x * 100) / 100,
          y: Math.round(y * 100) / 100
        },
        size: {
          width: SEAT_SIZE,
          height: SEAT_SIZE
        },
        metadata: {
          fill: section.color,
          stroke: section.color.replace('60', '').replace('90', ''),
          sectionName: section.name,
          displayLabel: `${filaLabel}-${seatNumber}` // Label para mostrar al usuario
        }
      });
    }
  }
  
  console.log(`    ✅ Generados: ${seats.length}`);
  return seats;
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    console.log('='.repeat(70));
    console.log('🎭 GENERADOR DE ASIENTOS V2 - TEATRO DE LA CIUDAD');
    console.log('='.repeat(70));
    
    // 1. Obtener datos actuales
    console.log('\n📥 Obteniendo layout actual...');
    const getResponse = await httpsRequest({
      hostname: BASE_URL,
      port: 443,
      path: `/api/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`,
      method: 'GET'
    });
    
    if (getResponse.statusCode !== 200) {
      throw new Error(`Error obteniendo layout: ${getResponse.statusCode}`);
    }
    
    const layout = JSON.parse(getResponse.data);
    const sections = layout.layoutJson?.sections || [];
    const canvas = layout.layoutJson?.canvas || {};
    const zones = layout.layoutJson?.zones || [];
    
    console.log(`✅ Layout: ${layout.name}`);
    console.log(`   Version: ${layout.version}`);
    console.log(`   Secciones: ${sections.length}`);
    
    // 2. Generar asientos
    console.log('\n📐 Generando asientos exactos...');
    const todosLosAsientos = [];
    const seccionesActualizadas = [];
    
    const ordenSecciones = [
      'PREFERENTE DERECHA', 'PREFERENTE CENTRAL', 'PREFERENTE IZQUIERDA',
      'PLUS DERECHA', 'PLUS CENTRAL', 'PLUS IZQUIERDA',
      'VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA'
    ];
    
    let numeroActual = 1;
    let zonaActual = '';
    
    for (const nombreSeccion of ordenSecciones) {
      const section = sections.find(s => s.name.toUpperCase() === nombreSeccion.toUpperCase());
      if (!section) continue;
      
      const zona = nombreSeccion.split(' ')[0];
      if (zona !== zonaActual) {
        zonaActual = zona;
        numeroActual = 1;
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`📍 ZONA ${zona}`);
      }
      
      const config = TOTALES_PDF[nombreSeccion.toUpperCase()];
      if (!config) continue;
      
      const asientos = generarAsientosExactos(section, config.total, config.filas, numeroActual);
      numeroActual += asientos.length;
      
      todosLosAsientos.push(...asientos);
      
      // Actualizar sección con capacity
      seccionesActualizadas.push({
        ...section,
        capacity: asientos.length
      });
    }
    
    // 3. Resumen
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 RESUMEN:`);
    console.log(`   Total asientos: ${todosLosAsientos.length}`);
    console.log(`   Esperado: 3,869`);
    console.log(`   ${todosLosAsientos.length === 3869 ? '✅ EXACTO!' : '⚠️ Diferencia: ' + (todosLosAsientos.length - 3869)}`);
    
    // 4. Guardar con el formato correcto
    console.log('\n💾 Guardando en servidor...');
    
    const payload = {
      layoutId: LAYOUT_ID,
      layoutJson: {
        canvas: canvas,
        zones: zones,
        sections: seccionesActualizadas
      },
      seats: todosLosAsientos // ← ARRAY SEPARADO como espera la API
    };
    
    const postData = JSON.stringify(payload);
    console.log(`   Payload size: ${(postData.length / 1024).toFixed(1)} KB`);
    
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
    
    console.log(`   Response: ${saveResponse.statusCode}`);
    
    if (saveResponse.statusCode === 200 || saveResponse.statusCode === 201) {
      const result = JSON.parse(saveResponse.data);
      console.log('\n✅ GUARDADO EXITOSAMENTE!');
      console.log(`   Nueva versión: ${result.version}`);
      if (result.sync) {
        console.log(`   Asientos creados: ${result.sync.seats?.created || 0}`);
      }
    } else {
      console.log(`\n❌ Error: ${saveResponse.data.substring(0, 500)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
