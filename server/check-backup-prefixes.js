// Ver prefijos en backup
const fs = require('fs');
const b = JSON.parse(fs.readFileSync('backup-restore.json','utf8'));
const prefixes = {};
b.seats.forEach(s => {
  const parts = s.id.split('-');
  let p;
  if (parts[0] === 'diamante' || parts[0] === 'vip' || parts[0] === 'plus' || parts[0] === 'preferente') {
    p = parts.slice(0, 2).join('-');
  } else {
    p = parts[0];
  }
  prefixes[p] = (prefixes[p] || 0) + 1;
});
console.log(prefixes);
