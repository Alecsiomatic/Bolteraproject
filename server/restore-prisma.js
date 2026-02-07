const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

// Disable Prisma debug mode
process.env.DEBUG = '';
const prisma = new PrismaClient({ log: [] });

async function restore() {
  try {
    const backupRaw = fs.readFileSync("/tmp/backup.json", "utf8");
    const backup = JSON.parse(backupRaw);
    const venueId = "2dc4584b-3a89-4c99-a933-eba0a846a04b";
    const layoutId = "463cd0db-a5f8-43da-b416-b704f0e3fdba";
    
    console.log("Asientos en backup:", backup.seats.length);
    
    // Borrar asientos actuales
    const deleted = await prisma.seat.deleteMany({ where: { venueId } });
    console.log("Asientos borrados:", deleted.count);
    
    // Insertar en lotes de 500
    // Solo usar campos que existen en el modelo Seat del schema
    const batchSize = 500;
    let inserted = 0;
    
    for (let i = 0; i < backup.seats.length; i += batchSize) {
      const batch = backup.seats.slice(i, i + batchSize).map(s => ({
        id: s.id,
        venueId: venueId,
        layoutId: layoutId,
        zoneId: s.zoneId || null,
        rowLabel: s.rowLabel || null,
        columnNumber: s.columnNumber || null,
        label: s.label,
        status: s.status || "AVAILABLE",
        // metadata debe ser string en este schema
        metadata: typeof s.metadata === 'string' ? s.metadata : JSON.stringify(s.metadata || {})
      }));
      
      const result = await prisma.seat.createMany({ data: batch, skipDuplicates: true });
      inserted += result.count;
      console.log(`Batch ${Math.floor(i/batchSize) + 1}: +${result.count} (total: ${inserted})`);
    }
    
    console.log("=== RESTORE COMPLETADO ===");
    console.log("Total insertados:", inserted);
    
  } catch (error) {
    console.error("=== ERROR ===");
    console.error("Message:", error.message);
    if (error.code) console.error("Code:", error.code);
    if (error.meta) console.error("Meta:", JSON.stringify(error.meta));
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

restore();
