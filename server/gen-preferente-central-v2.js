/**
 * GENERADOR: PREFERENTE CENTRAL
 * Solo genera asientos para esta sección específica
 */

const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const LAYOUT_ID = '463cd0db-a5f8-43da-b416-b704f0e3fdba';
const SECTION_NAME = 'PREFERENTE CENTRAL';

// Datos del Excel - PREFERENTE CENTRAL
const FILAS_DATA = [
  { fila: 'A', cantidad: 42, inicio: 37, fin: 78 },
  { fila: 'B', cantidad: 43, inicio: 38, fin: 80 },
  { fila: 'C', cantidad: 44, inicio: 38, fin: 81 },
  { fila: 'D', cantidad: 45, inicio: 39, fin: 83 },
  { fila: 'E', cantidad: 46, inicio: 39, fin: 84 },
  { fila: 'F', cantidad: 47, inicio: 40, fin: 86 },
  { fila: 'G', cantidad: 48, inicio: 40, fin: 87 },
  { fila: 'H', cantidad: 49, inicio: 41, fin: 89 },
  { fila: 'I', cantidad: 50, inicio: 41, fin: 90 },
  { fila: 'J', cantidad: 51, inicio: 42, fin: 92 },
  { fila: 'K', cantidad: 52, inicio: 42, fin: 93 },
  { fila: 'L', cantidad: 53, inicio: 43, fin: 95 },
  { fila: 'M', cantidad: 54, inicio: 43, fin: 96 },
  { fila: 'N', cantidad: 55, inicio: 43, fin: 97 },
  { fila: 'O', cantidad: 56, inicio: 44, fin: 99 },
  { fila: 'P', cantidad: 57, inicio: 44, fin: 100 }
];

const TOTAL_ESPERADO = 792;
const COLOR = '#22C55E'; // Verde para PREFERENTE

// Función para encontrar los límites X en una línea Y del trapecio
function getLimitsAtY(polygon, y) {
  const intersections = [];
  
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    
    // Verificar si la línea cruza este borde
    if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
      const t = (y - p1.y) / (p2.y - p1.y);
      const x = p1.x + t * (p2.x - p1.x);
      intersections.push(x);
    }
  }
  
  intersections.sort((a, b) => a - b);
  
  if (intersections.length >= 2) {
    return { minX: intersections[0], maxX: intersections[intersections.length - 1] };
  }
  return null;
}

