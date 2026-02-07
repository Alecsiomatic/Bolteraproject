// Calcular exactamente qué asientos faltan en VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

// Excel VIP DERECHA:
// La numeración va de derecha a izquierda, pero los números específicos son:
const EXCEL_VIP_DERECHA = {
  '8': { count: 24, min: 41, max: 70 },  // 24 asientos en rango 41-70 (hay gaps, números pares o impares?)
  '7': { count: 24, min: 45, max: 68 },  // 68-45+1=24 ✓ consecutivos
  '6': { count: 23, min: 44, max: 66 },  // 66-44+1=23 ✓ consecutivos
  '5': { count: 22, min: 42, max: 63 },  // 63-42+1=22 ✓ consecutivos
  '4': { count: 23, min: 43, max: 65 },  // 65-43+1=23 ✓ consecutivos
  '3': { count: 22, min: 41, max: 62 },  // 62-41+1=22 ✓ consecutivos
  '2': { count: 22, min: 40, max: 61 },  // 61-40+1=22 ✓ consecutivos
  '1': { count: 22, min: 38, max: 59 }   // 59-38+1=22 ✓ consecutivos
};

async function main() {
  console.log('=== ASIENTOS FALTANTES EN VIP DERECHA ===\n');
  
  const seats = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { rowLabel: true, columnNumber: true }
  });
  
  // Agrupar por fila
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = new Set();
    byRow[s.rowLabel].add(s.columnNumber);
  });
  
  const missing = [];
  
  for (let row = 1; row <= 8; row++) {
    const rowStr = String(row);
    const excel = EXCEL_VIP_DERECHA[rowStr];
    const currentNums = byRow[rowStr] || new Set();
    
    // Calcular qué números deberían existir
    // Para fila 8, el rango es 41-70 pero solo 24 asientos
    // Asumimos que son consecutivos desde min hasta min+count-1
    // PERO el max es 70, así que probablemente son: min, min+1, ..., max pero con algunos gaps
    
    // Vamos a asumir que son TODOS consecutivos desde min hasta max y ver qué falta
    let expectedNums = [];
    
    if (row === 8) {
      // Fila 8 especial: 41-70 pero solo 24. 
      // Posiblemente solo pares o solo impares, o gaps específicos
      // 70-41+1 = 30 posiciones, pero 24 asientos = 6 gaps
      // Por ahora, asumamos consecutivos desde 47 (70-24+1=47) hasta 70 = NO
      // O desde 41 hasta 64 (41+24-1=64) = NO porque max es 70
      
      // Más probable: son 41-64 y 65-70 tiene gaps
      // O son todos desde 47-70 (24 asientos)
      // El Excel dice "41 a 70" así que incluye ambos extremos
      
      // Viendo la DB: tiene 48-70 (23 asientos)
      // Excel quiere 24 desde 41-70
      // La diferencia podría ser gaps de paridad
      
      // Probemos: si el rango es 41-70 con 24 asientos y actualmente hay 48-70
      // Falta agregar algunos del 41-47
      // Pero no todos, solo hasta completar 24
      // DB tiene 23, falta 1. Probablemente falta el 47
      
      for (let n = excel.min; n <= excel.max && expectedNums.length < excel.count; n++) {
        expectedNums.push(n);
      }
    } else {
      // Filas 1-7: consecutivos desde min hasta max
      for (let n = excel.min; n <= excel.max; n++) {
        expectedNums.push(n);
      }
    }
    
    console.log(`Fila ${row}:`);
    console.log(`  Excel: ${excel.count} asientos, rango ${excel.min}-${excel.max}`);
    console.log(`  DB tiene: ${currentNums.size} asientos`);
    console.log(`  Esperados (calculado): ${expectedNums.length} nums: ${expectedNums[0]}-${expectedNums[expectedNums.length-1]}`);
    
    const faltantes = expectedNums.filter(n => !currentNums.has(n));
    if (faltantes.length > 0) {
      console.log(`  ❌ FALTAN: ${faltantes.join(', ')}`);
      faltantes.forEach(num => missing.push({ row: rowStr, num }));
    } else {
      console.log(`  ✅ Completa`);
    }
    console.log();
  }
  
  console.log('=== RESUMEN ===');
  console.log(`Total asientos faltantes: ${missing.length}`);
  missing.forEach(m => console.log(`  ${m.row}-${m.num}`));
  
  await prisma.$disconnect();
}

main().catch(console.error);
