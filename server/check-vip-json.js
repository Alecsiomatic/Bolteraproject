const d = require('./tangamanga_seats.json');

const vips = ['VIP DERECHA', 'VIP CENTRAL', 'VIP IZQUIERDA'];

vips.forEach(seccion => {
  console.log(`\n=== ${seccion} (Excel JSON) ===`);
  const data = d[seccion];
  if (!data) {
    console.log('No encontrado!');
    return;
  }
  
  // data es objeto con filas
  const rows = Object.keys(data).sort().reverse();
  let total = 0;
  
  rows.forEach(fila => {
    const seats = data[fila];
    const nums = seats.map(s => s.numero).sort((a, b) => a - b);
    console.log(`Fila ${fila}: ${nums.length} asientos (${nums[0]}-${nums[nums.length - 1]})`);
    total += nums.length;
  });
  
  console.log(`TOTAL ${seccion}: ${total}`);
});
