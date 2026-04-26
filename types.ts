// FIX: Removed a self-referential import of the `Stock` type.

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  open: number;
  previousClose: number;
}

export interface StockHistoryPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PortfolioItem {
  stock: Stock;
  shares: number;
  avgCost: number;
}

export enum TradeType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export interface Trade {
  stock: Stock;
  shares: number;
  price: number;
  type: TradeType;
  timestamp: number;
}

export interface Lesson {
  id: string;
  title: string;
  content: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // For handling registration/login, not stored in state
  balance: number;
  portfolio: PortfolioItem[];
  tradeHistory: Trade[];
  lessonProgress: string[]; // array of lesson ids
}

export interface NewsArticle {
  headline: string;
  summary: string;
  source: string;
  relevance?: string;  // general market news
  impact?: string;     // stock-specific news
  sentiment: 'positive' | 'negative' | 'neutral';
}

export type MarketData = Record<string, number>; // Maps symbol to price