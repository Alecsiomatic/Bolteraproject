const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function deleteSeats() {
  console.log('=== ELIMINANDO ASIENTOS ===');
  
  // Contar antes
  const before = await prisma.seat.count({
    where: { layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba' }
  });
  console.log('Asientos antes:', before);
  
  // Eliminar asientos de este layout
  const deleted = await prisma.seat.deleteMany({
    where: { layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba' }
  });
  
  console.log('Asientos eliminados:', deleted.count);
  
  // Contar después
  const after = await prisma.seat.count({
    where: { layoutId: '463cd0db-a5f8-43da-b416-b704f0e3fdba' }
  });
  console.log('Asientos después:', after);
  
  console.log('\n✅ Solo quedan los polígonos/secciones');
}

deleteSeats()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
