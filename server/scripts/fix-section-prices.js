"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
async function fixSectionPrices() {
    // Parse DATABASE_URL from environment
    const dbUrl = process.env.DATABASE_URL || 'mysql://u191251575_eventOS:Alecs.com2006@srv440.hstgr.io:3306/u191251575_eventOS';
    const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) {
        throw new Error('Invalid DATABASE_URL format');
    }
    const [, user, password, host, port, database] = match;
    const conn = await promise_1.default.createConnection({
        host,
        port: parseInt(port),
        user,
        password,
        database
    });
    try {
        // Obtener TODOS los eventos que tienen precios sin sectionId vinculado
        const [events] = await conn.query(`
      SELECT DISTINCT e.id, e.name, e.venueId 
      FROM Event e
      JOIN EventPriceTier pt ON pt.eventId = e.id
      WHERE pt.sectionId IS NULL
    `);
        console.log(`Found ${events.length} events with unlinked price tiers`);
        for (const event of events) {
            console.log(`\n--- Processing event: ${event.name} (${event.id}) ---`);
            // Obtener el layout del venue/evento
            const [layouts] = await conn.query('SELECT id FROM VenueLayout WHERE venueId = ? LIMIT 1', [event.venueId]);
            if (layouts.length === 0) {
                console.log('  No layout found, skipping');
                continue;
            }
            const layout = layouts[0];
            console.log(`  Layout: ${layout.id}`);
            // Obtener las secciones del layout
            const [sections] = await conn.query('SELECT id, name FROM LayoutSection WHERE parentLayoutId = ?', [layout.id]);
            if (sections.length === 0) {
                console.log('  No sections in layout, skipping');
                continue;
            }
            console.log(`  Sections: ${sections.map((s) => s.name).join(', ')}`);
            // Obtener los tiers del evento sin sectionId
            const [tiers] = await conn.query('SELECT id, label, sectionId FROM EventPriceTier WHERE eventId = ? AND sectionId IS NULL', [event.id]);
            console.log(`  Tiers without sectionId: ${tiers.length}`);
            // Vincular tiers con secciones por nombre
            for (const tier of tiers) {
                const match = sections.find((s) => s.name.trim().toLowerCase() === tier.label.trim().toLowerCase());
                if (match) {
                    console.log(`  ✓ Linking tier "${tier.label}" -> section ${match.id}`);
                    await conn.query('UPDATE EventPriceTier SET sectionId = ? WHERE id = ?', [match.id, tier.id]);
                }
                else {
                    console.log(`  ✗ No matching section for tier "${tier.label}"`);
                }
            }
        }
        // Mostrar resumen final
        const [remaining] = await conn.query('SELECT COUNT(*) as count FROM EventPriceTier WHERE sectionId IS NULL');
        console.log(`\n=== Done! Remaining tiers without sectionId: ${remaining[0].count} ===`);
    }
    finally {
        await conn.end();
    }
}
fixSectionPrices().catch(console.error);
