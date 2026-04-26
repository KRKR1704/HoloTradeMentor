import React, { useEffect, useState } from 'react';
import { Trade, User } from '../../types';
import { streamAI, getTradeFeedbackPrompt } from '../../services/aiService';

interface Props {
  feedbackContext: { trade: Trade; userBeforeTrade: User };
  onClose: () => void;
}

export const TradeFeedbackModal: React.FC<Props> = ({ feedbackContext, onClose }) => {
  const { trade, userBeforeTrade } = feedbackContext;
  const [holoResponse, setHoloResponse] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const prompt = getTradeFeedbackPrompt(trade, userBeforeTrade);
    setHoloResponse('');
    setLoading(true);

    streamAI(
      prompt,
      (_chunk, full) => {
        setHoloResponse(full);
        setLoading(false); // show text as soon as first chunk arrives
      },
    ).then(() => {
      setLoading(false);
    });
  }, [trade, userBeforeTrade]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const isBuy = trade.type === 'BUY';
  const totalValue = trade.price * trade.shares;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-slate-700 rounded-xl max-w-md w-full shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-900/50 border border-teal-700 flex items-center justify-center text-lg">
              {isBuy ? '📈' : '📉'}
            </div>
            <div>
              <p className="font-bold text-white">{isBuy ? 'Buy' : 'Sell'} Order Executed</p>
              <p className="text-xs text-slate-400">
                {trade.shares} × {trade.stock.symbol} @ {fmt(trade.price)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1 text-lg">
            ✕
          </button>
        </div>

        {/* Trade summary */}
        <div className="px-5 py-3 bg-slate-800/40 border-b border-slate-800">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total {isBuy ? 'Cost' : 'Proceeds'}</span>
            <span className={`font-semibold ${isBuy ? 'text-destructive' : 'text-positive'}`}>
              {isBuy ? '-' : '+'}{fmt(totalValue)}
            </span>
          </div>
        </div>

        {/* Holo's feedback */}
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-6 h-6 rounded-full flex-shrink-0"
              style={{ background: 'radial-gradient(circle at 35% 35%, #00e5cc, #006e7f 55%, #0D1B2A)' }}
            />
            <span className="text-xs font-bold text-teal-400 tracking-wide uppercase">
              Holo's Take
            </span>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-slate-700 rounded w-full" />
              <div className="h-3 bg-slate-700 rounded w-5/6" />
              <div className="h-3 bg-slate-700 rounded w-4/6" />
            </div>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed">
              {holoResponse}
              {/* blinking cursor while streaming */}
              {holoResponse && holoResponse.length < 350 && (
                <span className="inline-block w-1.5 h-3.5 bg-teal-400 ml-0.5 align-middle animate-pulse rounded-sm" />
              )}
            </p>
          )}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-semibold rounded-lg transition text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
