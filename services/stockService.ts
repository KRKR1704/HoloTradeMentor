import { Stock, StockHistoryPoint } from '../types';

const BACKEND = 'http://localhost:8000';

// Simulates network delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const searchStocks = async (query: string): Promise<Stock[]> => {
  await delay(300);
  try {
    const res = await fetch(`${BACKEND}/api/search?query=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    const data = await res.json();
    return data.map((item: { symbol: string; name: string }) => ({
      symbol: item.symbol,
      name: item.name,
      price: 0,
      open: 0,
      previousClose: 0,
    }));
  } catch {
    return [];
  }
};

export const getStockQuote = async (symbol: string): Promise<Stock | null> => {
  try {
    const res = await fetch(`${BACKEND}/api/quote/${encodeURIComponent(symbol)}`);
    if (!res.ok) throw new Error('Quote failed');
    const data = await res.json();
    return {
      symbol: data.symbol,
      name: data.name,
      price: parseFloat(data.price) || 0,
      open: parseFloat(data.price) || 0,
      previousClose: parseFloat(data.price) || 0,
    };
  } catch {
    return null;
  }
};

export const getStockHistory = async (symbol: string): Promise<StockHistoryPoint[]> => {
  try {
    const res = await fetch(`${BACKEND}/api/candles/${encodeURIComponent(symbol)}?interval=1day`);
    if (!res.ok) throw new Error('Candles failed');
    const data = await res.json();
    return data.candles.map((candle: { time: string; open: number; high: number; low: number; close: number }) => ({
      date: candle.time.split(' ')[0],
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
  } catch {
    return [];
  }
};