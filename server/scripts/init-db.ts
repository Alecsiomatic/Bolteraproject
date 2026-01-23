import path from "path";
import fs from "fs/promises";
import mysql from "mysql2/promise";
import { env } from "../src/config/env";

async function runSqlFile(fileName: string) {
  const filePath = path.resolve(__dirname, "..", "sql", fileName);
  const sql = await fs.readFile(filePath, "utf8");

  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
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
