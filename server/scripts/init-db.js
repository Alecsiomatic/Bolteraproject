"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const promise_1 = __importDefault(require("mysql2/promise"));
const env_1 = require("../src/config/env");
async function runSqlFile(fileName) {
    const filePath = path_1.default.resolve(__dirname, "..", "sql", fileName);
    const sql = await promises_1.default.readFile(filePath, "utf8");
    const connection = await promise_1.default.createConnection({
        host: env_1.env.DB_HOST,
        port: env_1.env.DB_PORT,
        user: env_1.env.DB_USER,
        password: env_1.env.DB_PASSWORD,
        database: env_1.env.DB_NAME,
        multipleStatements: true,
    });
    await connection.query(sql);
    await connection.end();
}
async function main() {
    console.log("➡️  Creando estructura de base de datos...");
    await runSqlFile("schema.sql");
    console.log("✅ Estructura aplicada correctamente");
}
main().catch((error) => {
    console.error("❌ Error al crear la base de datos", error);
    process.exit(1);
});
