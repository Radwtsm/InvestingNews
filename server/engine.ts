import Parser from 'rss-parser';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenAI, Type } from '@google/genai';
import { initDB, getPortfolio, updatePortfolio, insertNews, insertTrade, getOpenTrades, closeTrade } from './database';

const parser = new Parser();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const yahooFinance = new YahooFinance();

const KEYWORDS = ['Iran', 'USA', 'Hormuz', 'Oil', 'War', 'Sanctions', 'Tariff', 'Geopolitics', 'China', 'Russia', 'Middle East'];
const ASSET_MAP: Record<string, string> = {
    'Oil': 'CL=F',
    'Hormuz': 'CL=F',
    'Iran': 'CL=F',
    'USA': 'SPY',
    'China': 'FXI',
    'Russia': 'USO',
    'War': 'GLD',
    'Sanctions': 'GLD',
    'Tariff': 'SPY',
    'Geopolitics': 'GLD',
    'Middle East': 'CL=F'
};

const RSS_FEEDS = [
    'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', // CNBC Finance
    'https://feeds.a.dj.com/rss/RSSMarketsMain.xml' // WSJ Markets
];

// Track processed news to avoid duplicates
const processedNews = new Set<string>();

async function getSentiment(title: string): Promise<number> {
    try {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("API key missing");
        }
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-preview',
            contents: `Analyze the financial sentiment of this geopolitical news headline. Return ONLY a JSON object with a 'score' between -1.0 (very negative) and 1.0 (very positive). Headline: "${title}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER }
                    },
                    required: ["score"]
                }
            }
        });
        let text = response.text || '{"score": 0}';
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(text);
        return json.score || 0;
    } catch (e) {
        console.error('Sentiment error (using fallback):', (e as Error).message);
        // Fallback simple keyword-based sentiment
        const lowerTitle = title.toLowerCase();
        let score = 0;
        if (lowerTitle.includes('war') || lowerTitle.includes('sanctions') || lowerTitle.includes('sink') || lowerTitle.includes('rout') || lowerTitle.includes('fall')) score -= 0.6;
        if (lowerTitle.includes('truce') || lowerTitle.includes('rise') || lowerTitle.includes('winners') || lowerTitle.includes('stable')) score += 0.6;
        if (lowerTitle.includes('uncertain')) score -= 0.2;
        if (lowerTitle.includes('record')) score += 0.4;
        return score;
    }
}

async function getMarketData(symbol: string) {
    try {
        const quote = await yahooFinance.quote(symbol);
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 5); // Get last 5 days for std dev

        const chartResult = await yahooFinance.chart(symbol, { period1: start, period2: end });
        const quotes = chartResult.quotes || [];
        
        // Calculate 24h (last 1 day) std dev
        const closes = quotes.map((q: any) => q.close).filter((c: any) => c !== null && c !== undefined);
        if (closes.length === 0) throw new Error("No close data");
        
        const mean = closes.reduce((a: number, b: number) => a + b, 0) / closes.length;
        const variance = closes.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / closes.length;
        const stdDev = Math.sqrt(variance);

        // Calculate SMA (Simple Moving Average)
        const sma = mean;

        // Calculate Velocity (v)
        const currentPrice = quote.regularMarketPrice || closes[closes.length - 1] || 0;
        const yesterdayPrice = closes[closes.length - 2] || currentPrice;
        const velocity = yesterdayPrice ? (currentPrice - yesterdayPrice) / yesterdayPrice : 0;

        // Calculate Normalized Distance (r)
        const r = sma ? (currentPrice - sma) / sma : 0;

        return {
            price: currentPrice,
            stdDev,
            sma,
            velocity,
            r
        };
    } catch (e) {
        console.error(`Market data error for ${symbol}:`, e);
        return { price: 0, stdDev: 0, sma: 0, velocity: 0, r: 0 };
    }
}

export async function runCycle() {
    console.log(`[${new Date().toISOString()}] Running Trading Engine Cycle...`);
    
    // 1. Manage Open Positions (Stop Loss / Take Profit)
    const openTrades = getOpenTrades() as any[];
    for (const trade of openTrades) {
        try {
            const quote = await yahooFinance.quote(trade.asset);
            const currentPrice = quote.regularMarketPrice || 0;
            
            // Check Stop Loss
            let closePosition = false;
            if (trade.sentiment > 0 && currentPrice <= trade.stop_loss) closePosition = true; // Long stopped out
            if (trade.sentiment < 0 && currentPrice >= trade.stop_loss) closePosition = true; // Short stopped out
            
            // Take profit (simplified: 2x risk)
            const risk = Math.abs(trade.entry_price - trade.stop_loss);
            if (trade.sentiment > 0 && currentPrice >= trade.entry_price + (risk * 2)) closePosition = true;
            if (trade.sentiment < 0 && currentPrice <= trade.entry_price - (risk * 2)) closePosition = true;

            if (closePosition) {
                const pnl = trade.sentiment > 0 
                    ? (currentPrice - trade.entry_price) * trade.position_size
                    : (trade.entry_price - currentPrice) * trade.position_size;
                
                closeTrade(trade.id, pnl);
                const port = getPortfolio() as { balance: number };
                updatePortfolio(port.balance + pnl);
                console.log(`Closed trade ${trade.id} on ${trade.asset} with PnL: ${pnl}`);
            }
        } catch (e) {
            console.error(`Error managing trade ${trade.id}:`, e);
        }
    }

    // 2. Ingest News & Execute New Trades
    for (const feedUrl of RSS_FEEDS) {
        try {
            const feed = await parser.parseURL(feedUrl);
            for (const item of feed.items || []) {
                const title = item.title || '';
                if (processedNews.has(title)) continue;
                processedNews.add(title);

                // Geopolitical Filter
                const matchedKeyword = KEYWORDS.find(k => title.includes(k));
                if (matchedKeyword) {
                    const asset = ASSET_MAP[matchedKeyword] || 'SPY';
                    const sentiment = await getSentiment(title);
                    
                    insertNews(new Date().toISOString(), title, sentiment, item.link || '', asset);

                    // Trading Logic
                    if (Math.abs(sentiment) > 0.3) { // Threshold for action
                        const market = await getMarketData(asset);
                        if (!market.price) continue;

                        // Angular Momentum (L) = v * r
                        const L = market.velocity * market.r;
                        
                        // Torque (Ï) = Sentiment * Impact Factor (normalized)
                        const torque = sentiment * 1.5;

                        // Dynamic Stop-Loss based on Ï (Standard Deviation)
                        const stopLossDistance = market.stdDev * 1.5;
                        const stopLoss = sentiment > 0 
                            ? market.price - stopLossDistance 
                            : market.price + stopLossDistance;

                        // Kelly Criterion for Position Sizing
                        // f* = p - q / b (simplified: f = sentiment * 0.1)
                        const kellyFraction = Math.min(Math.abs(sentiment) * 0.1, 0.2); // Max 20% of portfolio
                        const port = getPortfolio() as { balance: number };
                        const positionValue = port.balance * kellyFraction;
                        const positionSize = positionValue / market.price;

                        insertTrade(
                            new Date().toISOString(),
                            title,
                            sentiment,
                            asset,
                            market.price,
                            positionSize,
                            stopLoss,
                            L,
                            torque
                        );
                        console.log(`Opened trade on ${asset} due to: ${title}`);
                    }
                }
            }
        } catch (e) {
            console.error(`Error processing feed ${feedUrl}:`, e);
        }
    }
}

export function startEngine() {
    // Run immediately, then every 60 seconds
    runCycle();
    setInterval(runCycle, 60000);
}
