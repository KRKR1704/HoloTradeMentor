import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppContext, executeTrade } from '../context/AppContext';
import { TradeType } from '../types';
import { CandlestickChart } from '../components/CandlestickChart';
import { HoloMentor } from '../components/HoloMentor';
import { TradeFeedbackModal } from '../components/common/TradeFeedbackModal';
import { useStockQuote, QuoteData } from '../hooks/useStockQuote';

type Interval = '5min' | '1day';

// ── Flash animation (injected once) ──────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('price-flash-style')) {
  const s = document.createElement('style');
  s.id = 'price-flash-style';
  s.textContent = `
    @keyframes price-flash-up   { 0%,100%{background:transparent} 20%{background:rgba(0,191,166,0.18)} }
    @keyframes price-flash-down { 0%,100%{background:transparent} 20%{background:rgba(239,68,68,0.18)} }
    .price-flash-up   { animation: price-flash-up   0.9s ease-out; border-radius:4px; }
    .price-flash-down { animation: price-flash-down 0.9s ease-out; border-radius:4px; }
  `;
  document.head.appendChild(s);
}

// ── Relative-time hook ────────────────────────────────────────────────────────
function useRelativeTime(date: Date | null): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!date) { setLabel(''); return; }

    const update = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10) setLabel('just now');
      else if (secs < 60) setLabel(`${secs}s ago`);
      else if (secs < 120) setLabel('1 min ago');
      else setLabel(`${Math.floor(secs / 60)} min ago`);
    };

    update();
    const t = setInterval(update, 10_000);
    return () => clearInterval(t);
  }, [date]);

  return label;
}

