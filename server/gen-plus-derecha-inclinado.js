const https = require('https');
const fs = require('fs');

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
  console.log('=== GENERADOR PLUS DERECHA CON INCLINACIÓN ===\n');
  
  const venue = await getVenue();
  const sections = venue.layoutJson?.sections || [];
  const section = sections.find(s => s.name === SECTION_NAME);
  
  if (!section) {
    console.error('No se encontró la sección:', SECTION_NAME);
    return;
  }
  
  const polygon = section.polygonPoints;
  
  // Polígono PLUS DERECHA:
  // P0: (489.2, 608.8) - muesca arriba izq
  // P1: (513.5, 651.1) - muesca interno
  // P2: (459.5, 681.3) - muesca punta (discapacitados)
  // P3: (564.8, 864.0) - esquina inferior izquierda
  // P4: (769.6, 744.6) - esquina inferior derecha
  // P5: (699.4, 487.3) - esquina superior derecha
  
  const p0 = polygon[0], p1 = polygon[1], p2 = polygon[2];
  const p3 = polygon[3], p4 = polygon[4], p5 = polygon[5];
  
  // El polígono tiene forma de trapecio inclinado
  // Las filas van PARALELAS al borde inferior (P3->P4)
  // El ángulo de inclinación es -30.2° (baja de izquierda a derecha)
  
  const rowAngle = Math.atan2(p4.y - p3.y, p4.x - p3.x); // ~-30.2° en radianes
  console.log('Ángulo de filas:', (rowAngle * 180 / Math.PI).toFixed(1) + '°');
  
  // Vectores unitarios
  const rowDirX = Math.cos(rowAngle);  // Dirección a lo largo de la fila
  const rowDirY = Math.sin(rowAngle);
  const perpDirX = -rowDirY;  // Perpendicular (hacia abajo)
  const perpDirY = rowDirX;
  
  console.log('Vector fila:', rowDirX.toFixed(3), rowDirY.toFixed(3));
  console.log('Vector perpendicular:', perpDirX.toFixed(3), perpDirY.toFixed(3));
  
  // Calcular el "ancho" y "alto" del polígono en el sistema rotado
  // Proyectar todos los puntos al sistema de coordenadas rotado
  function toRotated(x, y) {
    return {
      u: x * rowDirX + y * rowDirY,      // Coordenada a lo largo de la fila
      v: x * perpDirX + y * perpDirY     // Coordenada perpendicular
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
  
  console.log('');
  console.log('Bounds rotados:');
  console.log('  U (a lo largo de fila):', minU.toFixed(1), '-', maxU.toFixed(1), '= ancho', (maxU-minU).toFixed(1));
  console.log('  V (perpendicular):', minV.toFixed(1), '-', maxV.toFixed(1), '= alto', (maxV-minV).toFixed(1));
  
  // Generar asientos
  const totalFilas = EXCEL_DATA.length;
  const seats = [];
  
  // El espaciado vertical en el sistema rotado
  const vSpacing = (maxV - minV) / (totalFilas + 1);
  
  console.log('');
  console.log('Espaciado entre filas (en V):', vSpacing.toFixed(1));
  console.log('');
  
  EXCEL_DATA.forEach((filaData, filaIndex) => {
    // Coordenada V para esta fila (perpendicular a las filas)
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
      console.log(`Fila ${filaData.fila}: SIN ESPACIO en V=${v.toFixed(1)}`);
      return;
    }
    
    const uMin = Math.min(...validUs);
    const uMax = Math.max(...validUs);
    const rowWidth = uMax - uMin;
    
    // Distribuir asientos uniformemente
    const numSeats = filaData.cantidad;
    const seatSpacing = rowWidth / (numSeats + 1);
    
    let rowSeats = [];
    for (let i = 0; i < numSeats; i++) {
      const seatNumber = filaData.inicio + i;
      const u = uMin + seatSpacing * (i + 1);
      const {x, y} = fromRotated(u, v);
      
      // Verificar que esté dentro del polígono
      if (pointInPolygon(x, y, polygon)) {
        rowSeats.push({
          id: `plus-derecha-${filaData.fila}-${seatNumber}`,
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
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
    
    seats.push(...rowSeats);
    
    // Mostrar info de la fila
    const nums = rowSeats.map(s => parseInt(s.number)).sort((a,b) => a-b);
    const firstSeat = rowSeats[0];
    const lastSeat = rowSeats[rowSeats.length - 1];
    const status = rowSeats.length === filaData.cantidad ? '✓' : '✗';
    
    console.log(`Fila ${filaData.fila}: ${rowSeats.length}/${filaData.cantidad} ${status} | ` +
      `(${firstSeat?.x?.toFixed(0)},${firstSeat?.y?.toFixed(0)}) -> (${lastSeat?.x?.toFixed(0)},${lastSeat?.y?.toFixed(0)}) | ` +
      `nums: ${nums[0]}-${nums[nums.length-1]}`);
  });
  
  console.log('');
  console.log('Total generados:', seats.length, '/ 435 esperados');
  
  // Guardar
  fs.writeFileSync('server/plus-derecha-inclinado.json', JSON.stringify(seats, null, 2));
  console.log('Guardado en server/plus-derecha-inclinado.json');
  
  // Verificar ángulos de las filas generadas
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
