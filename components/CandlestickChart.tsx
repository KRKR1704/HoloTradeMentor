import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  CrosshairMode,
  ColorType,
  Time,
} from 'lightweight-charts';
import { GlossaryTooltip } from './GlossaryTooltip';

// Pre-computed so heights are stable across renders (no random on each paint)
const SKELETON_HEIGHTS = [42, 61, 38, 75, 55, 80, 48, 66, 35, 72, 58, 45, 68, 40, 77, 53, 63, 44, 70, 50];

// Inject shimmer keyframe once
if (typeof document !== 'undefined' && !document.getElementById('chart-shimmer-style')) {
  const s = document.createElement('style');
  s.id = 'chart-shimmer-style';
  s.textContent = `@keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(300%); } }`;
  document.head.appendChild(s);
}

const FIVE_MIN_REFRESH_MS = 5 * 60 * 1000;

type Interval = '5min' | '1day';

interface CandlestickChartProps {
  symbol: string;
  interval?: Interval;
  onIntervalChange?: (interval: Interval) => void;
}

interface TooltipData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  x: number;
  y: number;
  visible: boolean;
}

const BACKEND = 'http://localhost:8000';

function parseTime(timeStr: string, interval: Interval): Time {
  if (interval === '1day') {
    return timeStr.split(' ')[0] as Time;
  }
  return Math.floor(new Date(timeStr.replace(' ', 'T')).getTime() / 1000) as unknown as Time;
}

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

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  symbol,
  interval: controlledInterval,
  onIntervalChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  const [internalInterval, setInternalInterval] = useState<Interval>('1day');
  const interval = controlledInterval ?? internalInterval;

  const handleIntervalChange = (iv: Interval) => {
    if (onIntervalChange) onIntervalChange(iv);
    else setInternalInterval(iv);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const lastUpdatedLabel = useRelativeTime(lastFetchedAt);

  // Initialise chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0D1B2A' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.08)' },
        horzLines: { color: 'rgba(148,163,184,0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: 'rgba(148,163,184,0.15)',
      },
      timeScale: {
        borderColor: 'rgba(148,163,184,0.15)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: 380,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00BFA6',
      downColor: '#ef4444',
      borderUpColor: '#00BFA6',
      borderDownColor: '#ef4444',
      wickUpColor: '#00BFA6',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || !param.time || !containerRef.current) {
        setTooltip(null);
        return;
      }
      const candle = param.seriesData.get(series) as CandlestickData | undefined;
      if (!candle) {
        setTooltip(null);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const x = param.point.x;
      const y = param.point.y;
      const flipX = x > rect.width - 160;
      const flipY = y > rect.height - 120;

      setTooltip({
        time: String(param.time),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        x: flipX ? x - 156 : x + 12,
        y: flipY ? y - 108 : y + 12,
        visible: true,
      });
    });

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        chart.applyOptions({ width: entries[0].contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch candles. silent=true skips the loading skeleton (used for auto-refresh).
  const fetchCandles = useCallback(async (silent = false) => {
    if (!seriesRef.current) return;

    if (!silent) {
      setIsLoading(true);
      setError(null);
      setTooltip(null);
    }

    try {
      const res = await fetch(
        `${BACKEND}/api/candles/${encodeURIComponent(symbol)}?interval=${interval}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const candles: CandlestickData[] = json.candles.map((c: any) => ({
        time: parseTime(c.time, interval),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      if (silent && candles.length > 0) {
        // Silent refresh: update/append the last candle without resetting the view
        seriesRef.current.update(candles[candles.length - 1]);
      } else {
        seriesRef.current.setData(candles);
        chartRef.current?.timeScale().fitContent();
      }

      setError(null);
      setLastFetchedAt(new Date());
    } catch (e: any) {
      setError(e.message ?? 'Failed to load chart data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [symbol, interval]);

  // Full reload on symbol/interval change
  useEffect(() => {
    fetchCandles(false);
  }, [fetchCandles]);

  // Auto-refresh for 5min intraday: append new candle every 5 minutes silently
  useEffect(() => {
    if (interval !== '5min') return;
    const id = setInterval(() => fetchCandles(true), FIVE_MIN_REFRESH_MS);
    return () => clearInterval(id);
  }, [interval, fetchCandles]);

  const isBullish = tooltip ? tooltip.close >= tooltip.open : false;

  return (
    <div className="rounded-xl overflow-hidden border border-slate-800 bg-[#0D1B2A]">
      {/* Interval toggle + chart label badges */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
        <span className="text-xs text-slate-400 mr-1 font-medium">Interval</span>
        {(['5min', '1day'] as Interval[]).map((iv) => (
          <button
            key={iv}
            onClick={() => handleIntervalChange(iv)}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              interval === iv
                ? 'bg-[#00BFA6] text-[#0D1B2A]'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {iv === '5min' ? '5 Min' : '1 Day'}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-mono px-2 py-0.5 rounded border border-slate-700">
            <GlossaryTooltip term="OHLC">OHLC</GlossaryTooltip>
          </span>
          <span className="text-[11px] text-slate-500 font-mono px-2 py-0.5 rounded border border-slate-700">
            <GlossaryTooltip term="Volume">Vol</GlossaryTooltip>
          </span>
          <span className="text-[11px] text-slate-500 font-mono px-2 py-0.5 rounded border border-slate-700">
            <GlossaryTooltip term="Candlestick">Candle</GlossaryTooltip>
          </span>
        </div>
      </div>

      {/* Chart area */}
      <div className="relative">
        <div ref={containerRef} className="w-full" />

        {/* Loading shimmer skeleton */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col justify-end bg-[#0D1B2A] z-10 px-6 pb-8 pt-4 gap-4">
            <div className="flex items-end gap-1.5 flex-1">
              {SKELETON_HEIGHTS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm relative overflow-hidden bg-slate-800"
                  style={{ height: `${h}%` }}
                >
                  <div
                    className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite]"
                    style={{
                      background:
                        'linear-gradient(90deg, transparent 0%, rgba(0,191,166,0.08) 50%, transparent 100%)',
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="text-slate-600 text-xs text-center">Loading chart data…</p>
          </div>
        )}

        {/* Error state with retry */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1B2A] z-10 gap-3">
            <div className="flex items-center gap-2 text-amber-400">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm font-medium">Chart temporarily unavailable — retrying…</p>
            </div>
            <p className="text-slate-500 text-xs">{error}</p>
            <button
              onClick={() => fetchCandles(false)}
              className="mt-1 px-4 py-1.5 rounded bg-slate-700 text-slate-200 text-xs hover:bg-slate-600 transition"
            >
              Retry now
            </button>
          </div>
        )}

        {/* OHLC crosshair tooltip */}
        {tooltip && !isLoading && (
          <div
            className="absolute pointer-events-none z-20 rounded-lg border border-slate-700 bg-[#0D1B2A]/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl min-w-[140px]"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="text-slate-400 mb-1 font-medium truncate">{tooltip.time}</p>
            <div className="space-y-0.5">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">O</span>
                <span className="font-mono text-slate-200">${tooltip.open.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">H</span>
                <span className="font-mono text-[#00BFA6]">${tooltip.high.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">L</span>
                <span className="font-mono text-red-400">${tooltip.low.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">C</span>
                <span className={`font-mono font-bold ${isBullish ? 'text-[#00BFA6]' : 'text-red-400'}`}>
                  ${tooltip.close.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Last updated footer */}
      {lastUpdatedLabel && !isLoading && (
        <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-600">
            Last updated: {lastUpdatedLabel}
          </span>
          {interval === '5min' && (
            <span className="text-[11px] text-slate-700">Auto-refreshes every 5 min</span>
          )}
        </div>
      )}
    </div>
  );
};
