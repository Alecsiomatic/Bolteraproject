const fs = require('fs');

// Polígono VIP DERECHA
const polygon = [
  { x: 565.78, y: 865.45 },  // P0 - esquina sup-izq
  { x: 629.11, y: 976.78 },  // P1 - esquina inf-izq
  { x: 805.90, y: 874.42 },  // P2 - esquina inf-der
  { x: 770.01, y: 745.15 }   // P3 - esquina sup-der
];

// Datos del Excel para VIP DERECHA
const excelData = require('./tangamanga_seats.json')['VIP DERECHA'];

console.log('=== GENERADOR VIP DERECHA ===\n');
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
const numRows = excelData.filas.length;
const rowSpacing = (vMax - vMin) / (numRows + 1);

console.log('\nFilas:', numRows, '| Espaciado vertical:', rowSpacing.toFixed(1));

// Procesar cada fila según Excel
excelData.filas.forEach((filaData, rowIndex) => {
  const fila = filaData.fila;
  // Usar cantidad real de asientos
  const numSeats = filaData.asientos;
  // Extraer rango de numeración
  const rangoMatch = filaData.numeracion.match(/(\d+)\s*a\s*(\d+)/);
  const numStart = parseInt(rangoMatch[1]);
  const numEnd = parseInt(rangoMatch[2]);
  
  // El rango indica inicio y fin, con posibles huecos
  // Usar los números desde el FINAL para atrás (numEnd - numSeats + 1 hasta numEnd)
  const seatNumbers = [];
  for (let i = 0; i < numSeats; i++) {
    seatNumbers.push(numEnd - numSeats + 1 + i);
  }
  
  console.log(`  DEBUG Fila ${fila}: rango ${numStart}-${numEnd}, qty ${numSeats}, generando: ${seatNumbers[0]}-${seatNumbers[seatNumbers.length-1]}`);
  
  // Posición V para esta fila (fila 1 arriba, fila 8 abajo)
  const rowNum = parseInt(fila);
  const vPos = vMin + rowSpacing * rowNum;
  
  // Encontrar límites U para esta fila
  // Hacer un barrido para encontrar donde el polígono intersecta
  let uStart = uMin;
  let uEnd = uMax;
  
  // Buscar límites reales
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
  
  // Margen interno
  const margin = 5;
  uStart += margin;
  uEnd -= margin;
  
  const availableWidth = uEnd - uStart;
  const seatSpacing = numSeats > 1 ? availableWidth / (numSeats - 1) : 0;
  
  let rowSeats = [];
  
  seatNumbers.forEach((seatNum, seatIndex) => {
    const u = uStart + seatIndex * seatSpacing;
    const pos = unrotate(u, vPos, angle);
    
    const seatId = `vip-derecha-${fila}-${seatNum}`;
    rowSeats.push({
      id: seatId,
      sectionId: 'section-1769727657188',
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

console.log('\nTotal generados:', seats.length, '/', excelData.total, 'esperados');

// Guardar
fs.writeFileSync('server/vip-derecha-fixed.json', JSON.stringify(seats, null, 2));
console.log('Guardado en server/vip-derecha-fixed.json');

// Verificar ángulos
console.log('\n=== VERIFICACIÓN DE ÁNGULOS ===');
['1', '4', '8'].forEach(fila => {
  const filaSeats = seats.filter(s => s.row === fila).sort((a, b) => parseInt(a.number) - parseInt(b.number));
  if (filaSeats.length >= 2) {
    const first = filaSeats[0];
    const last = filaSeats[filaSeats.length - 1];
    const ang = Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI;
    console.log(`Fila ${fila}: ángulo ${ang.toFixed(1)}° (esperado: ${angleDeg.toFixed(1)}°) ${Math.abs(ang - angleDeg) < 1 ? '✓' : '✗'}`);
  }
});
