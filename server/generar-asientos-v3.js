/**
 * GENERADOR DE ASIENTOS V3 - TEATRO DE LA CIUDAD
 * ===============================================
 * - Respeta la inclinación de cada polígono
 * - Tamaño de asiento ajustado por sección
 * - Todos los asientos DENTRO del polígono
 * - Una sección a la vez
 */

const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const BASE_URL = 'update.compratuboleto.mx';

// TOTALES EXACTOS del PDF
const SECCIONES_CONFIG = {
  'PREFERENTE DERECHA':   { total: 631, filas: 16 },
  'PREFERENTE CENTRAL':   { total: 792, filas: 16 },
  'PREFERENTE IZQUIERDA': { total: 638, filas: 16 },
  'PLUS DERECHA':         { total: 435, filas: 16 },
  'PLUS CENTRAL':         { total: 414, filas: 16 },
  'PLUS IZQUIERDA':       { total: 445, filas: 16 },
  'VIP DERECHA':          { total: 182, filas: 8 },
  'VIP CENTRAL':          { total: 144, filas: 8 },
  'VIP IZQUIERDA':        { total: 188, filas: 8 }
};

// ============================================
// FUNCIONES DE GEOMETRÍA
// ============================================

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

// Calcular el ángulo de inclinación del polígono basado en sus bordes
function calcularInclinacion(polygon, nombre) {
  // Para secciones CENTRAL, no hay inclinación
  if (nombre.includes('CENTRAL')) {
    return 0;
  }
  
  // Para DERECHA: el polígono se inclina hacia la izquierda (ángulo negativo)
  // Para IZQUIERDA: el polígono se inclina hacia la derecha (ángulo positivo)
  
  // Encontrar los puntos más arriba (Y mínimo) y más abajo (Y máximo)
  let topPoints = [];
  let bottomPoints = [];
  
  const ys = polygon.map(p => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const midY = (minY + maxY) / 2;
  
  polygon.forEach(p => {
    if (p.y < midY) topPoints.push(p);
    else bottomPoints.push(p);
  });
  
  // Calcular centroide de puntos superiores e inferiores
  const topCenterX = topPoints.reduce((sum, p) => sum + p.x, 0) / topPoints.length;
  const bottomCenterX = bottomPoints.reduce((sum, p) => sum + p.x, 0) / bottomPoints.length;
  
  // Calcular ángulo
  const dx = bottomCenterX - topCenterX;
  const dy = maxY - minY;
  const angulo = Math.atan2(dx, dy); // Radianes
  
  return angulo;
}

// Encontrar los límites X del polígono a una altura Y dada
function encontrarLimitesX(polygon, y) {
  const intersecciones = [];
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].y, yj = polygon[j].y;
    const xi = polygon[i].x, xj = polygon[j].x;
    
    // Verificar si la línea Y cruza este segmento
    if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
      // Calcular X de intersección
      const t = (y - yi) / (yj - yi);
      const x = xi + t * (xj - xi);
      intersecciones.push(x);
    }
  }
  
  intersecciones.sort((a, b) => a - b);
  
  if (intersecciones.length >= 2) {
    return { minX: intersecciones[0], maxX: intersecciones[intersecciones.length - 1] };
  }
  
  return null;
}

