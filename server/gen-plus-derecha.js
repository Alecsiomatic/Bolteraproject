const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const SECTION_NAME = 'PLUS DERECHA';

// Datos del Excel para PLUS DERECHA - 435 asientos total
// Dirección: DERECHA A IZQUIERDA (números altos a la derecha, bajos a la izquierda)
const FILAS_DATA = [
  // Filas P, O, N están MÁS ARRIBA (zona superior del polígono) - menos asientos
  { fila: 'P', cantidad: 25, inicio: 49, fin: 73 },
  { fila: 'O', cantidad: 25, inicio: 47, fin: 71 },
  { fila: 'N', cantidad: 24, inicio: 46, fin: 69 },
  // Filas M en adelante bajan más (zona con más espacio)
  { fila: 'M', cantidad: 31, inicio: 51, fin: 81 },
  { fila: 'L', cantidad: 30, inicio: 64, fin: 93 },
  { fila: 'K', cantidad: 30, inicio: 63, fin: 92 },
  { fila: 'J', cantidad: 29, inicio: 62, fin: 90 },
  { fila: 'I', cantidad: 29, inicio: 60, fin: 88 },
  { fila: 'H', cantidad: 28, inicio: 59, fin: 86 },
  { fila: 'G', cantidad: 28, inicio: 57, fin: 84 },
  { fila: 'F', cantidad: 27, inicio: 56, fin: 82 },
  { fila: 'E', cantidad: 27, inicio: 54, fin: 80 },
  { fila: 'D', cantidad: 26, inicio: 53, fin: 78 },
  { fila: 'C', cantidad: 26, inicio: 53, fin: 78 },
  { fila: 'B', cantidad: 25, inicio: 51, fin: 75 },
  { fila: 'A', cantidad: 25, inicio: 50, fin: 74 },
];

// Polígono con 6 puntos (tiene muesca para discapacitados)
// P0: (489.2, 608.8) - esquina superior izquierda antes de muesca
// P1: (513.5, 651.1) - punto interno de muesca
// P2: (459.5, 681.3) - punta de la muesca (hueco discapacitados)
// P3: (564.8, 864.0) - esquina inferior
// P4: (769.6, 744.6) - esquina derecha
// P5: (699.4, 487.3) - esquina superior derecha

function pointInPolygon(x, y, polygon) {
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

async function getVenue() {
  return new Promise((resolve, reject) => {
    https.get(`https://update.compratuboleto.mx/api/venues/${VENUE_ID}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

async function main() {
  console.log('=== GENERANDO ASIENTOS PARA PLUS DERECHA ===\n');
  
  const venue = await getVenue();
  const sections = venue.layoutJson?.sections || [];
  const section = sections.find(s => s.name === SECTION_NAME);
  
  if (!section) {
    console.error('No se encontró la sección:', SECTION_NAME);
    return;
  }
  
  console.log('Sección encontrada:', section.id);
  console.log('Polígono puntos:', section.polygonPoints.length);
  
  const polygon = section.polygonPoints;
  
  // Calcular bounds del polígono
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  console.log(`Bounds: X[${minX.toFixed(1)}-${maxX.toFixed(1)}] Y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
  
  // El polígono tiene forma inclinada (teatro)
  // Las filas van de arriba (P) hacia abajo (A)
  // P está más arriba (Y menor), A está más abajo (Y mayor)
  
  const totalFilas = FILAS_DATA.length; // 16 filas
  const espacioY = (maxY - minY) / (totalFilas + 1);
  
  const seats = [];
  const SEAT_SPACING = 12; // Espaciado entre asientos
  
  FILAS_DATA.forEach((filaData, filaIndex) => {
    // Y aumenta de arriba a abajo
    // Fila P (índice 0) está arriba, Fila A (índice 15) está abajo
    const rowY = minY + espacioY * (filaIndex + 1);
    
    // Para cada fila, calcular el rango X válido dentro del polígono
    // Escanear de izquierda a derecha para encontrar los límites
    let leftX = minX;
    let rightX = maxX;
    
    // Encontrar límites X en esta Y
    for (let x = minX; x <= maxX; x += 2) {
      if (pointInPolygon(x, rowY, polygon)) {
        leftX = x;
        break;
      }
    }
    for (let x = maxX; x >= minX; x -= 2) {
      if (pointInPolygon(x, rowY, polygon)) {
        rightX = x;
        break;
      }
    }
    
    const rowWidth = rightX - leftX;
    const numSeats = filaData.cantidad;
    const seatSpacing = rowWidth / (numSeats + 1);
    
    // DERECHA A IZQUIERDA: números altos a la derecha (X mayor)
    // El asiento con número mayor está a la derecha
    for (let i = 0; i < numSeats; i++) {
      const seatNumber = filaData.inicio + i;
      // i=0 es el primer asiento (número inicio), debe estar a la izquierda
      // i=cantidad-1 es el último asiento (número fin), debe estar a la derecha
      const x = leftX + seatSpacing * (i + 1);
      
      if (pointInPolygon(x, rowY, polygon)) {
        seats.push({
          id: `seat-plus-der-${filaData.fila}-${seatNumber}`,
          x: Math.round(x * 10) / 10,
          y: Math.round(rowY * 10) / 10,
          row: filaData.fila,
          number: String(seatNumber),
          label: `${filaData.fila}-${seatNumber}`,
          status: 'available',
          type: 'plus',
          sectionId: section.id
        });
      }
    }
    
    const rowSeats = seats.filter(s => s.row === filaData.fila);
    console.log(`Fila ${filaData.fila}: ${rowSeats.length}/${filaData.cantidad} asientos (Y=${rowY.toFixed(1)}, X=${leftX.toFixed(1)}-${rightX.toFixed(1)})`);
  });
  
  console.log(`\nTotal asientos generados: ${seats.length}`);
  console.log(`Total esperado: 435`);
  
  // Guardar preview
  const fs = require('fs');
  fs.writeFileSync('server/plus-derecha-preview.json', JSON.stringify(seats, null, 2));
  console.log('\nPreview guardado en server/plus-derecha-preview.json');
  
  // Mostrar resumen por fila
  console.log('\n=== RESUMEN POR FILA ===');
  FILAS_DATA.forEach(fd => {
    const filSeats = seats.filter(s => s.row === fd.fila);
    const nums = filSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    console.log(`${fd.fila}: ${filSeats.length} asientos, nums: ${nums[0] || 'N/A'}-${nums[nums.length-1] || 'N/A'} (esperado: ${fd.cantidad}, ${fd.inicio}-${fd.fin})`);
  });
}

main().catch(console.error);
