// Ver fila 8 de VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const seats = await prisma.seat.findMany({
    where: { 
      venueId: '2dc4584b-3a89-4c99-a933-eba0a846a04b', 
      id: { startsWith: 'vip-derecha-8-' } 
    },
    select: { columnNumber: true }
  });
  const nums = seats.map(x => x.columnNumber).sort((a,b) => a - b);
  console.log('Fila 8 VIP DERECHA:');
  console.log('Total:', nums.length);
  console.log('Números:', nums.join(', '));
  console.log('Min:', nums[0], 'Max:', nums[nums.length-1]);
  
  // Si Excel dice 41-70 con 24 asientos, y hay 23, falta 1
  // Pero 70-41+1=30, entonces hay gaps de 6
  // Posibilidad 1: solo pares (41,43,45...69) = 15 nums - NO
  // Posibilidad 2: solo impares (42,44,46...70) = 15 nums - NO
  // Posibilidad 3: consecutivos en algún rango
  
  // Si actual es 48-70 (23 nums), y Excel quiere 24 desde 41-70
  // Probablemente falta el 47 para tener 47-70 = 24
  
  await prisma.$disconnect();
}
main();
