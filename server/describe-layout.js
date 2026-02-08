const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "srv440.hstgr.io",
    user: "u191251575_eventOS",
    password: "Alecs.com2006",
    database: "u191251575_eventOS"
  });
  
  const [rows] = await conn.execute("DESCRIBE VenueLayout");
  console.log("Columnas de VenueLayout:");
  rows.forEach(r => console.log(" -", r.Field, ":", r.Type));
  await conn.end();
}

main().catch(e => console.error(e.message));