// ── Live Price Strip ──────────────────────────────────────────────────────────
const LivePriceStrip: React.FC<{
  symbol: string;
  quote: QuoteData | null;
  loading: boolean;
  error: string | null;
  updatedAt: Date | null;
}> = ({ symbol, quote, loading, error, updatedAt }) => {
  const prevPriceRef = useRef<number | null>(null);
  const [flashClass, setFlashClass] = useState('');
  // Incrementing key forces React to remount the element, restarting the CSS animation
  const [flashKey, setFlashKey] = useState(0);
  const relativeTime = useRelativeTime(updatedAt);

  useEffect(() => {
    if (!quote) return;
    const prev = prevPriceRef.current;
    prevPriceRef.current = quote.price;
    if (prev === null || prev === quote.price) return;

    const cls = quote.price > prev ? 'price-flash-up' : 'price-flash-down';
    setFlashClass(cls);
    setFlashKey((k) => k + 1);
    const t = setTimeout(() => setFlashClass(''), 950);
    return () => clearTimeout(t);
  }, [quote?.price]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <div className="space-y-1">
      {/* Name + symbol + status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-2xl font-bold">
          {quote?.name ?? symbol}
          <span className="text-muted-foreground font-mono text-xl ml-2">({symbol})</span>
        </h2>

        {!error && !loading && quote && (
          quote.isMock ? (
            <span className="text-xs text-amber-500 bg-amber-950/40 border border-amber-800/50 px-2 py-0.5 rounded-full">
              Simulated
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              LIVE
            </span>
          )
        )}

        {error && (
          <span className="text-xs text-amber-400 bg-amber-950/40 border border-amber-700/50 px-2 py-0.5 rounded-full">
            ⚠ Price data delayed
          </span>
        )}
      </div>

      {/* Price skeleton */}
      {loading && !quote ? (
        <div className="mt-2 space-y-2 animate-pulse">
          <div className="h-9 w-36 bg-slate-700 rounded-md" />
          <div className="h-5 w-24 bg-slate-800 rounded-md" />
        </div>
      ) : (
        <>
          <div className="flex items-end space-x-4 mt-1">
            {/* key causes remount so CSS animation restarts on each price tick */}
            <p key={flashKey} className={`text-4xl font-bold font-mono text-foreground px-1 ${flashClass}`}>
              ${(quote?.price ?? 0).toFixed(2)}
            </p>
            {quote && (
              <div className={`text-xl font-semibold ${isPositive ? 'text-positive' : 'text-destructive'}`}>
                <span>
                  {isPositive ? '▲' : '▼'} {isPositive ? '+' : ''}
                  {quote.change.toFixed(2)}
                </span>
                <span className="ml-2">
                  ({isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>

          {/* Volume + last updated */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            {quote?.volume != null && (
              <span>Vol: {quote.volume.toLocaleString()}</span>
            )}
            {relativeTime && (
              <span>Updated {relativeTime}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────
const StockDetailPage: React.FC = () => {
  const { symbol: rawSymbol } = useParams<{ symbol: string }>();
  // React Router v6 auto-decodes path params, so TCS%3ANSE → TCS:NSE
  const symbol = rawSymbol ?? '';
  const { state, dispatch } = useAppContext();
  const { currentUser, tradeFeedback, error: tradeError } = state;
  const [interval, setInterval] = useState<Interval>('1day');
  const [shares, setShares] = useState(1);
  const [isTrading, setIsTrading] = useState(false);

  const { quote, loading, error, updatedAt } = useStockQuote(symbol, 4_000);

  const userHolding = useMemo(
    () => currentUser?.portfolio.find((p) => p.stock.symbol === symbol),
    [currentUser, symbol]
  );

  const handleTrade = async (type: TradeType) => {
    if (!currentUser || !quote || isTrading) return;
    const stock = {
      symbol,
      name: quote.name ?? symbol,
      price: quote.price,
      open: quote.price - quote.change,
      previousClose: quote.price - quote.change,
    };
    setIsTrading(true);
    await executeTrade(dispatch, state, stock, shares, type);
    setIsTrading(false);
  };

  const totalCost = (quote?.price ?? 0) * shares;
  const canBuy = !!currentUser && !!quote && currentUser.balance >= totalCost && shares > 0;
  const canSell = !!userHolding && userHolding.shares >= shares && shares > 0;
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

  if (!symbol) {
    return <div className="container mx-auto p-4 text-muted-foreground">Stock not found.</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      {/* Header row: price strip + back button */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <LivePriceStrip
          symbol={symbol}
          quote={quote}
          loading={loading}
          error={error}
          updatedAt={updatedAt}
        />
        <div className="flex-shrink-0 w-full sm:w-auto mt-1">
          <Link
            to="/trade"
            className="flex items-center justify-center bg-secondary text-foreground font-bold py-3 px-6 rounded-lg hover:bg-secondary/80 transition border border-slate-700 w-full sm:w-auto"
          >
            ← Back to Trades
          </Link>
        </div>
      </div>

      {/* Portfolio position (if holding) */}
      {userHolding && (
        <div className="bg-card border border-slate-800 p-4 sm:p-6 rounded-lg">
          <h2 className="text-xl font-bold mb-2">Your Position</h2>
          <p className="text-muted-foreground">
            You own {userHolding.shares} shares with an average cost of $
            {userHolding.avgCost.toFixed(2)}.
          </p>
        </div>
      )}

      {/* Trade panel */}
      <div className="bg-card border border-slate-800 p-4 sm:p-6 rounded-lg">
        <h2 className="text-xl font-bold mb-4">Trade {symbol}</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Shares
            </label>
            <input
              type="number"
              min={1}
              value={shares}
              onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-28 bg-secondary border border-slate-700 rounded-lg px-3 py-2 text-foreground font-mono text-sm focus:ring-2 focus:ring-primary focus:border-primary transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Estimated Total
            </span>
            <span className="text-sm font-semibold font-mono text-foreground py-2">
              {quote ? fmt(totalCost) : '—'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Cash Balance
            </span>
            <span className="text-sm font-semibold font-mono text-foreground py-2">
              {currentUser ? fmt(currentUser.balance) : '—'}
            </span>
          </div>

          <div className="flex gap-3 sm:ml-auto">
            <button
              onClick={() => handleTrade(TradeType.BUY)}
              disabled={!canBuy || isTrading}
              className="px-6 py-2 bg-positive text-white font-bold rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed min-w-[80px]"
            >
              {isTrading ? '…' : 'Buy'}
            </button>
            <button
              onClick={() => handleTrade(TradeType.SELL)}
              disabled={!canSell || isTrading}
              className="px-6 py-2 bg-destructive text-white font-bold rounded-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed min-w-[80px]"
            >
              {isTrading ? '…' : 'Sell'}
            </button>
          </div>
        </div>

        {tradeError && (
          <p className="mt-3 text-sm text-destructive">{tradeError}</p>
        )}
      </div>

      {/* Two-panel: Chart + Holo */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">
        <CandlestickChart
          symbol={symbol}
          interval={interval}
          onIntervalChange={setInterval}
        />
        <HoloMentor
          symbol={symbol}
          interval={interval}
          liveChangePercent={quote?.changePercent}
        />
      </div>

      {tradeFeedback && (
        <TradeFeedbackModal
          feedbackContext={tradeFeedback}
          onClose={() => dispatch({ type: 'CLOSE_TRADE_FEEDBACK' })}
        />
      )}
    </div>
  );
};

export default StockDetailPage;
