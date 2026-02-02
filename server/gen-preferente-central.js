const fs = require('fs');

// Polígono PREFERENTE CENTRAL (casi horizontal)
const polygon = [
  { x: 1120.25, y: 386.82 },  // P0 - esquina inf-der
  { x: 733.73, y: 388.22 },   // P1 - esquina inf-izq
  { x: 669.78, y: 127.07 },   // P2 - esquina sup-izq
  { x: 1188.42, y: 127.07 }   // P3 - esquina sup-der
];

// Datos del Excel
const excelData = require('./tangamanga_seats.json')['PREFERENTE CENTRAL'];

console.log('=== GENERADOR PREFERENTE CENTRAL ===\n');
console.log('Polígono:', polygon.length, 'puntos');

const xMin = Math.min(...polygon.map(p => p.x));
const xMax = Math.max(...polygon.map(p => p.x));
const yMin = Math.min(...polygon.map(p => p.y));
const yMax = Math.max(...polygon.map(p => p.y));

console.log('Bounds: X', xMin.toFixed(0), '-', xMax.toFixed(0), 
            '| Y', yMin.toFixed(0), '-', yMax.toFixed(0));

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

const seats = [];
const filas = excelData.filas;
const numRows = filas.length;
const rowSpacing = (yMax - yMin) / (numRows + 1);

console.log('\nFilas:', numRows, '| Espaciado vertical:', rowSpacing.toFixed(1));

const rowOrder = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];

rowOrder.forEach((rowLetter, rowIndex) => {
  const filaData = filas.find(f => f.fila === rowLetter);
  if (!filaData) return;
  
  const numSeats = filaData.asientos;
  const rangoMatch = filaData.numeracion.match(/(\d+)\s*a\s*(\d+)/);
  const numStart = parseInt(rangoMatch[1]);
  
  const seatNumbers = [];
  for (let i = 0; i < numSeats; i++) {
    seatNumbers.push(numStart + i);
  }
  
  const yPos = yMin + rowSpacing * (rowIndex + 1);
  
  let xStart = xMin;
  let xEnd = xMax;
  
  for (let x = xMin; x <= xMax; x += 1) {
    if (pointInPolygon(x, yPos, polygon)) { xStart = x; break; }
  }
  for (let x = xMax; x >= xMin; x -= 1) {
    if (pointInPolygon(x, yPos, polygon)) { xEnd = x; break; }
  }
  
  const margin = 5;
  xStart += margin;
  xEnd -= margin;
  
  const seatSpacing = numSeats > 1 ? (xEnd - xStart) / (numSeats - 1) : 0;
  
  seatNumbers.forEach((seatNum, seatIndex) => {
    const x = xStart + seatIndex * seatSpacing;
    seats.push({
      id: `preferente-central-${rowLetter}-${seatNum}`,
      sectionId: 'section-1769728398974',
      row: rowLetter,
      number: String(seatNum),
      label: `${rowLetter}-${seatNum}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(yPos * 100) / 100
    });
  });
  
  console.log(`Fila ${rowLetter}: ${numSeats} ✓ | nums: ${seatNumbers[0]}-${seatNumbers[seatNumbers.length-1]}`);
});

const expectedTotal = filas.reduce((sum, f) => sum + f.asientos, 0);
console.log('\nTotal generados:', seats.length, '/', expectedTotal);

fs.writeFileSync('server/preferente-central-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/preferente-central-fixed.json');
