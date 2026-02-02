const fs = require('fs');

// Polígono VIP IZQUIERDA (inclinado, espejo de VIP DERECHA)
const polygon = [
  { x: 1228.14, y: 979.12 },  // P0 - esquina inf-izq
  { x: 1293.13, y: 862.36 },  // P1 - esquina sup-izq
  { x: 1079.26, y: 743.62 },  // P2 - esquina sup-der
  { x: 1044.03, y: 878.54 }   // P3 - esquina inf-der
];

// Datos del Excel para VIP IZQUIERDA
const excelData = require('./tangamanga_seats.json')['VIP IZQUIERDA'];

console.log('=== GENERADOR VIP IZQUIERDA ===\n');
console.log('Polígono:', polygon.length, 'puntos');

// Calcular ángulo del polígono usando el borde inferior (P0 -> P3)
const dx = polygon[3].x - polygon[0].x;
const dy = polygon[3].y - polygon[0].y;
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
const numRows = excelData.filas.length;
const rowSpacing = (vMax - vMin) / (numRows + 1);

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
  
  // Posición V para esta fila (fila 1 arriba, fila 8 abajo)
  const rowNum = parseInt(fila);
  const vPos = vMin + rowSpacing * rowNum;
  
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
    
    const seatId = `vip-izquierda-${fila}-${seatNum}`;
    rowSeats.push({
      id: seatId,
      sectionId: 'section-1769727719701',
      row: fila,
      number: String(seatNum),
      label: `${fila}-${seatNum}`,
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100
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
fs.writeFileSync('server/vip-izquierda-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/vip-izquierda-fixed.json');
