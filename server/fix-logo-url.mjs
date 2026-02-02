import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const newLogoUrl = 'https://update.compratuboleto.mx/uploads/misc/1768000121487-03c3e08a.png';
  
  await conn.execute(
    "UPDATE Setting SET value = ? WHERE `key` = 'app.logo'",
    [newLogoUrl]
  );
  
  console.log('Logo URL updated to:', newLogoUrl);
  
  // Verify
  const [result] = await conn.execute("SELECT * FROM Setting WHERE `key` = 'app.logo'");
  console.log('Updated setting:', result);
  
  await conn.end();
}

main().catch(console.error);
