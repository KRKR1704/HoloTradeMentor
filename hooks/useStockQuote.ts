import { useState, useEffect } from 'react';

const BACKEND = 'http://localhost:8000';
const POLL_INTERVAL_MS = 30_000;

export interface QuoteData {
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  isMock: boolean;
  name?: string;
}

interface UseStockQuoteResult {
  quote: QuoteData | null;
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
}

export function useStockQuote(symbol: string): UseStockQuoteResult {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!symbol) return;

    let cancelled = false;

    const fetchQuote = async () => {
      try {
        const res = await fetch(`${BACKEND}/api/quote/${encodeURIComponent(symbol)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) {
          setQuote({
            price: parseFloat(data.price),
            change: parseFloat(data.change),
            changePercent: parseFloat(data.change_percent),
            volume: parseInt(data.volume, 10),
            isMock: data.is_mock === true,
            name: data.name ?? undefined,
          });
          setUpdatedAt(new Date());
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to fetch quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setQuote(null);
    setError(null);
    setLoading(true);
    setUpdatedAt(null);

    fetchQuote();
    const id = setInterval(fetchQuote, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  return { quote, loading, error, updatedAt };
}
