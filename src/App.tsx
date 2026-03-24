/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, DollarSign, TrendingUp, TrendingDown, Newspaper, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';

interface Portfolio {
  balance: number;
}

interface Trade {
  id: number;
  timestamp: string;
  news_title: string;
  sentiment: number;
  asset: string;
  entry_price: number;
  position_size: number;
  stop_loss: number;
  status: string;
  pnl: number;
  angular_momentum: number;
  torque: number;
}

interface News {
  id: number;
  timestamp: string;
  title: string;
  sentiment: number;
  url: string;
  asset: string;
}

export default function App() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [news, setNews] = useState<News[]>([]);

  const fetchData = async () => {
    try {
      const [portRes, tradesRes, newsRes] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/trades'),
        fetch('/api/news')
      ]);
      
      setPortfolio(await portRes.json());
      setTrades(await tradesRes.json());
      setNews(await newsRes.json());
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  
  // Calculate portfolio history for chart (mocking history based on closed trades)
  const chartData = trades
    .filter(t => t.status === 'CLOSED')
    .reverse()
    .map((t, i) => {
      return {
        name: format(new Date(t.timestamp), 'HH:mm'),
        pnl: t.pnl
      };
    });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans p-6">
      <header className="mb-8 flex justify-between items-center border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Activity className="text-blue-500" />
            Nexus Trading Engine
          </h1>
          <p className="text-sm text-gray-400 mt-1">Geopolitical News-Driven Paper Trading</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-900 px-4 py-2 rounded-lg border border-gray-800 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-mono text-gray-300">SYSTEM ACTIVE</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm font-medium">Portfolio Balance</h3>
            <DollarSign className="text-gray-500 w-5 h-5" />
          </div>
          <p className="text-3xl font-mono font-semibold">
            ${portfolio?.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
          </p>
        </div>
        
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm font-medium">Open Positions</h3>
            <Activity className="text-gray-500 w-5 h-5" />
          </div>
          <p className="text-3xl font-mono font-semibold">{openTrades.length}</p>
        </div>

        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-400 text-sm font-medium">Total Realized PnL</h3>
            {totalPnL >= 0 ? <TrendingUp className="text-green-500 w-5 h-5" /> : <TrendingDown className="text-red-500 w-5 h-5" />}
          </div>
          <p className={`text-3xl font-mono font-semibold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Chart */}
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 h-[400px]">
            <h3 className="text-lg font-medium mb-6">PnL History</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="name" stroke="#666" tick={{ fill: '#666', fontSize: 12 }} />
                <YAxis stroke="#666" tick={{ fill: '#666', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="pnl" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trades Table */}
          <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 overflow-hidden">
            <h3 className="text-lg font-medium mb-6">Trade Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium">Asset</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Entry</th>
                    <th className="pb-3 font-medium">Stop Loss</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {trades.map(trade => (
                    <tr key={trade.id} className="hover:bg-gray-800/20 transition-colors">
                      <td className="py-3 text-gray-400">{format(new Date(trade.timestamp), 'HH:mm:ss')}</td>
                      <td className="py-3 font-mono">{trade.asset}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${trade.sentiment > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                          {trade.sentiment > 0 ? 'LONG' : 'SHORT'}
                        </span>
                      </td>
                      <td className="py-3 font-mono">\${trade.entry_price.toFixed(2)}</td>
                      <td className="py-3 font-mono text-gray-400">\${trade.stop_loss.toFixed(2)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs ${trade.status === 'OPEN' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10 text-gray-400'}`}>
                          {trade.status}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-mono ${trade.pnl > 0 ? 'text-green-500' : trade.pnl < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                        {trade.pnl !== 0 ? `${trade.pnl > 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {trades.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-gray-500">No trades executed yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* News Feed */}
        <div className="bg-[#141414] border border-gray-800 rounded-xl p-6 h-fit">
          <div className="flex items-center gap-2 mb-6">
            <Newspaper className="text-gray-400 w-5 h-5" />
            <h3 className="text-lg font-medium">Live News Feed</h3>
          </div>
          <div className="space-y-4">
            {news.map(item => (
              <div key={item.id} className="p-4 rounded-lg bg-gray-900/50 border border-gray-800/50 hover:border-gray-700 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500">{format(new Date(item.timestamp), 'HH:mm')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    item.sentiment > 0.3 ? 'bg-green-500/20 text-green-400' : 
                    item.sentiment < -0.3 ? 'bg-red-500/20 text-red-400' : 
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {item.sentiment > 0.3 ? 'Bullish' : item.sentiment < -0.3 ? 'Bearish' : 'Neutral'} ({(item.sentiment).toFixed(2)})
                  </span>
                </div>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-gray-200 hover:text-blue-400 transition-colors line-clamp-3">
                  {item.title}
                </a>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Target: {item.asset}</span>
                </div>
              </div>
            ))}
            {news.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                Waiting for geopolitical events...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

