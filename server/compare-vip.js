const https = require('https');
const fs = require('fs');

const VENUE_ID = '2dc4584b-3a89-4c99-a933-eba0a846a04b';
const BASE_URL = 'update.compratuboleto.mx';

function httpsRequest(options) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function main() {
  // Cargar datos del Excel (JSON)
  const excelData = require('./tangamanga_seats.json');
  
  // Obtener datos actuales del servidor
  console.log('Obteniendo datos del servidor...');
  const res = await httpsRequest({
    hostname: BASE_URL,
    port: 443,
    path: `/api/venues/${VENUE_ID}`,
    method: 'GET'
  });
  const venue = JSON.parse(res.data);
  const currentSeats = venue.seats || [];
  
  const sections = ['VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA'];
  
  for (const seccion of sections) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`=== ${seccion} ===`);
    console.log('='.repeat(60));
    
    const prefix = seccion.toLowerCase().replace(/ /g, '-');
    
    // Datos del Excel
    const excelSection = excelData[seccion];
    if (!excelSection) {
      console.log('❌ No hay datos en Excel para esta sección');
      continue;
    }
    
    console.log('\n📊 EXCEL:');
    const excelByRow = {};
    excelSection.filas.forEach(f => {
      excelByRow[f.fila] = {
        count: f.asientos,
        numbers: f.seat_numbers,
        range: f.numeracion
      };
    });
    
    const excelRows = Object.keys(excelByRow).sort((a, b) => parseInt(b) - parseInt(a));
    let excelTotal = 0;
    excelRows.forEach(fila => {
      const data = excelByRow[fila];
      console.log(`  Fila ${fila}: ${data.count} asientos (${data.range})`);
      excelTotal += data.count;
    });
    console.log(`  TOTAL Excel: ${excelTotal}`);
    
    // Datos del servidor
    const dbSeats = currentSeats.filter(s => s.id.startsWith(prefix + '-'));
    console.log('\n💾 BASE DE DATOS:');
    
    const dbByRow = {};
    dbSeats.forEach(s => {
      // Extraer fila del id: vip-derecha-1-38 -> fila 1, numero 38
      const parts = s.id.split('-');
      const fila = parts[2];
      const numero = parseInt(parts[3]);
      
      if (!dbByRow[fila]) dbByRow[fila] = [];
      dbByRow[fila].push(numero);
    });
    
    const dbRows = Object.keys(dbByRow).sort((a, b) => parseInt(b) - parseInt(a));
    let dbTotal = 0;
    dbRows.forEach(fila => {
      const nums = dbByRow[fila].sort((a, b) => a - b);
      console.log(`  Fila ${fila}: ${nums.length} asientos (${nums[0]}-${nums[nums.length-1]})`);
      dbTotal += nums.length;
    });
    console.log(`  TOTAL DB: ${dbTotal}`);
    
    // Comparación - solo cantidad, ya que no tenemos números exactos
    console.log('\n🔍 COMPARACIÓN:');
    let hasErrors = false;
    
    // Verificar filas
    const allRows = new Set([...excelRows, ...dbRows]);
    [...allRows].sort((a, b) => parseInt(b) - parseInt(a)).forEach(fila => {
      const excel = excelByRow[fila];
      const db = dbByRow[fila];
      
      if (!excel) {
        console.log(`  ❌ Fila ${fila}: Existe en DB pero NO en Excel`);
        hasErrors = true;
        return;
      }
      if (!db) {
        console.log(`  ❌ Fila ${fila}: Existe en Excel pero NO en DB`);
        hasErrors = true;
        return;
      }
      
      const excelCount = excel.count;
      const dbCount = db.length;
      
      if (excelCount === dbCount) {
        console.log(`  ✅ Fila ${fila}: ${excelCount} asientos - CANTIDAD OK`);
      } else {
        hasErrors = true;
        console.log(`  ❌ Fila ${fila}: Excel=${excelCount}, DB=${dbCount} (diferencia: ${dbCount - excelCount})`);
      }
    });
    
    if (!hasErrors) {
      console.log('\n✅ SECCIÓN CORRECTA - Coincide con Excel');
    } else {
      console.log('\n❌ SECCIÓN CON ERRORES - No coincide con Excel');
    }
  }
}

main().catch(console.error);
