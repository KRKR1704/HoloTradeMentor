import { Stock, StockHistoryPoint } from '../types';
import { MOCK_STOCKS } from '../constants';

// Simulates network delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const searchStocks = async (query: string): Promise<Stock[]> => {
  await delay(300);
  if (!query) {
    return MOCK_STOCKS.slice(0, 10); // Return more popular stocks by default
  }
  const lowerCaseQuery = query.toLowerCase();
  return MOCK_STOCKS.filter(
    stock =>
      stock.symbol.toLowerCase().includes(lowerCaseQuery) ||
      stock.name.toLowerCase().includes(lowerCaseQuery)
  );
};

export const getStockHistory = async (symbol: string): Promise<StockHistoryPoint[]> => {
  await delay(5000);
  const stock = MOCK_STOCKS.find(s => s.symbol === symbol);
  if (!stock) return [];

  const history: StockHistoryPoint[] = [];
  let currentClose = stock.price;
  const today = new Date();

  for (let i = 90; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const fluctuation = (Math.random() - 0.48) * (currentClose * 0.05); // More volatility
    const open = parseFloat(currentClose.toFixed(2));
    let close = parseFloat((open + fluctuation).toFixed(2));
    
    // Ensure close price doesn't drift too far from the last close
    if (i < 89) { // not the first day
      const prevClose = history[history.length -1].close;
      close = (close + prevClose) / 2;
    }

    const high = parseFloat(Math.max(open, close, open + Math.random() * (currentClose * 0.02)).toFixed(2));
    const low = parseFloat(Math.min(open, close, open - Math.random() * (currentClose * 0.02)).toFixed(2));
    
    currentClose = close; // The new close becomes the base for the next day's open

    history.push({
      date: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close
    });
  }

  // Make the last point the actual current price
  const lastPoint = history[history.length - 1];
  lastPoint.close = stock.price;
  lastPoint.high = Math.max(lastPoint.high, stock.price);
  lastPoint.low = Math.min(lastPoint.low, stock.price);


  return history;
};