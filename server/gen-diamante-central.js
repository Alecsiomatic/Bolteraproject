const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Polígono de DIAMANTE CENTRAL del layout
const POLYGON = [
  { x: 844.3088419589028, y: 853.0716918000774 },
  { x: 995.2007958098349, y: 855.1955075604046 },
  { x: 978.1988855167721, y: 907.2289936884208 },
  { x: 861.3107522519656, y: 904.04327004793 }
];

// Datos del Excel para DIAMANTE CENTRAL
// 4 filas (A-D), 10 asientos por fila, numeración 21-30
const FILAS = ['A', 'B', 'C', 'D'];
const ASIENTOS_POR_FILA = 10;
const NUM_START = 21;
const NUM_END = 30;
const TOTAL_ESPERADO = 40;

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

// Verificar si punto está en polígono
function isPointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if (((yi > point.y) !== (yj > point.y)) &&
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Generar asientos
function generateSeats() {
  const bounds = getPolygonBounds(POLYGON);
  const seats = [];
  
  console.log('=== GENERADOR DIAMANTE CENTRAL ===');
  console.log('Bounds:', bounds);
  console.log('Filas:', FILAS.length, '| Asientos/fila:', ASIENTOS_POR_FILA);
  console.log('Numeración:', NUM_START, '-', NUM_END);
  
  // El polígono es casi horizontal, con ligera inclinación
  // Calcular inclinación del borde superior
  const topLeft = POLYGON[0];
  const topRight = POLYGON[1];
  const dx = topRight.x - topLeft.x;
  const dy = topRight.y - topLeft.y;
  const angle = Math.atan2(dy, dx);
  console.log('Ángulo de filas:', (angle * 180 / Math.PI).toFixed(1) + '°');
  
  // Padding interno - más padding para que quepan todos
  const paddingX = 12;
  const paddingY = 6;
  
  // Calcular espaciado
  const usableWidth = bounds.width - paddingX * 2;
  const usableHeight = bounds.height - paddingY * 2;
  const spacingX = usableWidth / (ASIENTOS_POR_FILA - 1);
  const spacingY = usableHeight / (FILAS.length - 1);
  
  console.log('Espaciado H:', spacingX.toFixed(1), '| V:', spacingY.toFixed(1));
  
  // Generar asientos por fila
  for (let rowIdx = 0; rowIdx < FILAS.length; rowIdx++) {
    const fila = FILAS[rowIdx];
    const rowY = bounds.minY + paddingY + rowIdx * spacingY;
    
    // Ajuste de inclinación por fila
    const rowOffsetX = rowIdx * (dy / dx) * spacingY;
    
    let rowSeats = 0;
    
    for (let seatIdx = 0; seatIdx < ASIENTOS_POR_FILA; seatIdx++) {
      const num = NUM_START + seatIdx;
      const x = bounds.minX + paddingX + seatIdx * spacingX + rowOffsetX;
      const y = rowY;
      
      // Verificar que está dentro del polígono
      if (!isPointInPolygon({ x, y }, POLYGON)) {
        // Ajustar ligeramente hacia el centro
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const adjustedX = x + (centerX - x) * 0.1;
        const adjustedY = y + (centerY - y) * 0.1;
        
        if (!isPointInPolygon({ x: adjustedX, y: adjustedY }, POLYGON)) {
          console.log(`  ⚠ Fila ${fila} asiento ${num} fuera del polígono`);
          continue;
        }
      }
      
      const seatId = `diamante-central-${fila}-${num}`;
      seats.push({
        id: seatId,
        label: `${fila}${num}`,
        name: `${fila}${num}`,
        rowLabel: fila,
        columnNumber: num,
        sectionId: 'section-1770168244197',
        seatType: 'STANDARD',
        status: 'available',
        position: { x, y, angle: 0 },
        size: { width: 28, height: 28 },
        metadata: {
          section: 'DIAMANTE CENTRAL',
          canvas: {
            shape: 'circle',
            radius: 12,
            fill: '#e70de0',
            stroke: '#1e293b'
          }
        }
      });
      
      rowSeats++;
    }
    
    console.log(`Fila ${fila}: ${rowSeats} asientos ✓`);
  }
  
  console.log(`\nTotal generados: ${seats.length} / ${TOTAL_ESPERADO}`);
  
  if (seats.length !== TOTAL_ESPERADO) {
    console.log('⚠ ADVERTENCIA: No coincide con el total esperado');
  }
  
  return seats;
}

// Función para obtener asientos actuales y combinar
async function getCurrentSeatsAndUpload(newSeats) {
  return new Promise((resolve, reject) => {
    https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const venue = JSON.parse(data);
          const currentSeats = venue.seats || [];
          
          // Filtrar asientos que NO son de DIAMANTE CENTRAL
          const otherSeats = currentSeats.filter(s => !s.id.startsWith('diamante-central-'));
          
          console.log(`\nAsientos actuales: ${currentSeats.length}`);
          console.log(`Asientos DIAMANTE CENTRAL existentes: ${currentSeats.length - otherSeats.length}`);
          console.log(`Otros asientos: ${otherSeats.length}`);
          console.log(`Nuevos DIAMANTE CENTRAL: ${newSeats.length}`);
          
          // Combinar
          const allSeats = [...otherSeats, ...newSeats];
          console.log(`Total combinado: ${allSeats.length}`);
          
          resolve({ venue, allSeats, layoutJson: venue.layoutJson });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Subir al servidor
async function uploadSeats(allSeats, layoutJson) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba',
      layoutJson: layoutJson,
      zones: [],
      seats: allSeats,
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
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Response status:', res.statusCode);
        try {
          const result = JSON.parse(data);
          console.log('✅ Versión:', result.version);
          resolve(result);
        } catch (e) {
          console.log('Response:', data);
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Main
async function main() {
  const dryRun = !process.argv.includes('--upload');
  
  console.log('Modo:', dryRun ? '🔍 DRY RUN (sin subir)' : '🚀 UPLOAD');
  console.log('');
  
  const newSeats = generateSeats();
  
  if (dryRun) {
    console.log('\n📋 Vista previa de primeros 5 asientos:');
    newSeats.slice(0, 5).forEach(s => {
      console.log(`  ${s.label}: (${s.position.x.toFixed(1)}, ${s.position.y.toFixed(1)})`);
    });
    console.log('\nPara subir, ejecuta: node gen-diamante-central.js --upload');
  } else {
    const { allSeats, layoutJson } = await getCurrentSeatsAndUpload(newSeats);
    await uploadSeats(allSeats, layoutJson);
    
    // Verificar
    console.log('\n=== VERIFICACIÓN ===');
    const diamanteCentralCount = allSeats.filter(s => s.id.startsWith('diamante-central-')).length;
    console.log(`DIAMANTE CENTRAL: ${diamanteCentralCount}`);
  }
}

main().catch(console.error);
