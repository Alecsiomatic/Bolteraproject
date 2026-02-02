const fs = require('fs');

// Polígono PREFERENTE DERECHA
const polygon = [
  { x: 271.69, y: 354.84 },  // P0 - esquina sup-izq
  { x: 401.48, y: 580.24 },  // P1 - esquina inf-izq
  { x: 682.70, y: 416.97 },  // P2 - esquina inf-der
  { x: 617.78, y: 155.13 }   // P3 - esquina sup-der
];

// Datos del Excel
const excelData = require('./tangamanga_seats.json')['PREFERENTE DERECHA'];

console.log('=== GENERADOR PREFERENTE DERECHA ===\n');
console.log('Polígono:', polygon.length, 'puntos');

// Calcular ángulo del polígono usando el borde inferior (P1 -> P2)
const dx = polygon[2].x - polygon[1].x;
const dy = polygon[2].y - polygon[1].y;
const angle = Math.atan2(dy, dx);
const angleDeg = angle * 180 / Math.PI;
console.log('Ángulo de filas:', angleDeg.toFixed(1) + '°');

// Funciones de rotación
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

// Convertir polígono a coordenadas rotadas
const rotatedPoly = polygon.map(p => rotate(p.x, p.y, angle));
const uMin = Math.min(...rotatedPoly.map(p => p.u));
const uMax = Math.max(...rotatedPoly.map(p => p.u));
const vMin = Math.min(...rotatedPoly.map(p => p.v));
const vMax = Math.max(...rotatedPoly.map(p => p.v));

console.log('Bounds rotados: U', uMin.toFixed(0), '-', uMax.toFixed(0), 
            '| V', vMin.toFixed(0), '-', vMax.toFixed(0));

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
const filas = excelData.filas;
const numRows = filas.length;
const rowSpacing = (vMax - vMin) / (numRows + 1);

console.log('\nFilas:', numRows, '| Espaciado vertical:', rowSpacing.toFixed(1));

// Ordenar filas: A es la más cercana al escenario (arriba), P es la más lejana (abajo)
const rowOrder = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P'];

rowOrder.forEach((rowLetter, rowIndex) => {
  const filaData = filas.find(f => f.fila === rowLetter);
  if (!filaData) return;
  
  const numSeats = filaData.asientos;
  const rangoMatch = filaData.numeracion.match(/(\d+)\s*a\s*(\d+)/);
  const numStart = parseInt(rangoMatch[1]);
  
  // Generar números consecutivos desde numStart
  const seatNumbers = [];
  for (let i = 0; i < numSeats; i++) {
    seatNumbers.push(numStart + i);
  }
  
  // Posición V para esta fila
  const vPos = vMin + rowSpacing * (rowIndex + 1);
  
  // Encontrar límites U para esta fila
  let uStart = uMin;
  let uEnd = uMax;
  
  for (let u = uMin; u <= uMax; u += 1) {
    const p = unrotate(u, vPos, angle);
    if (pointInPolygon(p.x, p.y, polygon)) {
      uStart = u;
      break;
    }
  }
  for (let u = uMax; u >= uMin; u -= 1) {
    const p = unrotate(u, vPos, angle);
    if (pointInPolygon(p.x, p.y, polygon)) {
      uEnd = u;
      break;
    }
  }
  
  const margin = 5;
  uStart += margin;
  uEnd -= margin;
  
  const availableWidth = uEnd - uStart;
  const seatSpacing = numSeats > 1 ? availableWidth / (numSeats - 1) : 0;
  
  let rowSeats = [];
  
  seatNumbers.forEach((seatNum, seatIndex) => {
    const u = uStart + seatIndex * seatSpacing;
    const pos = unrotate(u, vPos, angle);
    
    const seatId = `preferente-derecha-${rowLetter}-${seatNum}`;
    rowSeats.push({
      id: seatId,
      sectionId: 'section-1769728342922',
      row: rowLetter,
      number: String(seatNum),
      label: `${rowLetter}-${seatNum}`,
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100
    });
  });
  
  seats.push(...rowSeats);
  
  const firstSeat = rowSeats[0];
  const lastSeat = rowSeats[rowSeats.length - 1];
  console.log(`Fila ${rowLetter}: ${rowSeats.length}/${numSeats} ✓ | nums: ${seatNumbers[0]}-${seatNumbers[seatNumbers.length-1]}`);
});

const expectedTotal = filas.reduce((sum, f) => sum + f.asientos, 0);
console.log('\nTotal generados:', seats.length, '/', expectedTotal, 'esperados');

// Guardar
fs.writeFileSync('server/preferente-derecha-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/preferente-derecha-fixed.json');

// Verificar ángulos
console.log('\n=== VERIFICACIÓN DE ÁNGULOS ===');
['A', 'H', 'P'].forEach(fila => {
  const filaSeats = seats.filter(s => s.row === fila).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  if (filaSeats.length >= 2) {
    const first = filaSeats[0];
    const last = filaSeats[filaSeats.length - 1];
    const ang = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
    console.log(`Fila ${fila}: ángulo ${ang.toFixed(1)}° (esperado: ${angleDeg.toFixed(1)}°) ${Math.abs(ang - angleDeg) < 1 ? '✓' : '✗'}`);
  }
});
