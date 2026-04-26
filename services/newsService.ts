import { NewsArticle } from '../types';

const BACKEND = 'http://localhost:8000';

export const getMarketNews = async (): Promise<NewsArticle[]> => {
  const res = await fetch(`${BACKEND}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'general' }),
  });
  if (!res.ok) throw new Error(`News fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  // Handle error shape from backend: { error: string, articles: [] }
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  return Array.isArray(data) ? data : [];
};

export const getStockNews = async (symbol: string, name = ''): Promise<NewsArticle[]> => {
  const res = await fetch(`${BACKEND}/api/news/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, name }),
  });
  if (!res.ok) throw new Error(`Stock news fetch failed: HTTP ${res.status}`);
  const data = await res.json();
  if (data && !Array.isArray(data) && data.error) throw new Error(data.error);
  return Array.isArray(data) ? data : [];
};

export const clearNewsCache = async (): Promise<void> => {
  await fetch(`${BACKEND}/api/news/cache`, { method: 'DELETE' });
};
