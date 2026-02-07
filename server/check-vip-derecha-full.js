// Ver estructura completa de VIP DERECHA
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const l = await prisma.venueLayout.findUnique({
    where: { id: '463cd0db-a5f8-43da-b416-b704f0e3fdba' },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(l.layoutJson);
  
  const vipDerecha = data.sections.find(s => s.name === 'VIP DERECHA');
  
  if (vipDerecha) {
    console.log('VIP DERECHA - Estructura completa:');
    console.log(JSON.stringify(vipDerecha, null, 2));
  }
  
  // También buscar en canvas si hay algo
  if (data.canvas) {
    console.log('\n\nCanvas keys:', Object.keys(data.canvas));
    if (data.canvas.objects) {
      const vipObj = data.canvas.objects.find(o => o.label === 'VIP DERECHA' || (o.id && o.id.includes('1769727657188')));
      if (vipObj) {
        console.log('\nVIP DERECHA en canvas objects:');
        console.log(JSON.stringify(vipObj, null, 2));
      }
    }
  }
  
  await prisma.$disconnect();
}
main();