// Generar asientos para UNA sección
function generarAsientosSeccion(section, config) {
  const polygon = section.polygonPoints;
  const { total, filas } = config;
  
  // Calcular límites del polígono
  const ys = polygon.map(p => p.y);
  const xs = polygon.map(p => p.x);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  
  // Calcular inclinación
  const angulo = calcularInclinacion(polygon, section.name);
  const anguloGrados = (angulo * 180 / Math.PI).toFixed(1);
  
  console.log(`\n  📐 ${section.name}:`);
  console.log(`     Polígono: ${polygon.length} puntos`);
  console.log(`     Inclinación: ${anguloGrados}°`);
  console.log(`     Área: X(${minX.toFixed(0)}-${maxX.toFixed(0)}), Y(${minY.toFixed(0)}-${maxY.toFixed(0)})`);
  console.log(`     Objetivo: ${total} asientos en ${filas} filas`);
  
  // Calcular distribución de asientos por fila
  const asientosPorFila = Math.floor(total / filas);
  const asientosExtra = total % filas;
  
  // Calcular espaciado vertical
  const alturaDisponible = maxY - minY;
  const margenVertical = alturaDisponible * 0.05; // 5% margen
  const espacioVertical = (alturaDisponible - 2 * margenVertical) / (filas - 1);
  
  // Determinar labels de fila
  const esVIP = section.name.includes('VIP');
  const filasLabels = esVIP 
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  
  // Prefijo único para labels
  const zonaPrefix = section.name.includes('PREFERENTE') ? 'PRF' : 
                    section.name.includes('PLUS') ? 'PLS' : 'VIP';
  const posPrefix = section.name.includes('DERECHA') ? 'D' :
                   section.name.includes('CENTRAL') ? 'C' : 'I';
  
  const seats = [];
  let seatNumber = 1;
  
  // Generar fila por fila
  for (let filaIdx = 0; filaIdx < filas; filaIdx++) {
    const filaLabel = filasLabels[filaIdx];
    
    // Posición Y de esta fila (de arriba hacia abajo)
    const baseY = minY + margenVertical + filaIdx * espacioVertical;
    
    // Asientos en esta fila (distribuir extras en primeras filas)
    const asientosEnFila = asientosPorFila + (filaIdx < asientosExtra ? 1 : 0);
    
    // Encontrar límites X para esta fila dentro del polígono
    const limites = encontrarLimitesX(polygon, baseY);
    if (!limites) continue;
    
    const anchoFila = limites.maxX - limites.minX;
    const margenHorizontal = anchoFila * 0.03; // 3% margen
    const anchoUtil = anchoFila - 2 * margenHorizontal;
    
    // Espaciado horizontal para esta fila
    const espacioH = asientosEnFila > 1 ? anchoUtil / (asientosEnFila - 1) : 0;
    
    // Calcular tamaño de asiento para esta sección
    const seatSize = Math.min(espacioH * 0.8, espacioVertical * 0.7, 12);
    
    // Generar asientos de esta fila
    for (let i = 0; i < asientosEnFila; i++) {
      // Posición X base
      const baseX = asientosEnFila > 1 
        ? limites.minX + margenHorizontal + i * espacioH
        : (limites.minX + limites.maxX) / 2;
      
      // Aplicar inclinación: ajustar Y según la posición X relativa al centro
      const centroX = (limites.minX + limites.maxX) / 2;
      const offsetX = baseX - centroX;
      const offsetY = offsetX * Math.tan(angulo);
      
      const x = baseX;
      const y = baseY + offsetY;
      
      // Verificar que está dentro del polígono
      if (!puntoEnPoligono(x, y, polygon)) {
        // Buscar punto más cercano dentro
        let found = false;
        for (let offset = 1; offset <= 20 && !found; offset++) {
          for (const [dx, dy] of [[0, -offset], [0, offset], [-offset, 0], [offset, 0]]) {
            if (puntoEnPoligono(x + dx, y + dy, polygon)) {
              seats.push(crearAsiento(x + dx, y + dy, filaLabel, seatNumber, section, zonaPrefix, posPrefix, seatSize));
              seatNumber++;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          // Forzar dentro de los límites
          const clampedX = Math.max(limites.minX + 5, Math.min(limites.maxX - 5, x));
          seats.push(crearAsiento(clampedX, baseY, filaLabel, seatNumber, section, zonaPrefix, posPrefix, seatSize));
          seatNumber++;
        }
      } else {
        seats.push(crearAsiento(x, y, filaLabel, seatNumber, section, zonaPrefix, posPrefix, seatSize));
        seatNumber++;
      }
    }
  }
  
  console.log(`     ✅ Generados: ${seats.length} asientos`);
  
  // Verificar
  if (seats.length !== total) {
    console.log(`     ⚠️ Diferencia: ${seats.length - total}`);
  }
  
  return seats;
}

function crearAsiento(x, y, filaLabel, seatNumber, section, zonaPrefix, posPrefix, seatSize) {
  return {
    id: `seat-${section.id}-${filaLabel}-${seatNumber}`,
    label: `${zonaPrefix}${posPrefix}-${filaLabel}${seatNumber}`,
    rowLabel: filaLabel,
    columnNumber: seatNumber,
    sectionId: section.id,
    status: 'AVAILABLE',
    position: {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100
    },
    size: {
      width: Math.round(seatSize * 10) / 10,
      height: Math.round(seatSize * 10) / 10
    },
    metadata: {
      fill: section.color,
      stroke: section.color.replace('60', '').replace('90', ''),
      sectionName: section.name,
      displayLabel: `${filaLabel}-${seatNumber}`
    }
  };
}

// ============================================
// FUNCIONES DE RED
// ============================================

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

// ============================================
// MAIN
// ============================================

async function main() {
  try {
    console.log('='.repeat(70));
    console.log('🎭 GENERADOR DE ASIENTOS V3 - INCLINACIÓN CORRECTA');
    console.log('='.repeat(70));
    
    // 1. Obtener layout
    console.log('\n📥 Obteniendo layout...');
    const getResponse = await httpsRequest({
      hostname: BASE_URL, port: 443,
      path: `/api/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`,
      method: 'GET'
    });
    
    if (getResponse.statusCode !== 200) {
      throw new Error(`Error: ${getResponse.statusCode}`);
    }
    
    const layout = JSON.parse(getResponse.data);
    const sections = layout.layoutJson?.sections || [];
    
    console.log(`✅ Layout v${layout.version}, ${sections.length} secciones`);
    
    // 2. Generar asientos sección por sección
    console.log('\n📐 Generando asientos por sección...');
    
    const todosLosAsientos = [];
    const seccionesActualizadas = [];
    
    const ordenSecciones = [
      'PREFERENTE DERECHA', 'PREFERENTE CENTRAL', 'PREFERENTE IZQUIERDA',
      'PLUS DERECHA', 'PLUS CENTRAL', 'PLUS IZQUIERDA',
      'VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA'
    ];
    
    for (const nombreSeccion of ordenSecciones) {
      const section = sections.find(s => s.name.toUpperCase() === nombreSeccion.toUpperCase());
      if (!section) {
        console.log(`\n  ⚠️ No encontrada: ${nombreSeccion}`);
        continue;
      }
      
      const config = SECCIONES_CONFIG[nombreSeccion.toUpperCase()];
      if (!config) continue;
      
      const asientos = generarAsientosSeccion(section, config);
      todosLosAsientos.push(...asientos);
      
      seccionesActualizadas.push({
        ...section,
        capacity: asientos.length
      });
    }
    
    // 3. Resumen
    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 RESUMEN TOTAL:`);
    console.log(`   Asientos generados: ${todosLosAsientos.length}`);
    console.log(`   Esperado: 3,869`);
    console.log(`   ${todosLosAsientos.length === 3869 ? '✅ EXACTO!' : '⚠️ Diferencia: ' + (todosLosAsientos.length - 3869)}`);
    
    // 4. Guardar
    console.log('\n💾 Guardando...');
    
    const payload = {
      layoutId: LAYOUT_ID,
      layoutJson: {
        canvas: layout.layoutJson?.canvas || {},
        zones: layout.layoutJson?.zones || [],
        sections: seccionesActualizadas
      },
      seats: todosLosAsientos
    };
    
    const postData = JSON.stringify(payload);
    console.log(`   Payload: ${(postData.length / 1024).toFixed(1)} KB`);
    
    const saveResponse = await httpsRequest({
      hostname: BASE_URL, port: 443,
      path: `/api/venues/${VENUE_ID}/layout`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, postData);
    
    if (saveResponse.statusCode === 200) {
      const result = JSON.parse(saveResponse.data);
      console.log(`\n✅ GUARDADO! Versión: ${result.version}`);
      console.log(`   Asientos en DB: ${result.sync?.seats?.created || 'N/A'}`);
    } else {
      console.log(`\n❌ Error ${saveResponse.statusCode}`);
      console.log(saveResponse.data.substring(0, 300));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main();
