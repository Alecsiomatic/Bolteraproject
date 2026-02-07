// Ver estructura del layout
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const l = await prisma.venueLayout.findUnique({
    where: { id: '463cd0db-a5f8-43da-b416-b704f0e3fdba' },
    select: { layoutJson: true }
  });
  
  const data = JSON.parse(l.layoutJson);
  console.log('Keys:', Object.keys(data));
  
  if (data.sections) {
    console.log('\nSections count:', data.sections.length);
    data.sections.forEach(s => console.log('  Section:', s.name || s.label, '-', s.id));
  }
  
  if (data.objects) {
    console.log('\nObjects count:', data.objects.length);
    const sections = data.objects.filter(o => o.customType === 'section');
    console.log('Section objects:', sections.length);
    sections.forEach(s => console.log('  -', s.label, s.id));
  }
  
  await prisma.$disconnect();
}
main();
