import Database from 'better-sqlite3';

const db = new Database('trading.db');

export function initDB() {
    db.pragma('journal_mode = WAL');
    db.exec(`
        CREATE TABLE IF NOT EXISTS portfolio (
            id INTEGER PRIMARY KEY,
            balance REAL
        );
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            news_title TEXT,
            sentiment REAL,
            asset TEXT,
            entry_price REAL,
            position_size REAL,
            stop_loss REAL,
            take_profit REAL,
            status TEXT,
            pnl REAL
        );
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            title TEXT,
            sentiment REAL,
            url TEXT,
            asset TEXT
        );
    `);

    const row = db.prepare('SELECT * FROM portfolio WHERE id = 1').get();
    if (!row) {
        db.prepare('INSERT INTO portfolio (id, balance) VALUES (1, 100000)').run();
    }
}

export function getPortfolio() {
    return db.prepare('SELECT balance FROM portfolio WHERE id = 1').get();
}

export function updatePortfolio(newBalance: number) {
    db.prepare('UPDATE portfolio SET balance = ? WHERE id = 1').run(newBalance);
}

export function newsExists(title: string) {
    const row = db.prepare('SELECT id FROM news WHERE title = ?').get(title);
    return !!row;
}

export function insertNews(timestamp: string, title: string, sentiment: number, url: string, asset: string) {
    db.prepare('INSERT INTO news (timestamp, title, sentiment, url, asset) VALUES (?, ?, ?, ?, ?)').run(timestamp, title, sentiment, url, asset);
}

export function insertTrade(timestamp: string, news_title: string, sentiment: number, asset: string, entry_price: number, position_size: number, stop_loss: number, take_profit: number) {
    db.prepare(`
        INSERT INTO trades (timestamp, news_title, sentiment, asset, entry_price, position_size, stop_loss, take_profit, status, pnl)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 0)
    `).run(timestamp, news_title, sentiment, asset, entry_price, position_size, stop_loss, take_profit);
}

export function getOpenTrades() {
    return db.prepare("SELECT * FROM trades WHERE status = 'OPEN'").all();
}

export function closeTrade(id: number, pnl: number) {
    db.prepare("UPDATE trades SET status = 'CLOSED', pnl = ? WHERE id = ?").run(pnl, id);
}

export function getAllTrades() {
    return db.prepare("SELECT * FROM trades ORDER BY timestamp DESC LIMIT 50").all();
}

export function getRecentNews() {
    return db.prepare("SELECT * FROM news ORDER BY timestamp DESC LIMIT 50").all();
}
