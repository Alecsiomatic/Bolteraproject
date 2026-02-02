const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const SECTION_NAME = 'PLUS IZQUIERDA';

// Excel EXACTO para PLUS IZQUIERDA - 445 asientos
const EXCEL_DATA = [
  { fila: 'P', cantidad: 26, inicio: 1, fin: 26 },
  { fila: 'O', cantidad: 25, inicio: 1, fin: 25 },
  { fila: 'N', cantidad: 25, inicio: 1, fin: 25 },
  { fila: 'M', cantidad: 31, inicio: 1, fin: 31 },
  { fila: 'L', cantidad: 31, inicio: 1, fin: 31 },
  { fila: 'K', cantidad: 30, inicio: 1, fin: 30 },
  { fila: 'J', cantidad: 30, inicio: 1, fin: 30 },
  { fila: 'I', cantidad: 29, inicio: 1, fin: 29 },
  { fila: 'H', cantidad: 29, inicio: 1, fin: 29 },
  { fila: 'G', cantidad: 28, inicio: 1, fin: 28 },
  { fila: 'F', cantidad: 28, inicio: 1, fin: 28 },
  { fila: 'E', cantidad: 27, inicio: 1, fin: 27 },
  { fila: 'D', cantidad: 27, inicio: 1, fin: 27 },
  { fila: 'C', cantidad: 27, inicio: 1, fin: 27 },
  { fila: 'B', cantidad: 26, inicio: 1, fin: 26 },
  { fila: 'A', cantidad: 26, inicio: 1, fin: 26 },
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
  console.log('=== GENERADOR PLUS IZQUIERDA CON INCLINACIÓN ===\n');
  
  const venue = await getVenue();
  const sections = venue.layoutJson?.sections || [];
  const section = sections.find(s => s.name === SECTION_NAME);
  
  if (!section) {
    console.error('No se encontró la sección:', SECTION_NAME);
    return;
  }
  
  const polygon = section.polygonPoints;
  console.log('Polígono con', polygon.length, 'puntos (tiene muesca para discapacitados)');
  
  // Polígono PLUS IZQUIERDA (6 puntos, espejo de PLUS DERECHA):
  // P0: (1147.4, 481.3) - esquina superior izquierda
  // P1: (1366.4, 604.8) - esquina superior derecha antes de muesca
  // P2: (1343.4, 646.4) - muesca interno
  // P3: (1395.8, 677.3) - punta de muesca (hueco discapacitados)
  // P4: (1294.6, 862.5) - esquina inferior
  // P5: (1079.2, 741.1) - esquina inferior izquierda
  
  const p0 = polygon[0], p4 = polygon[4], p5 = polygon[5];
  
  // El borde inferior (P4->P5) define la inclinación de las filas
  // Es espejo de PLUS DERECHA, así que el ángulo es ~+30° (sube de izquierda a derecha)
  const rowAngle = Math.atan2(p5.y - p4.y, p5.x - p4.x);
  console.log('Ángulo de filas:', (rowAngle * 180 / Math.PI).toFixed(1) + '°');
  
  // Vectores unitarios
  const rowDirX = Math.cos(rowAngle);
  const rowDirY = Math.sin(rowAngle);
  const perpDirX = -rowDirY;
  const perpDirY = rowDirX;
  
  // Transformación a sistema rotado
  function toRotated(x, y) {
    return {
      u: x * rowDirX + y * rowDirY,
      v: x * perpDirX + y * perpDirY
    };
  }
  
  function fromRotated(u, v) {
    return {
      x: u * rowDirX + v * perpDirX,
      y: u * rowDirY + v * perpDirY
    };
  }
  
  // Proyectar vértices
  const rotatedPoints = polygon.map(p => toRotated(p.x, p.y));
  const minU = Math.min(...rotatedPoints.map(p => p.u));
  const maxU = Math.max(...rotatedPoints.map(p => p.u));
  const minV = Math.min(...rotatedPoints.map(p => p.v));
  const maxV = Math.max(...rotatedPoints.map(p => p.v));
  
  console.log('Bounds rotados: U[' + minU.toFixed(0) + '-' + maxU.toFixed(0) + '] V[' + minV.toFixed(0) + '-' + maxV.toFixed(0) + ']');
  
  const totalFilas = EXCEL_DATA.length;
  const seats = [];
  const vSpacing = (maxV - minV) / (totalFilas + 1);
  
  console.log('Espaciado entre filas:', vSpacing.toFixed(1));
  console.log('');
  
  EXCEL_DATA.forEach((filaData, filaIndex) => {
    const v = minV + vSpacing * (filaIndex + 1);
    
    // Escanear a lo largo de U para encontrar los límites dentro del polígono
    let validUs = [];
    for (let u = minU; u <= maxU; u += 1) {
      const {x, y} = fromRotated(u, v);
      if (pointInPolygon(x, y, polygon)) {
        validUs.push(u);
      }
    }
    
    if (validUs.length === 0) {
      console.log(`Fila ${filaData.fila}: SIN ESPACIO`);
      return;
    }
    
    const uMin = Math.min(...validUs);
    const uMax = Math.max(...validUs);
    const rowWidth = uMax - uMin;
    
    const numSeats = filaData.cantidad;
    const seatSpacing = rowWidth / (numSeats + 1);
    
    let rowSeats = [];
    for (let i = 0; i < numSeats; i++) {
      const seatNumber = filaData.inicio + i;
      const u = uMin + seatSpacing * (i + 1);
      const {x, y} = fromRotated(u, v);
      
      if (pointInPolygon(x, y, polygon)) {
        rowSeats.push({
          id: `plus-izquierda-${filaData.fila}-${seatNumber}`,
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
          row: filaData.fila,
          number: String(seatNumber),
          label: `PI-${filaData.fila}-${seatNumber}`,
          status: 'available',
          type: 'plus',
          sectionId: section.id,
          seatType: 'STANDARD'
        });
      }
    }
    
    seats.push(...rowSeats);
    
    const nums = rowSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    const status = rowSeats.length === filaData.cantidad ? '✓' : '✗';
    const first = rowSeats[0], last = rowSeats[rowSeats.length-1];
    console.log(`Fila ${filaData.fila}: ${rowSeats.length}/${filaData.cantidad} ${status} | (${first?.x?.toFixed(0)},${first?.y?.toFixed(0)}) -> (${last?.x?.toFixed(0)},${last?.y?.toFixed(0)}) | nums: ${nums[0]}-${nums[nums.length-1]}`);
  });
  
  console.log('');
  console.log('Total generados:', seats.length, '/ 445 esperados');
  
  // Guardar
  fs.writeFileSync('server/plus-izquierda-fixed.json', JSON.stringify(seats, null, 2));
  console.log('Guardado en server/plus-izquierda-fixed.json');
  
  // Verificar ángulos
  console.log('');
  console.log('=== VERIFICACIÓN DE ÁNGULOS ===');
  ['P', 'M', 'A'].forEach(fila => {
    const rowSeats = seats.filter(s => s.row === fila).sort((a,b) => parseInt(a.number) - parseInt(b.number));
    if (rowSeats.length >= 2) {
      const first = rowSeats[0];
      const last = rowSeats[rowSeats.length-1];
      const angle = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
      console.log(`Fila ${fila}: ángulo ${angle.toFixed(1)}° (esperado: ${(rowAngle * 180 / Math.PI).toFixed(1)}°)`);
    }
  });
}

main().catch(console.error);
