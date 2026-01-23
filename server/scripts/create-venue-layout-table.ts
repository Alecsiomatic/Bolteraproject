import mysql from "mysql2/promise";
import { env } from "../src/config/env";

async function main() {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`VenueLayout\` (
      \`id\` VARCHAR(191) NOT NULL,
      \`venueId\` VARCHAR(191) NOT NULL,
      \`name\` VARCHAR(191) NOT NULL,
      \`version\` INTEGER NOT NULL DEFAULT 1,
      \`layoutJson\` JSON NOT NULL,
      \`metadata\` JSON NULL,
      \`isDefault\` TINYINT(1) NOT NULL DEFAULT 0,
      \`publishedAt\` DATETIME(3) NULL,
      \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updatedAt\` DATETIME(3) NOT NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`VenueLayout_venueId_version_idx\`(\`venueId\`, \`version\`),
      CONSTRAINT \`VenueLayout_venueId_fkey\`
        FOREIGN KEY (\`venueId\`) REFERENCES \`Venue\`(\`id\`)
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await connection.end();
  console.log("✅ Tabla VenueLayout verificada/creada");
}

main().catch((error) => {
  console.error("❌ Error creando tabla VenueLayout", error);
  process.exit(1);
});