function generateSeats(polygon, sectionId) {
  const seats = [];
  
  // Bounds del polígono
  const ys = polygon.map(p => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const numFilas = FILAS_DATA.length; // 16 filas
  const margin = 5;
  const usableHeight = (maxY - minY) - (margin * 2);
  const rowSpacing = usableHeight / (numFilas - 1);
  
  console.log(`\nGenerando ${SECTION_NAME}:`);
  console.log(`  Polígono Y: ${minY.toFixed(1)} - ${maxY.toFixed(1)}`);
  console.log(`  Espacio entre filas: ${rowSpacing.toFixed(1)}px`);
  
  // Fila A está más cerca del escenario (Y alto = maxY)
  // Fila P está más lejos del escenario (Y bajo = minY)
  
  for (let filaIdx = 0; filaIdx < numFilas; filaIdx++) {
    const filaData = FILAS_DATA[filaIdx];
    
    // Y para esta fila - A está abajo (maxY), P está arriba (minY)
    const y = maxY - margin - (filaIdx * rowSpacing);
    
    // Obtener límites X en esta Y
    const limits = getLimitsAtY(polygon, y);
    if (!limits) {
      console.log(`  Fila ${filaData.fila}: No se encontraron límites en Y=${y.toFixed(1)}`);
      continue;
    }
    
    const rowWidth = limits.maxX - limits.minX;
    const seatCount = filaData.cantidad;
    const seatSpacing = (rowWidth - 10) / (seatCount - 1); // 5px margen cada lado
    const seatSize = Math.min(seatSpacing * 0.85, 10); // máximo 10px
    
    // DERECHA A IZQ: números altos a la derecha (X alto)
    // Entonces iteramos de derecha a izquierda
    for (let seatIdx = 0; seatIdx < seatCount; seatIdx++) {
      const seatNumber = filaData.fin - seatIdx; // 78, 77, 76... para fila A
      const x = limits.maxX - 5 - (seatIdx * seatSpacing);
      
      const seatId = `prfc-${filaData.fila}-${seatNumber}`;
      
      seats.push({
        id: seatId,
        label: `${filaData.fila}-${seatNumber}`,  // Label único: FILA-NUMERO
        name: `${filaData.fila}-${seatNumber}`,
        zoneId: null,
        seatType: 'preferente',
        status: 'available',
        price: null,
        rowLabel: filaData.fila,
        columnNumber: seatNumber,
        position: { x, y, angle: 0 },
        size: { width: seatSize, height: seatSize },
        sectionId: sectionId,
        metadata: {
          canvas: {
            position: { x, y, angle: 0 },
            size: { width: seatSize, height: seatSize },
            label: `${filaData.fila}-${seatNumber}`
          },
          shape: 'circle',
          fill: COLOR,
          stroke: '#1e293b',
          strokeWidth: 1,
          row: filaData.fila,
          number: seatNumber,
          category: 'PREFERENTE'
        }
      });
    }
    
    console.log(`  Fila ${filaData.fila}: ${seatCount} asientos (${filaData.inicio}-${filaData.fin}) en Y=${y.toFixed(1)}`);
  }
  
  return seats;
}

// Main
async function main() {
  console.log('=== GENERADOR PREFERENTE CENTRAL ===\n');
  
  // 1. Obtener layout actual
  const layoutData = await new Promise((resolve, reject) => {
    https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}/layouts/${LAYOUT_ID}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
  
  console.log('Layout actual:');
  console.log(`  Versión: ${layoutData.version}`);
  console.log(`  Seats actuales: ${layoutData.seats?.length || 0}`);
  
  // 2. Obtener venue para el layoutJson
  const venueData = await new Promise((resolve, reject) => {
    https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
  
  const layoutJson = venueData.layoutJson;
  const sections = layoutJson?.sections || [];
  
  // 3. Encontrar sección PREFERENTE CENTRAL
  const section = sections.find(s => s.name === SECTION_NAME);
  if (!section) {
    console.error(`ERROR: Sección ${SECTION_NAME} no encontrada`);
    return;
  }
  
  console.log(`\nSección encontrada: ${section.name}`);
  console.log(`  ID: ${section.id}`);
  
  // 4. Generar asientos
  const newSeats = generateSeats(section.polygonPoints, section.id);
  
  console.log(`\n✅ Total generados: ${newSeats.length} (esperado: ${TOTAL_ESPERADO})`);
  
  if (newSeats.length !== TOTAL_ESPERADO) {
    console.error(`⚠️  ADVERTENCIA: Cantidad no coincide!`);
  }
  
  // 5. Obtener asientos de OTRAS secciones (mantenerlos)
  const existingSeats = layoutData.seats || [];
  const otherSeats = existingSeats.filter(s => 
    s.metadata?.sectionId !== section.id && 
    s.sectionId !== section.id &&
    !s.id?.startsWith('prfc-')
  );
  
  console.log(`\nAsientos existentes de otras secciones: ${otherSeats.length}`);
  
  // 6. Combinar
  const allSeats = [...otherSeats, ...newSeats];
  console.log(`Total a guardar: ${allSeats.length}`);
  
  // 7. Actualizar capacity de la sección
  const updatedSections = sections.map(s => {
    if (s.id === section.id) {
      return { ...s, capacity: TOTAL_ESPERADO };
    }
    return s;
  });
  
  // 8. Preparar payload
  const payload = {
    layoutId: LAYOUT_ID,
    layoutJson: {
      canvas: layoutJson.canvas || {},
      zones: layoutJson.zones || [],
      sections: updatedSections
    },
    seats: allSeats.map(s => ({
      id: s.id,
      label: s.label,
      name: s.name,
      zoneId: s.zoneId || undefined,
      seatType: s.seatType,
      status: s.status || 'available',
      price: s.price || undefined,
      rowLabel: s.rowLabel || s.metadata?.row,
      columnNumber: s.columnNumber || s.metadata?.number,
      position: s.position || s.metadata?.canvas?.position,
      size: s.size || s.metadata?.canvas?.size,
      sectionId: s.sectionId || s.metadata?.sectionId,
      metadata: s.metadata
    }))
  };
  
  // Guardar localmente primero
  fs.writeFileSync('server/preferente-central-preview.json', JSON.stringify(payload, null, 2));
  console.log('\n📁 Preview guardado en: server/preferente-central-preview.json');
  
  // 9. Preguntar antes de subir
  console.log('\n¿Subir al servidor? (ejecutar con --upload para confirmar)');
  
  if (process.argv.includes('--upload')) {
    console.log('\n📤 Subiendo al servidor...');
    
    const postData = JSON.stringify(payload);
    
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'update.compratuboleto.mx',
        port: 443,
        path: `/api/venues/${VENUE_ID}/layout`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'X-Force-Overwrite': 'true'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    
    if (result.status === 200) {
      const response = JSON.parse(result.data);
      console.log(`✅ Subido! Nueva versión: ${response.version}`);
    } else {
      console.log(`❌ Error ${result.status}: ${result.data.substring(0, 300)}`);
    }
  }
}

main().catch(console.error);
