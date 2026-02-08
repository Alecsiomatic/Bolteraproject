const mysql = require("mysql2/promise");
const fs = require("fs");

async function updateLayout() {
  const conn = await mysql.createConnection({
    host: "srv440.hstgr.io",
    user: "u191251575_eventOS",
    password: "Alecs.com2006",
    database: "u191251575_eventOS"
  });
  
  const layoutData = fs.readFileSync("/tmp/diamante-layout-with-izq-seats.json", "utf8");
  console.log("Layout size:", layoutData.length);
  
  const [result] = await conn.execute(
    "UPDATE VenueLayout SET layoutJson = ? WHERE id = ?",
    [layoutData, "1ddc4808-a6d2-43a0-82af-84f664439969"]
  );
  
  console.log("Rows affected:", result.affectedRows);
  await conn.end();
}

updateLayout().catch(e => console.error(e.message));
