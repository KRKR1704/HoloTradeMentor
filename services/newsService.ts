import { NewsArticle } from '../types';

const BACKEND = 'http://localhost:8000';

export const getMarketNews = async (): Promise<NewsArticle[]> => {
  const res = await fetch(`${BACKEND}/api/news`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'general' }),
  });

  // Try to parse JSON body even on non-OK so backend can return fallback articles
  let data: any = null;
  try {
    data = await res.json();
  } catch (e) {
    // ignore parse errors
  }

  if (!res.ok) {
    // If backend provided an articles array despite non-OK, return it as a graceful fallback
    if (data && Array.isArray(data.articles)) return data.articles as NewsArticle[];
    throw new Error(`News fetch failed: HTTP ${res.status}`);
  }

  // Backend may respond with either an array OR an object { error, articles }
  if (data && !Array.isArray(data) && data.error) {
    if (Array.isArray(data.articles)) return data.articles as NewsArticle[];
    throw new Error(data.error);
  }

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
