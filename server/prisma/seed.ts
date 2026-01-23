import { PrismaClient, SeatStatus, SessionStatus, TicketStatus, UserRole, EventStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@boletera.com" },
    create: {
      name: "Admin User",
      email: "admin@boletera.com",
      password: "$2a$10$placeholderhash",
      role: UserRole.ADMIN,
    },
    update: {},
  });

  const operator = await prisma.user.upsert({
    where: { email: "operaciones@boletera.com" },
    create: {
      name: "Operador Principal",
      email: "operaciones@boletera.com",
      password: "$2a$10$placeholderhash",
      role: UserRole.OPERATOR,
    },
    update: {},
  });

  const venue = await prisma.venue.upsert({
    where: { slug: "teatro-nacional" },
    create: {
      name: "Teatro Nacional",
      slug: "teatro-nacional",
      address: "Av. Principal 123",
      city: "CDMX",
      country: "México",
      capacity: 500,
      description: "Venue principal para eventos premium",
    },
    update: {},
  });

  const vipZone = await prisma.venueZone.upsert({
    where: { id: "vip-zone" },
    create: {
      id: "vip-zone",
      venueId: venue.id,
      name: "VIP",
      color: "#f97316",
    },
    update: {},
  });

  const generalZone = await prisma.venueZone.upsert({
    where: { id: "general-zone" },
    create: {
      id: "general-zone",
      venueId: venue.id,
      name: "General",
      color: "#2563eb",
    },
    update: {},
  });

  // VenueTemplate seed data
  await prisma.venueTemplate.upsert({
    where: { id: "template-theater-500" },
    create: {
      id: "template-theater-500",
      name: "Teatro 500 asientos",
      category: "theater",
      capacity: 500,
      layoutJson: {
        zones: [
          { name: "Palco VIP", color: "#f97316", capacity: 50, rows: 2 },
          { name: "Platea", color: "#2563eb", capacity: 300, rows: 15 },
          { name: "Balcón", color: "#16a34a", capacity: 150, rows: 10 },
        ],
      },
      description: "Distribución estándar para teatro con palcos, platea y balcón",
    },
    update: {},
  });

  await prisma.venueTemplate.upsert({
    where: { id: "template-stadium-20k" },
    create: {
      id: "template-stadium-20k",
      name: "Estadio 20,000 personas",
      category: "stadium",
      capacity: 20000,
      layoutJson: {
        zones: [
          { name: "Campo", color: "#f97316", capacity: 5000, standing: true },
          { name: "Tribuna Norte", color: "#2563eb", capacity: 5000, rows: 30 },
          { name: "Tribuna Sur", color: "#16a34a", capacity: 5000, rows: 30 },
          { name: "Palcos Premium", color: "#a855f7", capacity: 5000, rows: 10 },
        ],
      },
      description: "Layout para estadio con campo y tribunas",
    },
    update: {},
  });

  await prisma.venueTemplate.upsert({
    where: { id: "template-club-300" },
    create: {
      id: "template-club-300",
      name: "Club/Bar 300 personas",
      category: "club",
      capacity: 300,
      layoutJson: {
        zones: [
          { name: "Pista", color: "#f97316", capacity: 150, standing: true },
          { name: "Mesas VIP", color: "#a855f7", capacity: 80, tables: 20 },
          { name: "Barra", color: "#2563eb", capacity: 70, standing: true },
        ],
      },
      description: "Distribución típica de club con pista, mesas y barra",
    },
    update: {},
  });

  // VenueProduct seed data
  const productsData = [
    { type: "food", name: "Combo Hot Dog", description: "Hot dog + papas + refresco", price: 150.00 },
    { type: "food", name: "Hamburguesa Premium", description: "Hamburguesa doble con queso", price: 200.00 },
    { type: "food", name: "Palomitas Grande", description: "Palomitas jumbo con mantequilla", price: 80.00 },
    { type: "beverage", name: "Cerveza Nacional", description: "Lata 355ml", price: 60.00, stock: 500 },
    { type: "beverage", name: "Refresco Grande", description: "1L de refresco", price: 45.00 },
    { type: "beverage", name: "Agua embotellada", description: "Botella 600ml", price: 30.00 },
    { type: "parking", name: "Estacionamiento VIP", description: "Espacio cubierto", price: 120.00, stock: 50 },
    { type: "parking", name: "Estacionamiento General", description: "Espacio descubierto", price: 80.00, stock: 200 },
    { type: "merchandise", name: "Playera del Evento", description: "Talla M/L/XL", price: 350.00, stock: 100 },
    { type: "merchandise", name: "Gorra Oficial", description: "Ajustable", price: 250.00, stock: 80 },
    { type: "gift", name: "Gift Card $500", description: "Vale para próximos eventos", price: 500.00, isActive: true },
    { type: "other", name: "Programa del Evento", description: "Programa conmemorativo", price: 50.00, stock: 300 },
  ];

  for (const product of productsData) {
    await prisma.venueProduct.upsert({
      where: { id: `product-${product.type}-${product.name.toLowerCase().replace(/\s+/g, '-')}` },
      create: {
        id: `product-${product.type}-${product.name.toLowerCase().replace(/\s+/g, '-')}`,
        venueId: venue.id,
        type: product.type as any,
        name: product.name,
        description: product.description,
        price: product.price,
        stock: product.stock ?? null,
        isActive: product.isActive !== false,
      },
      update: {},
    });
  }

  // VenueAlert seed data - matching actual schema (no name/type fields)
  await prisma.venueAlert.upsert({
    where: { id: "alert-capacity-warning" },
    create: {
      id: "alert-capacity-warning",
      venueId: venue.id,
      condition: "sold_rate_gt",
      threshold: 90,
      notifyEmails: JSON.stringify(["admin@boletera.com", "operaciones@boletera.com"]),
      isActive: true,
    },
    update: {},
  });

  await prisma.venueAlert.upsert({
    where: { id: "alert-stock-critical" },
    create: {
      id: "alert-stock-critical",
      venueId: venue.id,
      condition: "available_lt",
      threshold: 10,
      notifyEmails: JSON.stringify(["inventario@boletera.com", "operaciones@boletera.com"]),
      isActive: true,
    },
    update: {},
  });

  await prisma.venueAlert.upsert({
    where: { id: "alert-schedule-conflicts" },
    create: {
      id: "alert-schedule-conflicts",
      venueId: venue.id,
      condition: "last_sale_age_gt",
      threshold: 0,
      notifyEmails: JSON.stringify(["admin@boletera.com", "eventos@boletera.com"]),
      isActive: true,
    },
    update: {},
  });

  const seatPayload = Array.from({ length: 30 }).map((_, index) => ({
    label: `A-${index + 1}`,
    venueId: venue.id,
    zoneId: index < 10 ? vipZone.id : generalZone.id,
    rowLabel: "A",
    columnNumber: index + 1,
    status: index < 25 ? SeatStatus.AVAILABLE : SeatStatus.BLOCKED,
  }));

  await prisma.seat.createMany({
    data: seatPayload,
    skipDuplicates: true,
  });

  const event = await prisma.event.upsert({
    where: { slug: "concierto-rock-2025" },
    create: {
      name: "Concierto Rock 2025",
      slug: "concierto-rock-2025",
      description: "El evento principal del año",
      status: EventStatus.PUBLISHED,
      venueId: venue.id,
      createdById: admin.id,
    },
    update: {},
  });

  const sessionStart = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
  const sessionEnd = new Date(sessionStart.getTime() + 3 * 60 * 60 * 1000);

  const session = await prisma.eventSession.upsert({
    where: { id: "session-rock-1" },
    create: {
      id: "session-rock-1",
      eventId: event.id,
      title: "Función Principal",
      startsAt: sessionStart,
      endsAt: sessionEnd,
      status: SessionStatus.SALES_OPEN,
      capacity: 500,
    },
    update: {},
  });

  const seats = await prisma.seat.findMany({
    where: { venueId: venue.id },
    take: 20,
    orderBy: { columnNumber: "asc" },
  });

  await prisma.ticket.createMany({
    data: seats.map((seat, index) => ({
      sessionId: session.id,
      seatId: seat.id,
      price: 1200.0,
      currency: "MXN",
      status: index < 5 ? TicketStatus.SOLD : TicketStatus.RESERVED,
    })),
    skipDuplicates: true,
  });

  console.log("✅ Seed completado");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
