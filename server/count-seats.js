const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });

prisma.seat.count({
  where: { venueId: "2dc4584b-3a89-4c99-a933-eba0a846a04b" }
}).then(count => {
  console.log("Asientos en DB:", count);
}).finally(() => prisma.$disconnect());
