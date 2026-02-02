const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Datos del Excel para DIAMANTE
const DIAMANTE_DATA = {
  'DIAMANTE IZQUIERDA': {
    filas: ['A', 'B', 'C', 'D'],
    asientosPorFila: 20,
    startNumber: 1,
    endNumber: 20,
    total: 80
  },
  'DIAMANTE CENTRAL': {
    filas: ['A', 'B', 'C', 'D'],
    asientosPorFila: 10,
    startNumber: 21,
    endNumber: 30,
    total: 40
  },
  'DIAMANTE DERECHA': {
    filas: ['A', 'B', 'C', 'D'],
    asientosPorFila: 20,
    startNumber: 31,
    endNumber: 50,
    total: 80
  }
};

// Función para verificar si un punto está dentro de un polígono
function isPointInPolygon(point, polygon) {
  let inside = false;
  const n = polygon.length;
  
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Obtener bounds del polígono
function getPolygonBounds(polygon) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  
  for (const p of polygon) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// Calcular el ángulo del borde más largo (orientación del polígono)
function getPolygonOrientation(polygon) {
  let maxLength = 0;
  let angle = 0;
  
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const dx = polygon[j].x - polygon[i].x;
    const dy = polygon[j].y - polygon[i].y;
    const length = Math.hypot(dx, dy);
    
    if (length > maxLength) {
      maxLength = length;
      angle = Math.atan2(dy, dx);
    }
  }
  
  return angle;
}

// Rotar un punto alrededor de un centro
function rotatePoint(point, center, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

// Generar asientos para una sección DIAMANTE
function generateDiamanteSeats(sectionName, polygon, data) {
  const seats = [];
  const bounds = getPolygonBounds(polygon);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const center = { x: centerX, y: centerY };
  
  // Obtener orientación del polígono
  const orientation = getPolygonOrientation(polygon);
  
  // Rotar polígono a horizontal para trabajar más fácil
  const rotatedPolygon = polygon.map(p => rotatePoint(p, center, -orientation));
  const rotatedBounds = getPolygonBounds(rotatedPolygon);
  
  const numRows = data.filas.length; // 4 filas: A, B, C, D
  const seatsPerRow = data.asientosPorFila;
  
  // Margen mínimo desde los bordes
  const margin = 3;
  
  // Calcular área útil
  const usableWidth = rotatedBounds.width - (margin * 2);
  const usableHeight = rotatedBounds.height - (margin * 2);
  
  // CALCULAR TAMAÑO ÓPTIMO DE ASIENTOS para que quepan TODOS
  // Tamaño = espacio disponible / cantidad de elementos
  const seatWidth = usableWidth / seatsPerRow;
  const seatHeight = usableHeight / numRows;
  
  // Usar el menor para mantener asientos cuadrados, con un poco de espacio
  const seatSize = Math.min(seatWidth, seatHeight) * 0.85; // 85% para dejar espacio
  
  // Calcular espaciado real
  const horizontalStep = usableWidth / seatsPerRow;
  const verticalStep = usableHeight / numRows;
  
  console.log(`  ${sectionName}: seatSize=${seatSize.toFixed(1)}px, hStep=${horizontalStep.toFixed(1)}, vStep=${verticalStep.toFixed(1)}`);
  
  // Fila A está más cerca del escenario (abajo), Fila D más lejos (arriba)
  // En el sistema rotado, iteramos de arriba a abajo (D, C, B, A)
  const rowOrder = ['D', 'C', 'B', 'A']; // De arriba a abajo en el canvas
  
  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const rowLabel = rowOrder[rowIdx];
    const y = rotatedBounds.minY + margin + (rowIdx * verticalStep) + (verticalStep / 2);
    
    for (let seatIdx = 0; seatIdx < seatsPerRow; seatIdx++) {
      // Numeración de DERECHA A IZQ dentro de cada sección
      // Significa que el número más alto está a la izquierda del canvas (que es derecha visto desde público)
      const seatNumber = data.endNumber - seatIdx; // Derecha a izquierda
      
      const x = rotatedBounds.minX + margin + (seatIdx * horizontalStep) + (horizontalStep / 2);
      
      // Rotar de vuelta a la posición original (SIN verificar polígono - confiamos en el cálculo)
      const testPoint = { x, y };
      const finalPos = rotatePoint(testPoint, center, orientation);
      
      const seatId = `${sectionName.toLowerCase().replace(/ /g, '-')}-${rowLabel}-${seatNumber}`;
      
      seats.push({
        id: seatId,
        label: String(seatNumber),
        name: `${rowLabel}-${seatNumber}`,
        zoneId: null,
        seatType: 'diamante',
        status: 'available',
        price: null,
        metadata: {
          canvas: {
            position: { x: finalPos.x, y: finalPos.y, angle: 0 },
            size: { width: seatSize, height: seatSize },
            label: `${rowLabel}-${seatNumber}`
          },
          shape: 'circle',
          fill: '#DC94F0',
          stroke: '#1e293b',
          strokeWidth: 1,
          row: rowLabel,
          number: seatNumber,
          category: 'DIAMANTE'
        }
      });
    }
  }
  
  console.log(`  ${sectionName}: ${seats.length} asientos generados (esperados: ${data.total})`);
  return seats;
}

// Obtener venue y generar asientos
https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const venue = JSON.parse(data);
    const layoutJson = venue.layoutJson;
    const sections = layoutJson?.sections || [];
    
    console.log('=== GENERANDO ASIENTOS ZONA DIAMANTE ===\n');
    
    // Encontrar las secciones DIAMANTE
    const diamanteSections = sections.filter(s => s.name.includes('DIAMANTE'));
    
    if (diamanteSections.length !== 3) {
      console.error('Error: Se esperaban 3 secciones DIAMANTE, encontradas:', diamanteSections.length);
      return;
    }
    
    // Generar asientos para cada sección
    let allNewSeats = [];
    
    for (const section of diamanteSections) {
      const sectionData = DIAMANTE_DATA[section.name];
      if (!sectionData) {
        console.error(`No hay datos para sección: ${section.name}`);
        continue;
      }
      
      const seats = generateDiamanteSeats(section.name, section.polygonPoints, sectionData);
      
      // Agregar asientos a la sección
      section.seats = seats;
      section.capacity = sectionData.total;
      
      allNewSeats = allNewSeats.concat(seats);
    }
    
    console.log(`\n✅ Total asientos DIAMANTE generados: ${allNewSeats.length}`);
    console.log('\nResumen por sección:');
    diamanteSections.forEach(s => {
      console.log(`  - ${s.name}: ${s.seats?.length || 0} asientos, capacity: ${s.capacity}`);
    });
    
    // Guardar el layoutJson actualizado
    const fs = require('fs');
    fs.writeFileSync(
      'server/diamante-layout-updated.json',
      JSON.stringify(layoutJson, null, 2)
    );
    console.log('\n📁 Layout guardado en: server/diamante-layout-updated.json');
    
    // Mostrar ejemplo de asientos
    console.log('\n📋 Ejemplo de asientos generados:');
    if (allNewSeats.length > 0) {
      console.log('Primeros 3:', allNewSeats.slice(0, 3).map(s => `${s.name} (${s.metadata.row}-${s.metadata.number})`));
      console.log('Últimos 3:', allNewSeats.slice(-3).map(s => `${s.name} (${s.metadata.row}-${s.metadata.number})`));
    }
  });
}).on('error', e => console.error(e));
