/**
 * GENERADOR DE ASIENTOS - TEATRO DE LA CIUDAD
 * ============================================
 * Genera 3,869 asientos siguiendo el PDF
 * - Mismo tamaño para todos
 * - Colores de los polígonos
 * - Numeración continua por zona
 */

const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const BASE_URL = 'update.compratuboleto.mx';

// Timeout más largo para conexiones lentas
const REQUEST_TIMEOUT = 30000; // 30 segundos

// Configuración de asientos
const SEAT_SIZE = 10; // Tamaño uniforme para todos los asientos

// TOTALES EXACTOS del PDF por sección
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

// Función para verificar si un punto está dentro de un polígono
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

// Función para obtener los límites de un polígono
function getLimites(polygon) {
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

// Función para generar asientos EXACTOS en un polígono
function generarAsientosExactos(section, totalAsientos, numFilas, startNumber) {
  const polygon = section.polygonPoints;
  const limites = getLimites(polygon);
  const color = section.color;
  
  // Filas según la zona
  const esVIP = section.name.includes('VIP');
  const filasLabels = esVIP 
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
  
  const seats = [];
  
  // Calcular asientos por fila (distribuir uniformemente)
  const asientosPorFila = Math.floor(totalAsientos / numFilas);
  const asientosExtra = totalAsientos % numFilas;
  
  // Calcular espaciado vertical
  const alturaTotal = limites.maxY - limites.minY;
  const espacioVertical = alturaTotal / (numFilas + 1);
  
  console.log(`\n  Generando ${section.name}:`);
  console.log(`    Límites: X(${limites.minX.toFixed(0)}-${limites.maxX.toFixed(0)}), Y(${limites.minY.toFixed(0)}-${limites.maxY.toFixed(0)})`);
  console.log(`    Total requerido: ${totalAsientos}, Filas: ${numFilas}, ~${asientosPorFila} por fila`);
  
  let seatCounter = 0;
  
  // Para cada fila
  for (let filaIdx = 0; filaIdx < numFilas; filaIdx++) {
    const filaLabel = filasLabels[filaIdx];
    const y = limites.minY + espacioVertical * (filaIdx + 1);
    
    // Asientos en esta fila (las primeras filas tienen los extras)
    const asientosEnFila = asientosPorFila + (filaIdx < asientosExtra ? 1 : 0);
    
    // Usar los límites completos del polígono para esta fila
    // En lugar de buscar solo puntos dentro, usamos el ancho total
    const anchoFila = limites.maxX - limites.minX;
    const espacioX = anchoFila / (asientosEnFila + 1);
    
    // Generar asientos de esta fila
    for (let i = 0; i < asientosEnFila; i++) {
      const x = limites.minX + espacioX * (i + 1);
      
      // Si el asiento cae fuera del polígono, buscar el punto más cercano dentro
      let finalX = x;
      let finalY = y;
      
      if (!puntoEnPoligono(x, y, polygon)) {
        // Buscar el punto más cercano dentro del polígono en la misma fila
        let encontrado = false;
        for (let offset = 1; offset <= 50 && !encontrado; offset++) {
          if (puntoEnPoligono(x + offset, y, polygon)) {
            finalX = x + offset;
            encontrado = true;
          } else if (puntoEnPoligono(x - offset, y, polygon)) {
            finalX = x - offset;
            encontrado = true;
          }
        }
        // Si no se encuentra, forzar dentro de los límites
        if (!encontrado) {
          finalX = Math.max(limites.minX + 5, Math.min(limites.maxX - 5, x));
        }
      }
      
      const seatNumber = startNumber + seatCounter;
      seatCounter++;
      
      seats.push({
        id: `seat-${section.id}-${filaLabel}-${seatNumber}`,
        x: Math.round(finalX * 100) / 100,
        y: Math.round(finalY * 100) / 100,
        row: filaLabel,
        number: seatNumber,
        label: `${filaLabel}-${seatNumber}`,
        status: 'available',
        sectionId: section.id,
        price: 0,
        width: SEAT_SIZE,
        height: SEAT_SIZE,
        fill: color,
        stroke: color.replace('60', '').replace('90', ''),
        strokeWidth: 1
      });
    }
  }
  
  console.log(`    Asientos generados: ${seats.length}`);
  return seats;
}

// Función principal
async function generarTodosLosAsientos() {
  return new Promise((resolve, reject) => {
    // Obtener datos actuales del venue
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: `/api/venues/${VENUE_ID}`,
      method: 'GET',
      timeout: REQUEST_TIMEOUT
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const venue = JSON.parse(data);
          const sections = venue.layoutJson?.sections || [];
          const canvas = venue.layoutJson?.canvas || {};
          const zones = venue.layoutJson?.zones || [];
        
        console.log('=' .repeat(80));
        console.log('🎭 GENERANDO ASIENTOS EXACTOS - TEATRO DE LA CIUDAD');
        console.log('=' .repeat(80));
        console.log(`\nSecciones encontradas: ${sections.length}`);
        
        const seccionesActualizadas = [];
        let totalGeneral = 0;
        
        // Procesar cada zona en orden
        const ordenSecciones = [
          'PREFERENTE DERECHA', 'PREFERENTE CENTRAL', 'PREFERENTE IZQUIERDA',
          'PLUS DERECHA', 'PLUS CENTRAL', 'PLUS IZQUIERDA',
          'VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA'
        ];
        
        let numeroActual = 1;
        let zonaActual = '';
        
        for (const nombreSeccion of ordenSecciones) {
          const section = sections.find(s => 
            s.name.toUpperCase() === nombreSeccion.toUpperCase()
          );
          
          if (!section) {
            console.log(`  ⚠️ No se encontró: ${nombreSeccion}`);
            continue;
          }
          
          // Detectar cambio de zona para reiniciar numeración
          const zona = nombreSeccion.split(' ')[0];
          if (zona !== zonaActual) {
            zonaActual = zona;
            numeroActual = 1;
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`📍 ZONA ${zona}`);
            console.log(`${'─'.repeat(60)}`);
          }
          
          const config = TOTALES_PDF[nombreSeccion.toUpperCase()];
          if (!config) {
            console.log(`  ⚠️ Sin configuración para: ${nombreSeccion}`);
            continue;
          }
          
          const asientos = generarAsientosExactos(
            section, 
            config.total, 
            config.filas, 
            numeroActual
          );
          
          // Actualizar número de inicio para la siguiente sección
          numeroActual += asientos.length;
          
          // Crear sección actualizada con asientos
          seccionesActualizadas.push({
            ...section,
            seats: asientos,
            capacity: asientos.length
          });
          
          totalGeneral += asientos.length;
        }
        
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📊 RESUMEN FINAL:`);
        console.log(`${'='.repeat(80)}`);
        
        // Mostrar totales por sección
        seccionesActualizadas.forEach(sec => {
          const esperado = TOTALES_PDF[sec.name.toUpperCase()]?.total || '?';
          const check = sec.seats.length === esperado ? '✅' : '⚠️';
          console.log(`  ${check} ${sec.name}: ${sec.seats.length}/${esperado} asientos`);
        });
        
        console.log(`\n  TOTAL GENERADO: ${totalGeneral} asientos`);
        console.log(`  TOTAL ESPERADO: 3,869 asientos`);
        console.log(`  ${totalGeneral === 3869 ? '✅ EXACTO!' : '⚠️ Diferencia: ' + (totalGeneral - 3869)}`);
        
        // Preparar el layoutJson actualizado
        const layoutJsonActualizado = {
          canvas: canvas,
          zones: zones,
          sections: seccionesActualizadas
        };
        
        resolve({
          layoutJson: layoutJsonActualizado,
          totalAsientos: totalGeneral,
          secciones: seccionesActualizadas
        });
        } catch (parseError) {
          console.error('Error parsing JSON:', parseError.message);
          console.error('Response data (first 500 chars):', data.substring(0, 500));
          reject(parseError);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

// Función para guardar en el servidor
async function guardarLayout(layoutData) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba',
      layoutJson: layoutData.layoutJson,
      version: 13
    });
    
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: `/api/venues/${VENUE_ID}/layout`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    console.log('\n💾 Guardando layout en el servidor...');
    
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Layout guardado correctamente!');
          resolve(true);
        } else {
          console.log(`❌ Error ${res.statusCode}: ${body}`);
          reject(new Error(body));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Ejecutar
async function main() {
  try {
    const resultado = await generarTodosLosAsientos();
    
    // Preguntar antes de guardar (simular - guardar directamente)
    console.log('\n¿Guardar en el servidor? (ejecutando automáticamente)');
    
    await guardarLayout(resultado);
    
    console.log('\n✅ PROCESO COMPLETADO');
    console.log(`   Total asientos generados: ${resultado.totalAsientos}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
