import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStockQuote } from '../hooks/useStockQuote';

const BACKEND = 'http://localhost:8000';

const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
];

const INDIA_EXCHANGES = new Set(['NSE', 'BSE']);

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

type SearchState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

// ── Popular stock card ────────────────────────────────────────────────────────

const PopularStockCard: React.FC<{ symbol: string; name: string; onClick: () => void }> = ({
  symbol,
  name,
  onClick,
}) => {
  const { quote, loading, error } = useStockQuote(symbol);
  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <div
      onClick={onClick}
      className="bg-card border border-slate-800 p-4 rounded-lg cursor-pointer hover:border-primary transition-all duration-200 hover:scale-[1.02]"
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-lg">{symbol}</p>
            {!error && !loading && (
              <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            )}
            {error && (
              <span className="text-[10px] text-slate-500 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded-full">
                unavailable
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate w-36 sm:w-48">{name}</p>
        </div>

        <div className="text-right flex-shrink-0 ml-4">
          {loading && !quote ? (
            <div className="space-y-1.5">
              <div className="h-5 w-20 bg-slate-700 rounded animate-pulse ml-auto" />
              <div className="h-4 w-14 bg-slate-800 rounded animate-pulse ml-auto" />
            </div>
          ) : quote ? (
            <>
              <p className="font-semibold text-lg font-mono text-foreground">
                ${quote.price.toFixed(2)}
              </p>
              <p className={`text-sm font-medium ${isPositive ? 'text-positive' : 'text-destructive'}`}>
                {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Trade page ────────────────────────────────────────────────────────────────

const Trade: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchState('idle');
      return;
    }
    setSearchState('loading');
    try {
      const res = await fetch(`${BACKEND}/api/search?query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('bad status');
      const data: SearchResult[] = await res.json();
      setSearchResults(data);
      setSearchState(data.length > 0 ? 'results' : 'empty');
    } catch {
      setSearchState('error');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const handleSelect = (symbol: string) => {
    setSearchQuery('');
    setSearchState('idle');
    navigate(`/trade/${encodeURIComponent(symbol)}`);
  };

  const showDropdown = searchQuery.trim().length > 0 && searchState !== 'idle';

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6">
      <h1 className="text-3xl font-bold">Trade</h1>

      {/* Search bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stocks by name or symbol (e.g. AAPL, TCS)"
          className="w-full bg-card border border-slate-800 rounded-lg px-4 py-3 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition"
        />

        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-card border border-slate-800 rounded-lg shadow-xl overflow-hidden">
            {searchState === 'loading' && (
              <div className="px-4 py-3 text-sm text-muted-foreground animate-pulse">Searching…</div>
            )}
            {searchState === 'empty' && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                No stocks found for &ldquo;{searchQuery}&rdquo;
              </div>
            )}
            {searchState === 'error' && (
              <div className="px-4 py-3 text-sm text-destructive">
                Search unavailable — try again
              </div>
            )}
            {searchState === 'results' &&
              searchResults.map((r) => {
                const isIndia = INDIA_EXCHANGES.has(r.exchange?.toUpperCase());
                return (
                  <div
                    key={`${r.symbol}-${r.exchange}`}
                    onClick={() => handleSelect(r.symbol)}
                    className="px-4 py-3 cursor-pointer hover:bg-secondary flex items-center justify-between gap-3 border-b border-slate-800 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono">{r.symbol}</span>
                        {isIndia && <span className="text-xs">🇮🇳 India</span>}
                        {r.type && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded">
                            {r.type}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{r.name}</p>
                    </div>
                    {r.exchange && (
                      <span className="text-xs text-slate-500 flex-shrink-0">{r.exchange}</span>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Popular stocks (shown when search bar is empty) */}
      {!searchQuery.trim() && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-xl font-bold">Popular Stocks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {POPULAR_STOCKS.map(({ symbol, name }) => (
              <PopularStockCard
                key={symbol}
                symbol={symbol}
                name={name}
                onClick={() => navigate(`/trade/${symbol}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Trade;
