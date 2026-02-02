const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const SECTION_NAME = 'PLUS CENTRAL';

// Excel EXACTO para PLUS CENTRAL - 414 asientos
// Las filas P, O, N, M tienen un HUECO en el medio
const EXCEL_DATA = [
  { fila: 'P', cantidad: 22, rangos: [[27, 37], [38, 48]] },  // Hueco entre 37 y 38
  { fila: 'O', cantidad: 21, rangos: [[26, 35], [36, 46]] },  // Hueco entre 35 y 36
  { fila: 'N', cantidad: 20, rangos: [[26, 35], [36, 45]] },
  { fila: 'M', cantidad: 19, rangos: [[32, 40], [41, 50]] },
  { fila: 'L', cantidad: 32, rangos: [[31, 62]] },  // Sin hueco - rango correcto
  { fila: 'K', cantidad: 32, rangos: [[31, 62]] },
  { fila: 'J', cantidad: 31, rangos: [[31, 61]] },
  { fila: 'I', cantidad: 30, rangos: [[30, 59]] },
  { fila: 'H', cantidad: 29, rangos: [[30, 58]] },
  { fila: 'G', cantidad: 28, rangos: [[29, 56]] },
  { fila: 'F', cantidad: 27, rangos: [[29, 55]] },
  { fila: 'E', cantidad: 26, rangos: [[28, 53]] },
  { fila: 'D', cantidad: 25, rangos: [[28, 52]] },
  { fila: 'C', cantidad: 25, rangos: [[28, 52]] },
  { fila: 'B', cantidad: 24, rangos: [[27, 50]] },
  { fila: 'A', cantidad: 23, rangos: [[27, 49]] },
];

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
  console.log('=== GENERADOR PLUS CENTRAL ===\n');
  
  const venue = await getVenue();
  const sections = venue.layoutJson?.sections || [];
  const section = sections.find(s => s.name === SECTION_NAME);
  
  if (!section) {
    console.error('No se encontró la sección:', SECTION_NAME);
    return;
  }
  
  const polygon = section.polygonPoints;
  console.log('Polígono con', polygon.length, 'puntos (forma de U - hueco arriba)');
  
  // Polígono PLUS CENTRAL:
  // P0: (750.2, 457.3) - esquina superior izquierda
  // P1: (868.1, 456.5) - antes del hueco izq
  // P2: (868.9, 521.7) - hueco inferior izq
  // P3: (991.4, 521.7) - hueco inferior der
  // P4: (991.4, 456.5) - después del hueco der
  // P5: (1099.9, 458.1) - esquina superior derecha
  // P6: (1031.7, 717.0) - esquina inferior derecha
  // P7: (813.8, 714.7) - esquina inferior izquierda
  
  const xs = polygon.map(p => p.x);
  const ys = polygon.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  console.log('Bounds: X[' + minX.toFixed(0) + '-' + maxX.toFixed(0) + '] Y[' + minY.toFixed(0) + '-' + maxY.toFixed(0) + ']');
  
  // El polígono tiene ángulo casi 0 (horizontal)
  // Las filas van de arriba (Y menor) a abajo (Y mayor)
  
  const totalFilas = EXCEL_DATA.length;
  const seats = [];
  
  // Espaciado vertical
  const vSpacing = (maxY - minY) / (totalFilas + 1);
  console.log('Espaciado entre filas:', vSpacing.toFixed(1) + 'px');
  console.log('');
  
  EXCEL_DATA.forEach((filaData, filaIndex) => {
    const rowY = minY + vSpacing * (filaIndex + 1);
    
    // Encontrar los segmentos válidos X para esta Y (puede haber hueco)
    let validSegments = [];
    let currentSegment = null;
    
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x, rowY, polygon)) {
        if (!currentSegment) {
          currentSegment = { start: x, end: x };
        } else {
          currentSegment.end = x;
        }
      } else {
        if (currentSegment) {
          validSegments.push(currentSegment);
          currentSegment = null;
        }
      }
    }
    if (currentSegment) validSegments.push(currentSegment);
    
    // Generar asientos según los rangos del Excel
    let rowSeats = [];
    
    if (filaData.rangos.length === 2 && validSegments.length >= 2) {
      // Fila con hueco - distribuir en dos segmentos
      const [rango1, rango2] = filaData.rangos;
      const [seg1, seg2] = validSegments.length >= 2 ? [validSegments[0], validSegments[validSegments.length-1]] : [validSegments[0], validSegments[0]];
      
      // Primer segmento (izquierda)
      const numSeats1 = rango1[1] - rango1[0] + 1;
      const width1 = seg1.end - seg1.start;
      const spacing1 = width1 / (numSeats1 + 1);
      
      for (let i = 0; i < numSeats1; i++) {
        const seatNumber = rango1[0] + i;
        const x = seg1.start + spacing1 * (i + 1);
        rowSeats.push(createSeat(x, rowY, filaData.fila, seatNumber, section.id));
      }
      
      // Segundo segmento (derecha)
      const numSeats2 = rango2[1] - rango2[0] + 1;
      const width2 = seg2.end - seg2.start;
      const spacing2 = width2 / (numSeats2 + 1);
      
      for (let i = 0; i < numSeats2; i++) {
        const seatNumber = rango2[0] + i;
        const x = seg2.start + spacing2 * (i + 1);
        rowSeats.push(createSeat(x, rowY, filaData.fila, seatNumber, section.id));
      }
    } else {
      // Fila sin hueco - un solo rango
      const rango = filaData.rangos[0];
      const numSeats = rango[1] - rango[0] + 1;
      
      // Usar todo el ancho disponible
      const totalWidth = validSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      let startX = validSegments[0]?.start || minX;
      let endX = validSegments[validSegments.length-1]?.end || maxX;
      
      const spacing = (endX - startX) / (numSeats + 1);
      
      for (let i = 0; i < numSeats; i++) {
        const seatNumber = rango[0] + i;
        const x = startX + spacing * (i + 1);
        
        if (pointInPolygon(x, rowY, polygon)) {
          rowSeats.push(createSeat(x, rowY, filaData.fila, seatNumber, section.id));
        }
      }
    }
    
    seats.push(...rowSeats);
    
    // Info
    const nums = rowSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    const status = rowSeats.length === filaData.cantidad ? '✓' : '✗';
    const segsInfo = validSegments.map(s => s.start.toFixed(0) + '-' + s.end.toFixed(0)).join(' / ');
    console.log(`Fila ${filaData.fila}: ${rowSeats.length}/${filaData.cantidad} ${status} | Y=${rowY.toFixed(0)} | segs: ${segsInfo} | nums: ${nums[0]}-${nums[nums.length-1]}`);
  });
  
  console.log('');
  console.log('Total generados:', seats.length, '/ 414 esperados');
  
  // Guardar
  fs.writeFileSync('server/plus-central-fixed.json', JSON.stringify(seats, null, 2));
  console.log('Guardado en server/plus-central-fixed.json');
}

function createSeat(x, y, row, number, sectionId) {
  return {
    id: `plus-central-${row}-${number}`,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    row: row,
    number: String(number),
    label: `PC-${row}-${number}`,
    status: 'available',
    type: 'plus',
    sectionId: sectionId,
    seatType: 'STANDARD'
  };
}

main().catch(console.error);
