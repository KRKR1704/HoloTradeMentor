import { NewsArticle } from '../types';

const BACKEND = 'http://localhost:8000';

export const getMarketNews = async (): Promise<NewsArticle[]> => {
  const res = await fetch(`${BACKEND}/api/news`);
  if (!res.ok) throw new Error(`News fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<NewsArticle[]>;
};

export const getStockNews = async (symbol: string): Promise<NewsArticle[]> => {
  const res = await fetch(`${BACKEND}/api/news/${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error(`Stock news fetch failed: HTTP ${res.status}`);
  return res.json() as Promise<NewsArticle[]>;
};
