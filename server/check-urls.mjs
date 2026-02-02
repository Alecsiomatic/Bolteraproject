import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Check for malformed URLs in images
  const [events] = await conn.execute(`
    SELECT id, name, thumbnailImage, coverImage 
    FROM Event 
    WHERE thumbnailImage IS NOT NULL OR coverImage IS NOT NULL
  `);
  
  console.log('=== CHECKING IMAGE URLS ===\n');
  for (const e of events) {
    console.log(`Event: ${e.name}`);
    console.log(`  thumbnailImage: ${e.thumbnailImage}`);
    console.log(`  coverImage: ${e.coverImage}`);
    
    // Check for malformed URLs
    if (e.thumbnailImage && !e.thumbnailImage.startsWith('http://') && !e.thumbnailImage.startsWith('https://') && !e.thumbnailImage.startsWith('/')) {
      console.log(`  ⚠️ MALFORMED thumbnailImage!`);
    }
    if (e.coverImage && !e.coverImage.startsWith('http://') && !e.coverImage.startsWith('https://') && !e.coverImage.startsWith('/')) {
      console.log(`  ⚠️ MALFORMED coverImage!`);
    }
  }
  
  // Check for localhost URLs
  const [localhostUrls] = await conn.execute(`
    SELECT id, name, thumbnailImage, coverImage 
    FROM Event 
    WHERE thumbnailImage LIKE '%localhost%' OR coverImage LIKE '%localhost%'
  `);
  
  console.log('\n=== LOCALHOST URLS ===');
  if (localhostUrls.length === 0) {
    console.log('No localhost URLs found');
  } else {
    for (const e of localhostUrls) {
      console.log(`Event: ${e.name}`);
      console.log(`  thumbnailImage: ${e.thumbnailImage}`);
      console.log(`  coverImage: ${e.coverImage}`);
    }
  }
  
  // Check app settings
  const [settings] = await conn.execute(`SELECT \`key\`, value FROM AppSetting WHERE \`key\` LIKE '%logo%' OR \`key\` LIKE '%image%'`);
  console.log('\n=== APP SETTINGS WITH IMAGES ===');
  for (const s of settings) {
    console.log(`${s.key}: ${s.value}`);
    if (s.value && s.value.includes('localhost')) {
      console.log(`  ⚠️ Contains localhost!`);
    }
  }
  
  await conn.end();
}

main().catch(console.error);
