const fs = require('fs');

// Polígono PREFERENTE IZQUIERDA (inclinado, espejo de PREFERENTE DERECHA)
const polygon = [
  { x: 1582.12, y: 347.44 },  // P0 - esquina sup-der
  { x: 1454.96, y: 576.15 },  // P1 - esquina inf-der
  { x: 1167.78, y: 414.63 },  // P2 - esquina inf-izq
  { x: 1236.82, y: 153.32 }   // P3 - esquina sup-izq
];

const excelData = require('./tangamanga_seats.json')['PREFERENTE IZQUIERDA'];

console.log('=== GENERADOR PREFERENTE IZQUIERDA ===\n');

// Calcular ángulo (usando borde inferior P1 -> P2)
const dx = polygon[2].x - polygon[1].x;
const dy = polygon[2].y - polygon[1].y;
const angle = Math.atan2(dy, dx);
const angleDeg = angle * 180 / Math.PI;
console.log('Ángulo de filas:', angleDeg.toFixed(1) + '°');

function rotate(x, y, ang) {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return { u: x * cos + y * sin, v: -x * sin + y * cos };
}

function unrotate(u, v, ang) {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  return { x: u * cos - v * sin, y: u * sin + v * cos };
}

const rotatedPoly = polygon.map(p => rotate(p.x, p.y, angle));
const uMin = Math.min(...rotatedPoly.map(p => p.u));
const uMax = Math.max(...rotatedPoly.map(p => p.u));
const vMin = Math.min(...rotatedPoly.map(p => p.v));
const vMax = Math.max(...rotatedPoly.map(p => p.v));

console.log('Bounds rotados: U', uMin.toFixed(0), '-', uMax.toFixed(0), 
            '| V', vMin.toFixed(0), '-', vMax.toFixed(0));

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
const rowSpacing = (vMax - vMin) / (numRows + 1);

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
  
  const vPos = vMin + rowSpacing * (rowIndex + 1);
  
  let uStart = uMin;
  let uEnd = uMax;
  
  for (let u = uMin; u <= uMax; u += 1) {
    const p = unrotate(u, vPos, angle);
    if (pointInPolygon(p.x, p.y, polygon)) { uStart = u; break; }
  }
  for (let u = uMax; u >= uMin; u -= 1) {
    const p = unrotate(u, vPos, angle);
    if (pointInPolygon(p.x, p.y, polygon)) { uEnd = u; break; }
  }
  
  const margin = 5;
  uStart += margin;
  uEnd -= margin;
  
  const seatSpacing = numSeats > 1 ? (uEnd - uStart) / (numSeats - 1) : 0;
  
  seatNumbers.forEach((seatNum, seatIndex) => {
    const u = uStart + seatIndex * seatSpacing;
    const pos = unrotate(u, vPos, angle);
    
    seats.push({
      id: `preferente-izquierda-${rowLetter}-${seatNum}`,
      sectionId: 'section-1769728453039',
      row: rowLetter,
      number: String(seatNum),
      label: `${rowLetter}-${seatNum}`,
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100
    });
  });
  
  console.log(`Fila ${rowLetter}: ${numSeats} ✓ | nums: ${seatNumbers[0]}-${seatNumbers[seatNumbers.length-1]}`);
});

const expectedTotal = filas.reduce((sum, f) => sum + f.asientos, 0);
console.log('\nTotal generados:', seats.length, '/', expectedTotal);

fs.writeFileSync('server/preferente-izquierda-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/preferente-izquierda-fixed.json');
