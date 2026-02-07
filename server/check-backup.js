const fs = require("fs");
const backup = JSON.parse(fs.readFileSync("/tmp/backup.json", "utf8"));

console.log("Backup keys:", Object.keys(backup));
console.log("Has seats:", backup.seats ? "YES" : "NO");
if (backup.seats) {
  console.log("Seats count:", backup.seats.length);
  console.log("First seat:", JSON.stringify(backup.seats[0], null, 2));
}
