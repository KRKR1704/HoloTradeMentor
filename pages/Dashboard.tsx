import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PortfolioItem } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

// Inject flash keyframes once
if (typeof document !== 'undefined' && !document.getElementById('dashboard-flash-style')) {
  const style = document.createElement('style');
  style.id = 'dashboard-flash-style';
  style.textContent = `
    @keyframes dash-flash-up {
      0%   { color: #34d399; }
      100% { color: inherit; }
    }
    @keyframes dash-flash-down {
      0%   { color: #f87171; }
      100% { color: inherit; }
    }
    .dash-flash-up   { animation: dash-flash-up   800ms ease-out forwards; }
    .dash-flash-down { animation: dash-flash-down 800ms ease-out forwards; }
  `;
  document.head.appendChild(style);
}

interface PortfolioItemWithData extends PortfolioItem {
  currentPrice: number;
  totalValue: number;
  totalPandL: number;
  totalPandLPct: number;
}

// ── Animated stat card ────────────────────────────────────────────────────────

const LiveStatCard: React.FC<{
  title: string;
  value: string;
  rawValue: number;
  className?: string;
}> = ({ title, value, rawValue, className }) => {
  const prevRef  = useRef<number | null>(null);
  const [flashClass, setFlashClass] = useState('');
  const [flashKey, setFlashKey]     = useState(0);
  const [updatedAt, setUpdatedAt]   = useState<Date | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (prev !== null && rawValue !== prev) {
      setFlashClass(rawValue > prev ? 'dash-flash-up' : 'dash-flash-down');
      setFlashKey(k => k + 1);
      setUpdatedAt(new Date());
    }
    prevRef.current = rawValue;
  }, [rawValue]);

  return (
    <div className="bg-card border border-slate-800 rounded-lg p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-muted-foreground text-sm">{title}</h3>
        {updatedAt && (
          <span className="text-[10px] text-slate-500">
            ↻ {updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
      <p key={flashKey} className={`text-2xl font-bold font-mono ${flashClass} ${className ?? ''}`}>
        {value}
      </p>
    </div>
  );
};

// ── Portfolio table ───────────────────────────────────────────────────────────

const PortfolioTable: React.FC<{ items: PortfolioItemWithData[] }> = ({ items }) => {
  const navigate = useNavigate();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="border-b border-slate-700 text-muted-foreground text-sm">
          <tr>
            <th className="p-3 font-medium">Symbol</th>
            <th className="p-3 font-medium">Shares</th>
            <th className="p-3 font-medium text-right">Current Price</th>
            <th className="p-3 font-medium text-right">Total Value</th>
            <th className="p-3 font-medium text-right">Total P/L</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const isPositive = item.totalPandL >= 0;
            return (
              <tr
                key={item.stock.symbol}
                className="border-b border-slate-800 last:border-b-0 hover:bg-secondary/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/trade/${item.stock.symbol}`)}
              >
                <td className="p-3">
                  <div className="font-bold">{item.stock.symbol}</div>
                  <div className="text-xs text-muted-foreground">{item.stock.name}</div>
                </td>
                <td className="p-3">{item.shares}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(item.currentPrice)}</td>
                <td className="p-3 text-right font-mono">{formatCurrency(item.totalValue)}</td>
                <td className={`p-3 text-right font-semibold font-mono ${isPositive ? 'text-positive' : 'text-destructive'}`}>
                  {formatCurrency(item.totalPandL)} ({item.totalPandLPct.toFixed(2)}%)
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, marketData } = state;

  const portfolioWithData = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.portfolio.map(item => {
      const currentPrice = marketData[item.stock.symbol] ?? item.stock.price;
      const totalValue   = currentPrice * item.shares;
      const totalCost    = item.avgCost * item.shares;
      const totalPandL   = totalValue - totalCost;
      const totalPandLPct = totalCost > 0 ? (totalPandL / totalCost) * 100 : 0;
      return { ...item, currentPrice, totalValue, totalPandL, totalPandLPct };
    });
  }, [currentUser?.portfolio, marketData]);

  const { portfolioValue, totalPandL } = useMemo(() => {
    if (!currentUser) return { portfolioValue: 0, totalPandL: 0 };
    const portfolioValue = portfolioWithData.reduce((acc, item) => acc + item.totalValue, 0);
    const totalCost      = currentUser.portfolio.reduce((acc, item) => acc + item.avgCost * item.shares, 0);
    return { portfolioValue, totalPandL: portfolioValue - totalCost };
  }, [portfolioWithData, currentUser?.portfolio]);

  if (!currentUser) return null;

  const totalAssets    = currentUser.balance + portfolioValue;
  const isPandLPositive = totalPandL >= 0;

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      {/* Header with LIVE badge */}
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {currentUser.portfolio.length > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 px-2.5 py-0.5 rounded-full">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            LIVE · 4s
          </span>
        )}
      </div>

      {/* Stat cards — flash when value changes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LiveStatCard title="Total Assets"     value={formatCurrency(totalAssets)}    rawValue={totalAssets} />
        <LiveStatCard title="Portfolio Value"  value={formatCurrency(portfolioValue)} rawValue={portfolioValue} />
        <LiveStatCard
          title="Total P/L"
          value={formatCurrency(totalPandL)}
          rawValue={totalPandL}
          className={isPandLPositive ? 'text-positive' : 'text-destructive'}
        />
      </div>

      {/* Holdings table */}
      <div className="bg-card border border-slate-800 rounded-lg p-4 sm:p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">My Holdings</h2>
        {currentUser.portfolio.length > 0 ? (
          <PortfolioTable items={portfolioWithData} />
        ) : (
          <p className="text-muted-foreground">
            You do not own any stocks yet. Go to the Trade page to get started!
          </p>
        )}
      </div>

      {/* Cash balance */}
      <div className="bg-card border border-slate-800 rounded-lg p-4 sm:p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Cash Balance</h2>
        <p className="text-2xl font-bold text-accent font-mono">{formatCurrency(currentUser.balance)}</p>
      </div>
    </div>
  );
};

export default Dashboard;
