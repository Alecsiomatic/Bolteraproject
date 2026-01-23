"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../src/config/env");
async function main() {
    const connection = await promise_1.default.createConnection({
        host: env_1.env.DB_HOST,
        port: env_1.env.DB_PORT,
        user: env_1.env.DB_USER,
        password: env_1.env.DB_PASSWORD,
        database: env_1.env.DB_NAME,
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
