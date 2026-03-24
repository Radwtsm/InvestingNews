import Database from 'better-sqlite3';
const db = new Database('trading.db');
console.log("News:", db.prepare('SELECT COUNT(*) as c FROM news').get());
console.log("Trades:", db.prepare('SELECT COUNT(*) as c FROM trades').get());
console.log("Portfolio:", db.prepare('SELECT * FROM portfolio').get());
