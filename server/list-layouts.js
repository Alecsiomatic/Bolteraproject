const mysql = require("mysql2/promise");

async function main() {
  const conn = await mysql.createConnection({
    host: "srv440.hstgr.io",
    user: "u191251575_eventOS",
    password: "Alecs.com2006",
    database: "u191251575_eventOS"
  });
  
  const [rows] = await conn.execute("SELECT id, name FROM VenueLayout");
  console.log("Layouts disponibles:");
  rows.forEach(r => console.log(" -", r.id, ":", r.name));
  await conn.end();
}

main().catch(e => console.error(e.message));
