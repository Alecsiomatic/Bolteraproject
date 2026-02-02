const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const venue = await prisma.venue.findUnique({
    where: { id: "2dc4584b-3a89-4c99-a933-eba0a846a04b" },
    select: { layoutJson: true }
  });

  if (!venue || !venue.layoutJson) {
    console.log("ERROR: Venue no tiene layoutJson");
    return;
  }

  // Parsear el layoutJson
  const layout = JSON.parse(venue.layoutJson);
  
  console.log("=== ANTES DE LIMPIAR ===");
  console.log("Sections:", layout.sections?.length || 0);
  console.log("Zones:", layout.zones?.length || 0);
  
  let totalSeats = 0;
  if (layout.sections) {
    for (const section of layout.sections) {
      totalSeats += section.seats?.length || 0;
    }
  }
  console.log("Total asientos en sections:", totalSeats);

  // Limpiar los asientos de cada sección (mantener solo polígonos)
  if (layout.sections) {
    for (const section of layout.sections) {
      section.seats = []; // Vaciar asientos
    }
  }

  // Convertir de vuelta a string
  const cleanedLayoutJson = JSON.stringify(layout);
  
  console.log("\n=== DESPUÉS DE LIMPIAR ===");
  console.log("layoutJson length:", cleanedLayoutJson.length, "caracteres");

  // Actualizar ambas tablas
  await prisma.venue.update({
    where: { id: "2dc4584b-3a89-4c99-a933-eba0a846a04b" },
    data: { layoutJson: cleanedLayoutJson }
  });

  await prisma.venueLayout.update({
    where: { id: "463cd0db-a5f8-43da-b416-b704f0e3fdba" },
    data: { layoutJson: cleanedLayoutJson }
  });

  console.log("\n✅ LIMPIADO Y SINCRONIZADO!");
  console.log("Venue y VenueLayout actualizados - solo polígonos, sin asientos");
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
