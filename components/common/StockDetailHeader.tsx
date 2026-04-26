import React from "react";
import { Stock } from "../../types";
import { useStockQuote } from "../../hooks/useStockQuote";

export const StockDetailHeader: React.FC<{ stock: Stock }> = ({ stock }) => {
  const { quote, loading, error } = useStockQuote(stock.symbol);

  const price = quote?.price ?? stock.price;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;
  const arrow = isPositive ? "▲" : "▼";

  return (
    <div>
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold">
          {stock.name} ({stock.symbol})
        </h2>

        {/* Live / Simulated / Error indicator */}
        {!error &&
          !loading &&
          quote &&
          (quote.isMock ? (
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
          ))}
        {error && (
          <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
            Data unavailable
          </span>
        )}
      </div>

      {loading && !quote ? (
        /* Shimmer skeleton while first quote loads */
        <div className="mt-2 space-y-2 animate-pulse">
          <div className="h-9 w-36 bg-slate-700 rounded-md" />
          <div className="h-5 w-24 bg-slate-800 rounded-md" />
        </div>
      ) : (
        <>
          <div className="flex items-end space-x-4 mt-1">
            <p className="text-4xl font-bold font-mono text-foreground">
              ${price.toFixed(2)}
            </p>
            <div
              className={`text-xl font-semibold ${isPositive ? "text-positive" : "text-destructive"}`}
            >
              <span>
                {arrow} {isPositive ? "+" : ""}
                {change.toFixed(2)}
              </span>
              <span className="ml-2">
                ({isPositive ? "+" : ""}
                {changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>
          {quote?.volume != null && (
            <p className="text-xs text-muted-foreground mt-1">
              Vol: {quote.volume.toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  );
};
