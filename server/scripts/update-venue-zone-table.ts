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

  const statements = [
    "ALTER TABLE `VenueZone` ADD COLUMN IF NOT EXISTS `basePrice` DECIMAL(10, 2) NULL AFTER `color`",
    "ALTER TABLE `VenueZone` ADD COLUMN IF NOT EXISTS `metadata` JSON NULL AFTER `basePrice`",
  ];

  for (const statement of statements) {
    await connection.query(statement);
  }

  await connection.end();
  console.log("✅ Tabla VenueZone actualizada");
}

main().catch((error) => {
  console.error("❌ Error actualizando VenueZone", error);
  process.exit(1);
});
