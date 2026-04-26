import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { PortfolioItem } from '../types';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

interface PortfolioItemWithData extends PortfolioItem {
    currentPrice: number;
    totalValue: number;
    totalPandL: number;
    totalPandLPct: number;
}

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-card border border-slate-800 rounded-lg p-4 sm:p-6 shadow-sm ${className}`}>
        {children}
    </div>
);

const StatCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className }) => (
    <Card>
        <h3 className="text-muted-foreground text-sm">{title}</h3>
        <p className={`text-2xl font-bold font-mono ${className}`}>{value}</p>
    </Card>
);

const PortfolioTable: React.FC<{ items: PortfolioItemWithData[] }> = ({ items }) => {
  const navigate = useNavigate();

  const handleRowClick = (symbol: string) => {
    navigate(`/stock/${symbol}`);
  };

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
                onClick={() => handleRowClick(item.stock.symbol)}
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


const Dashboard: React.FC = () => {
  const { state } = useAppContext();
  const { currentUser, marketData } = state;

  const portfolioWithData = useMemo(() => {
    if (!currentUser) return [];
    return currentUser.portfolio.map(item => {
        const currentPrice = marketData[item.stock.symbol] || item.stock.price;
        const totalValue = currentPrice * item.shares;
        const totalCost = item.avgCost * item.shares;
        const totalPandL = totalValue - totalCost;
        const totalPandLPct = totalCost > 0 ? (totalPandL / totalCost) * 100 : 0;
        return {
            ...item,
            currentPrice,
            totalValue,
            totalPandL,
            totalPandLPct,
        };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.portfolio, marketData]);
  
  const { portfolioValue, totalPandL } = useMemo(() => {
      if (!currentUser) return { portfolioValue: 0, totalPandL: 0};
      const portfolioValue = portfolioWithData.reduce((acc, item) => acc + item.totalValue, 0);
      const totalCost = currentUser.portfolio.reduce((acc, item) => acc + item.avgCost * item.shares, 0);
      const totalPandL = portfolioValue - totalCost;
      return { portfolioValue, totalPandL };
  }, [portfolioWithData, currentUser?.portfolio]);
  
  if (!currentUser) {
      return null; // or a loading spinner, though routing should prevent this state
  }
  
  const totalAssets = currentUser.balance + portfolioValue;
  const isPandLPositive = totalPandL >= 0;

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Assets" value={formatCurrency(totalAssets)} />
        <StatCard title="Portfolio Value" value={formatCurrency(portfolioValue)} />
        <StatCard title="Total P/L" value={formatCurrency(totalPandL)} className={isPandLPositive ? 'text-positive' : 'text-destructive'}/>
      </div>
      
      <Card>
        <h2 className="text-xl font-bold mb-4">My Holdings</h2>
        {currentUser.portfolio.length > 0 ? (
          <PortfolioTable items={portfolioWithData} />
        ) : (
          <p className="text-muted-foreground">You do not own any stocks yet. Go to the Trade page to get started!</p>
        )}
      </Card>

       <Card>
            <h2 className="text-xl font-bold mb-4">Cash Balance</h2>
            <p className="text-2xl font-bold text-accent font-mono">{formatCurrency(currentUser.balance)}</p>
        </Card>
    </div>
  );
};

export default Dashboard;