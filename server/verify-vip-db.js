// Verificar numeración VIP actual en la DB
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';

async function main() {
  console.log('=== VERIFICACIÓN VIP EN DB ===\n');
  
  // VIP DERECHA
  console.log('VIP DERECHA:');
  const vipDer = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-derecha-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true }
  });
  const derByRow = {};
  vipDer.forEach(s => {
    if (!derByRow[s.rowLabel]) derByRow[s.rowLabel] = [];
    derByRow[s.rowLabel].push(s.columnNumber);
  });
  Object.keys(derByRow).sort().forEach(row => {
    const nums = derByRow[row].sort((a,b) => a-b);
    console.log(`  Fila ${row}: ${nums.length} asientos, nums ${nums[0]}-${nums[nums.length-1]}`);
  });
  console.log(`  Total: ${vipDer.length}\n`);
  
  // VIP CENTRAL
  console.log('VIP CENTRAL:');
  const vipCen = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-central-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true }
  });
  const cenByRow = {};
  vipCen.forEach(s => {
    if (!cenByRow[s.rowLabel]) cenByRow[s.rowLabel] = [];
    cenByRow[s.rowLabel].push(s.columnNumber);
  });
  Object.keys(cenByRow).sort().forEach(row => {
    const nums = cenByRow[row].sort((a,b) => a-b);
    console.log(`  Fila ${row}: ${nums.length} asientos, nums ${nums[0]}-${nums[nums.length-1]}`);
  });
  console.log(`  Total: ${vipCen.length}\n`);
  
  // VIP IZQUIERDA
  console.log('VIP IZQUIERDA:');
  const vipIzq = await prisma.seat.findMany({
    where: { venueId: VENUE_ID, id: { startsWith: 'vip-izquierda-' } },
    select: { id: true, label: true, rowLabel: true, columnNumber: true }
  });
  const izqByRow = {};
  vipIzq.forEach(s => {
    if (!izqByRow[s.rowLabel]) izqByRow[s.rowLabel] = [];
    izqByRow[s.rowLabel].push(s.columnNumber);
  });
  Object.keys(izqByRow).sort().forEach(row => {
    const nums = izqByRow[row].sort((a,b) => a-b);
    console.log(`  Fila ${row}: ${nums.length} asientos, nums ${nums[0]}-${nums[nums.length-1]}`);
  });
  console.log(`  Total: ${vipIzq.length}`);
  
  console.log(`\n=== TOTAL VIP: ${vipDer.length + vipCen.length + vipIzq.length} (Excel: 514) ===`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
