const fs = require('fs');

// Polígono VIP CENTRAL (casi horizontal)
const polygon = [
  { x: 813.73, y: 717.68 },  // P0 - esquina sup-izq
  { x: 1032.15, y: 717.19 }, // P1 - esquina sup-der
  { x: 997.95, y: 851.06 },  // P2 - esquina inf-der
  { x: 845.98, y: 851.06 }   // P3 - esquina inf-izq
];

// Datos del Excel para VIP CENTRAL
const excelData = require('./tangamanga_seats.json')['VIP CENTRAL'];

console.log('=== GENERADOR VIP CENTRAL ===\n');
console.log('Polígono:', polygon.length, 'puntos');

// Calcular ángulo - el polígono es casi horizontal
const dx = polygon[1].x - polygon[0].x;
const dy = polygon[1].y - polygon[0].y;
const angle = Math.atan2(dy, dx);
const angleDeg = angle * 180 / Math.PI;
console.log('Ángulo de filas:', angleDeg.toFixed(1) + '° (casi horizontal)');

// Para VIP Central usamos coordenadas directas ya que es casi horizontal
const xMin = Math.min(...polygon.map(p => p.x));
const xMax = Math.max(...polygon.map(p => p.x));
const yMin = Math.min(...polygon.map(p => p.y));
const yMax = Math.max(...polygon.map(p => p.y));

console.log('Bounds: X', xMin.toFixed(0), '-', xMax.toFixed(0), 
            '| Y', yMin.toFixed(0), '-', yMax.toFixed(0));

// Verificar si un punto está dentro del polígono
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Generar asientos
const seats = [];
const numRows = excelData.filas.length;
const rowSpacing = (yMax - yMin) / (numRows + 1);

console.log('\nFilas:', numRows, '| Espaciado vertical:', rowSpacing.toFixed(1));

// Procesar cada fila según Excel
excelData.filas.forEach((filaData, rowIndex) => {
  const fila = filaData.fila;
  const numSeats = filaData.asientos;
  const rangoMatch = filaData.numeracion.match(/(\d+)\s*a\s*(\d+)/);
  const numStart = parseInt(rangoMatch[1]);
  const numEnd = parseInt(rangoMatch[2]);
  
  // Generar números consecutivos desde numStart
  const seatNumbers = [];
  for (let i = 0; i < numSeats; i++) {
    seatNumbers.push(numStart + i);
  }
  
  // Posición Y para esta fila (fila 1 arriba, fila 8 abajo)
  const rowNum = parseInt(fila);
  const yPos = yMin + rowSpacing * rowNum;
  
  // Encontrar límites X para esta fila
  let xStart = xMin;
  let xEnd = xMax;
  
  for (let x = xMin; x <= xMax; x += 1) {
    if (pointInPolygon(x, yPos, polygon)) {
      xStart = x;
      break;
    }
  }
  for (let x = xMax; x >= xMin; x -= 1) {
    if (pointInPolygon(x, yPos, polygon)) {
      xEnd = x;
      break;
    }
  }
  
  const margin = 5;
  xStart += margin;
  xEnd -= margin;
  
  const availableWidth = xEnd - xStart;
  const seatSpacing = numSeats > 1 ? availableWidth / (numSeats - 1) : 0;
  
  let rowSeats = [];
  
  seatNumbers.forEach((seatNum, seatIndex) => {
    const x = xStart + seatIndex * seatSpacing;
    
    const seatId = `vip-central-${fila}-${seatNum}`;
    rowSeats.push({
      id: seatId,
      sectionId: 'section-1769727771832',
      row: fila,
      number: String(seatNum),
      label: `${fila}-${seatNum}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(yPos * 100) / 100
    });
  });
  
  seats.push(...rowSeats);
  
  const firstSeat = rowSeats[0];
  const lastSeat = rowSeats[rowSeats.length - 1];
  console.log(`Fila ${fila}: ${rowSeats.length}/${numSeats} ✓ | (${firstSeat.x.toFixed(0)},${firstSeat.y.toFixed(0)}) -> (${lastSeat.x.toFixed(0)},${lastSeat.y.toFixed(0)}) | nums: ${seatNumbers[0]}-${seatNumbers[seatNumbers.length-1]}`);
});

const expectedTotal = excelData.filas.reduce((sum, f) => sum + f.asientos, 0);
console.log('\nTotal generados:', seats.length, '/', expectedTotal, 'esperados');

// Guardar
fs.writeFileSync('server/vip-central-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/vip-central-fixed.json');
