// Verificar asientos PLUS IZQUIERDA
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    where: { venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', id: { startsWith: 'plus-izquierda-' } },
    select: { rowLabel: true, columnNumber: true }
  });
  
  console.log('=== VERIFICAR PLUS IZQUIERDA ===\n');
  console.log('Total en DB:', seats.length);
  
  const byRow = {};
  seats.forEach(s => {
    if (!byRow[s.rowLabel]) byRow[s.rowLabel] = [];
    byRow[s.rowLabel].push(s.columnNumber);
  });
  
  const expected = { P:26, O:25, N:25, M:31, L:31, K:30, J:30, I:29, H:29, G:28, F:28, E:27, D:27, C:27, B:26, A:26 };
  const rows = ['P','O','N','M','L','K','J','I','H','G','F','E','D','C','B','A'];
  
  console.log('\nFila | DB  | Excel | Status');
  console.log('-----|-----|-------|-------');
  
  let totalDB = 0;
  let totalExpected = 0;
  
  rows.forEach(r => {
    const nums = (byRow[r] || []).sort((a,b) => a-b);
    const count = nums.length;
    const exp = expected[r];
    const status = count === exp ? '✅' : `❌ faltan ${exp - count}`;
    console.log(`  ${r}  |  ${String(count).padStart(2)} |  ${String(exp).padStart(2)}   | ${status}`);
    totalDB += count;
    totalExpected += exp;
  });
  
  console.log('-----|-----|-------|-------');
  console.log(`TOTAL| ${totalDB} | ${totalExpected}  |`);
  
  if (totalDB === totalExpected) {
    console.log('\n✅ Todos los asientos están presentes');
  } else {
    console.log(`\n❌ Faltan ${totalExpected - totalDB} asientos`);
  }
  
  await prisma.$disconnect();
}
main().catch(console.error);
