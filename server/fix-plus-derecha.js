const https = require('https');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const SECTION_NAME = 'PLUS DERECHA';

// Excel EXACTO para PLUS DERECHA - 435 asientos
const EXCEL_DATA = [
  { fila: 'P', cantidad: 25, inicio: 49, fin: 73 },
  { fila: 'O', cantidad: 25, inicio: 47, fin: 71 },
  { fila: 'N', cantidad: 24, inicio: 46, fin: 69 },
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

// Polígono PLUS DERECHA con 6 puntos (tiene muesca para discapacitados)
// P0: (489.2, 608.8) - esquina superior izquierda
// P1: (513.5, 651.1) - entrante de muesca
// P2: (459.5, 681.3) - punta de muesca (hueco discapacitados)
// P3: (564.8, 864.0) - esquina inferior izquierda
// P4: (769.6, 744.6) - esquina inferior derecha
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

function getVenue() {
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
  console.log('=== CORRIGIENDO PLUS DERECHA SEGÚN EXCEL ===\n');
  
  const venue = await getVenue();
  const sections = venue.layoutJson?.sections || [];
  const section = sections.find(s => s.name === SECTION_NAME);
  
  if (!section) {
    console.error('No se encontró la sección:', SECTION_NAME);
    return;
  }
  
  const polygon = section.polygonPoints;
  console.log('Polígono con', polygon.length, 'puntos (incluye muesca discapacitados)');
  
  // Bounds del polígono
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  console.log(`Bounds: X[${minX.toFixed(1)}-${maxX.toFixed(1)}] Y[${minY.toFixed(1)}-${maxY.toFixed(1)}]`);
  
  // La orientación del teatro:
  // - Y menor = más arriba (fila P está arriba)
  // - Y mayor = más abajo (fila A está abajo)
  // - X mayor = derecha (números altos)
  // - X menor = izquierda (números bajos)
  // Dirección: DERECHA A IZQUIERDA significa que mirando al escenario,
  // los números van de derecha a izquierda (altos a bajos)
  
  const totalFilas = EXCEL_DATA.length;
  const seats = [];
  
  // Calcular Y para cada fila
  // Fila P (índice 0) está en Y más bajo, Fila A (índice 15) está en Y más alto
  EXCEL_DATA.forEach((filaData, filaIndex) => {
    // Y proporcional - más padding en los bordes
    const yRatio = (filaIndex + 0.5) / totalFilas;
    const rowY = minY + (maxY - minY) * yRatio;
    
    // Encontrar límites X válidos para esta Y (respetando la muesca)
    let validXs = [];
    for (let testX = minX; testX <= maxX; testX += 1) {
      if (pointInPolygon(testX, rowY, polygon)) {
        validXs.push(testX);
      }
    }
    
    if (validXs.length === 0) {
      console.log(`Fila ${filaData.fila}: NO HAY ESPACIO EN Y=${rowY.toFixed(1)}`);
      return;
    }
    
    const leftX = Math.min(...validXs);
    const rightX = Math.max(...validXs);
    const rowWidth = rightX - leftX;
    
    // Generar asientos exactos según Excel
    const numSeats = filaData.cantidad;
    const spacing = rowWidth / (numSeats + 1);
    
    for (let i = 0; i < numSeats; i++) {
      const seatNumber = filaData.inicio + i;
      // Números van de izquierda a derecha (inicio está a la izquierda)
      const x = leftX + spacing * (i + 1);
      
      // Verificar que esté dentro del polígono (por la muesca)
      if (pointInPolygon(x, rowY, polygon)) {
        seats.push({
          id: `plus-derecha-${filaData.fila}-${seatNumber}`,
          visibleId: `plus-derecha-${filaData.fila}-${seatNumber}`,
          x: Math.round(x * 10) / 10,
          y: Math.round(rowY * 10) / 10,
          row: filaData.fila,
          number: String(seatNumber),
          label: `PD-${filaData.fila}-${seatNumber}`,
          status: 'available',
          type: 'plus',
          sectionId: section.id,
          seatType: 'STANDARD'
        });
      }
    }
    
    const rowSeats = seats.filter(s => s.row === filaData.fila);
    const nums = rowSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    const status = rowSeats.length === filaData.cantidad ? '✓' : '✗';
    console.log(`Fila ${filaData.fila}: ${rowSeats.length}/${filaData.cantidad} ${status} (${nums[0] || 'N/A'}-${nums[nums.length-1] || 'N/A'}) Y=${rowY.toFixed(1)} X=[${leftX.toFixed(1)}-${rightX.toFixed(1)}]`);
  });
  
  console.log(`\nTotal generados: ${seats.length} / 435 esperados`);
  
  // Guardar preview
  const fs = require('fs');
  fs.writeFileSync('server/plus-derecha-fixed.json', JSON.stringify(seats, null, 2));
  console.log('Preview guardado en server/plus-derecha-fixed.json');
  
  // Verificar totales por fila
  console.log('\n=== VERIFICACIÓN FINAL ===');
  let ok = true;
  EXCEL_DATA.forEach(fd => {
    const rowSeats = seats.filter(s => s.row === fd.fila);
    const nums = rowSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    if (rowSeats.length !== fd.cantidad || nums[0] !== fd.inicio || nums[nums.length-1] !== fd.fin) {
      console.log(`❌ Fila ${fd.fila}: ${rowSeats.length} (esperado ${fd.cantidad}), rango ${nums[0]}-${nums[nums.length-1]} (esperado ${fd.inicio}-${fd.fin})`);
      ok = false;
    }
  });
  
  if (ok) {
    console.log('✅ Todos los asientos coinciden exactamente con Excel!');
  } else {
    console.log('\n⚠️ Hay diferencias. Ajustando...');
  }
}

main().catch(console.error);
