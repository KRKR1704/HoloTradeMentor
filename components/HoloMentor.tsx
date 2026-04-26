import React, { useState, useEffect, useRef, useCallback } from 'react';
import { parseGlossaryTerms } from '../utils/parseGlossaryTerms';

const BACKEND = 'http://localhost:8000';
const MAX_HISTORY = 20;
const SIGNIFICANT_MOVE_THRESHOLD = 1.0; // percent

type Interval = '5min' | '1day';

interface Message {
  id: string;
  role: 'holo' | 'user';
  content: string;
  streaming?: boolean;
  label?: string;
  timestamp: Date;
  isError?: boolean;
}

interface HoloMentorProps {
  symbol: string;
  interval: Interval;
  liveChangePercent?: number;
}

const QUICK_QUESTIONS = [
  'What is volatility?',
  'Explain this candle',
  'Is this stock risky?',
  'What does volume mean?',
];

function uid() {
  return Math.random().toString(36).slice(2);
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function fetchOhlcSummary(symbol: string, interval: Interval): Promise<string> {
  try {
    const res = await fetch(
      `${BACKEND}/api/candles/${encodeURIComponent(symbol)}?interval=${interval}`
    );
    if (!res.ok) return `Symbol: ${symbol}, Interval: ${interval} (chart data unavailable)`;
    const json = await res.json();
    const candles: any[] = json.candles ?? [];
    const last5 = candles.slice(-5);
    if (!last5.length) return `Symbol: ${symbol}, no recent candle data`;
    const rows = last5
      .map(
        (c) =>
          `${c.time}  O:$${Number(c.open).toFixed(2)} H:$${Number(c.high).toFixed(2)} L:$${Number(c.low).toFixed(2)} C:$${Number(c.close).toFixed(2)}`
      )
      .join('\n');
    return `Last 5 candles for ${symbol} (${interval}):\n${rows}`;
  } catch {
    return `Symbol: ${symbol}, Interval: ${interval}`;
  }
}

async function* streamText(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
}

// ── CSS animations (injected once) ───────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes holo-glow-idle {
    0%, 100% { box-shadow: 0 0 10px 2px #00BFA655, 0 0 24px 4px #0d4f6044; }
    50%       { box-shadow: 0 0 20px 6px #00BFA688, 0 0 40px 10px #00BFA633; }
  }
  @keyframes holo-glow-think {
    0%, 100% { box-shadow: 0 0 18px 6px #00BFA6aa, 0 0 48px 14px #00BFA655; }
    50%       { box-shadow: 0 0 32px 12px #00BFA6ee, 0 0 70px 22px #00BFA688; }
  }
  @keyframes holo-ring-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes holo-ring-fast { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes holo-inner-spin {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes holo-ring2 { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }

  .holo-orb-idle   { animation: holo-glow-idle 3s ease-in-out infinite; }
  .holo-orb-think  { animation: holo-glow-think 0.9s ease-in-out infinite; }
  .holo-ring-slow  { animation: holo-ring-slow 7s linear infinite; }
  .holo-ring-fast  { animation: holo-ring-fast 1.4s linear infinite; }
  .holo-ring2      { animation: holo-ring2 10s linear infinite; }

  @keyframes bounce-dot {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
    40%            { transform: translateY(-5px); opacity: 1; }
  }
  .bdot1 { animation: bounce-dot 1.2s ease-in-out infinite; }
  .bdot2 { animation: bounce-dot 1.2s ease-in-out 0.2s infinite; }
  .bdot3 { animation: bounce-dot 1.2s ease-in-out 0.4s infinite; }
`;

// ── Small orb ────────────────────────────────────────────────────────────────
const MiniOrb: React.FC = () => (
  <div
    className="holo-orb-idle flex-shrink-0 w-7 h-7 rounded-full relative overflow-hidden"
    style={{ background: 'radial-gradient(circle at 35% 35%, #00e5cc, #006e7f 55%, #0D1B2A)' }}
  >
    <div
      className="holo-ring-slow absolute inset-0 rounded-full border border-dashed opacity-25"
      style={{ borderColor: '#00BFA6' }}
    />
  </div>
);

// ── User icon ────────────────────────────────────────────────────────────────
const UserIcon: React.FC = () => (
  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center">
    <svg className="w-4 h-4 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  </div>
);

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
  <div className="flex items-center gap-1 px-1 py-1">
    <span className="bdot1 w-2 h-2 rounded-full bg-teal-400 inline-block" />
    <span className="bdot2 w-2 h-2 rounded-full bg-teal-400 inline-block" />
    <span className="bdot3 w-2 h-2 rounded-full bg-teal-400 inline-block" />
  </div>
);

// ── Chat bubble ───────────────────────────────────────────────────────────────
const ChatBubble: React.FC<{ msg: Message; onRetry?: () => void }> = ({ msg, onRetry }) => {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end items-end gap-2">
        <div className="flex flex-col items-end max-w-[78%]">
          <div className="bg-white text-slate-900 rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            {msg.content}
          </div>
          <span className="text-[10px] text-slate-600 mt-1 mr-1">{formatTime(msg.timestamp)}</span>
        </div>
        <UserIcon />
      </div>
    );
  }

  // Error bubble
  if (msg.isError) {
    return (
      <div className="flex items-end gap-2">
        <MiniOrb />
        <div className="flex flex-col items-start max-w-[84%]">
          <div
            className="rounded-2xl rounded-bl-sm px-4 py-3 text-sm shadow-sm space-y-2"
            style={{
              background: 'linear-gradient(135deg, #2d0f0f 0%, #1a0a0a 100%)',
              border: '1px solid #ef444433',
            }}
          >
            <p className="text-red-400 font-medium">⚠ Holo is unavailable right now.</p>
            <p className="text-slate-400 text-xs">Check that the backend is running, then try again.</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-teal-400 border border-teal-800 px-3 py-1 rounded-lg hover:bg-teal-900/30 transition"
              >
                Try again
              </button>
            )}
          </div>
          <span className="text-[10px] text-slate-600 mt-1 ml-1">{formatTime(msg.timestamp)}</span>
        </div>
      </div>
    );
  }

  // Normal Holo bubble
  return (
    <div className="flex items-end gap-2">
      <MiniOrb />
      <div className="flex flex-col items-start max-w-[84%]">
        {msg.label && (
          <span className="text-[10px] text-teal-400 font-semibold mb-1 ml-1 tracking-wide">
            {msg.label}
          </span>
        )}
        <div
          className="rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed text-slate-100 shadow-sm"
          style={{
            background: 'linear-gradient(135deg, #0d3d4f 0%, #0f2535 100%)',
            border: '1px solid #00BFA622',
          }}
        >
          {msg.streaming && !msg.content ? (
            <TypingDots />
          ) : (
            <>
              <span className="whitespace-pre-wrap">
                {msg.streaming ? msg.content : parseGlossaryTerms(msg.content)}
              </span>
              {msg.streaming && (
                <span className="inline-block w-1.5 h-3.5 bg-teal-400 ml-0.5 align-middle animate-pulse rounded-sm" />
              )}
            </>
          )}
        </div>
        {!msg.streaming && (
          <span className="text-[10px] text-slate-600 mt-1 ml-1">{formatTime(msg.timestamp)}</span>
        )}
      </div>
    </div>
  );
};

// ── Header orb ───────────────────────────────────────────────────────────────
const HeaderOrb: React.FC<{ isThinking?: boolean }> = ({ isThinking = false }) => (
  <div className="flex flex-col items-center gap-1 flex-shrink-0">
    <div
      className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
        isThinking ? 'holo-orb-think' : 'holo-orb-idle'
      }`}
      style={{
        background: 'radial-gradient(circle at 35% 35%, #00e5cc 0%, #007a8a 45%, #0D1B2A 100%)',
      }}
    >
      <div
        className={`absolute inset-[-3px] rounded-full border-2 border-dashed opacity-50 ${
          isThinking ? 'holo-ring-fast' : 'holo-ring-slow'
        }`}
        style={{ borderColor: '#00BFA6' }}
      />
      <div
        className="holo-ring2 absolute inset-[2px] rounded-full border border-dotted opacity-20"
        style={{ borderColor: '#7ff8eb' }}
      />
      <div
        className="absolute rounded-full opacity-50"
        style={{
          width: '32%', height: '26%', top: '16%', left: '20%',
          background: 'radial-gradient(circle, #ffffffbb, transparent)',
        }}
      />
      {isThinking && (
        <div
          className="absolute inset-0 rounded-full animate-ping opacity-20"
          style={{ background: '#00BFA6' }}
        />
      )}
    </div>
    <span
      className="text-[9px] font-bold tracking-[0.2em] uppercase transition-colors"
      style={{ color: isThinking ? '#00e5cc' : '#00BFA6' }}
    >
      {isThinking ? 'THINKING' : 'HOLO'}
    </span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
export const HoloMentor: React.FC<HoloMentorProps> = ({
  symbol,
  interval,
  liveChangePercent,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [explainKey, setExplainKey] = useState(0);

  // Significant-move detection: track the changePercent at which we last auto-alerted
  const lastAlertedChangeRef = useRef<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stylesInjected = useRef(false);

  useEffect(() => {
    if (stylesInjected.current) return;
    const el = document.createElement('style');
    el.textContent = GLOBAL_STYLES;
    document.head.appendChild(el);
    stylesInjected.current = true;
  }, []);

  // Reset move tracking when symbol changes
  useEffect(() => {
    lastAlertedChangeRef.current = null;
  }, [symbol]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const streamIntoNewBubble = useCallback(
    async (url: string, body: object, label?: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const id = uid();
      const now = new Date();

      setMessages((prev) => [
        ...prev,
        { id, role: 'holo', content: '', streaming: true, label, timestamp: now },
      ]);
      setIsBusy(true);
      scrollToBottom();

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    content: err.detail ?? 'Request failed',
                    streaming: false,
                    isError: true,
                  }
                : m
            )
          );
          return;
        }

        let accumulated = '';
        for await (const chunk of streamText(res)) {
          if (controller.signal.aborted) break;
          accumulated += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, content: accumulated } : m))
          );
          scrollToBottom();
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, streaming: false } : m))
        );
        scrollToBottom();
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? { ...m, content: 'Connection error', streaming: false, isError: true }
                : m
            )
          );
        }
      } finally {
        setIsBusy(false);
      }
    },
    [scrollToBottom]
  );

  // Auto-explain on symbol / interval change, or after Clear Chat
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const autoExplain = async () => {
      const ohlcSummary = await fetchOhlcSummary(symbol, interval);
      if (cancelled) return;
      await streamIntoNewBubble(
        `${BACKEND}/api/mentor/explain`,
        { symbol, interval, ohlc_summary: ohlcSummary, question: null },
        '📊 Chart Analysis'
      );
    };

    autoExplain();
    return () => { cancelled = true; };
    // explainKey is intentionally included — it re-fires after Clear Chat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, explainKey]);

  // Significant price-move detection: fires at most once per 1% crossing
  useEffect(() => {
    if (liveChangePercent == null) return;

    if (lastAlertedChangeRef.current === null) {
      // First reading — record baseline, no alert
      lastAlertedChangeRef.current = liveChangePercent;
      return;
    }

    const delta = Math.abs(liveChangePercent - lastAlertedChangeRef.current);
    if (delta < SIGNIFICANT_MOVE_THRESHOLD || isBusy) return;

    // Record new baseline before firing so we don't double-trigger
    const prevChange = lastAlertedChangeRef.current;
    lastAlertedChangeRef.current = liveChangePercent;

    const direction = liveChangePercent > prevChange ? 'up' : 'down';
    const magnitude = delta.toFixed(2);

    fetchOhlcSummary(symbol, interval).then((ohlcSummary) => {
      streamIntoNewBubble(
        `${BACKEND}/api/mentor/explain`,
        {
          symbol,
          interval,
          ohlc_summary: ohlcSummary,
          question: `The price just moved ${direction} by ${magnitude}% since my last update (now ${liveChangePercent.toFixed(2)}% from the previous close). In 2-3 sentences, what might a move like this mean for a beginner investor to understand?`,
        },
        '⚡ Price Update'
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveChangePercent]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setIsBusy(false);
    lastAlertedChangeRef.current = null;
    setExplainKey((k) => k + 1);
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || isBusy) return;

      setInput('');

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const updated = [...prev, userMsg];
        const completed = updated.filter((m) => !m.streaming && !m.isError);
        const capped = completed.slice(-MAX_HISTORY);
        const apiHistory = capped.map((m) => ({
          role: m.role === 'holo' ? 'assistant' : 'user',
          content: m.content,
        }));

        fetchOhlcSummary(symbol, interval).then((ohlcSummary) => {
          streamIntoNewBubble(`${BACKEND}/api/mentor/chat`, {
            messages: apiHistory,
            context: { symbol, interval, ohlc_summary: ohlcSummary },
          });
        });

        return updated;
      });

      scrollToBottom();
    },
    [isBusy, symbol, interval, streamIntoNewBubble, scrollToBottom]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuestion(input);
  };

  return (
    <div
      className="flex flex-col rounded-xl border overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a1929 0%, #0D1B2A 100%)',
        borderColor: '#00BFA622',
        height: '560px',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b"
        style={{ borderColor: '#00BFA622' }}
      >
        <HeaderOrb isThinking={isBusy} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">Holo Mentor</p>
          <p className="text-[11px] text-slate-400 truncate">
            AI financial educator · {symbol} · {interval === '5min' ? '5 Min' : '1 Day'}
          </p>
        </div>
        <button
          onClick={clearChat}
          disabled={isBusy}
          title="Clear chat and refresh analysis"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 border border-slate-700 hover:text-white hover:border-slate-500 transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Clear
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e3a4a transparent' }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <span className="text-3xl">✦</span>
            <p className="text-sm">Loading chart analysis…</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            onRetry={msg.isError && msg.role === 'holo' ? clearChat : undefined}
          />
        ))}
      </div>

      {/* Quick questions */}
      <div
        className="px-4 pt-2.5 pb-2 flex flex-wrap gap-1.5 flex-shrink-0 border-t"
        style={{ borderColor: '#00BFA611' }}
      >
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => sendQuestion(q)}
            disabled={isBusy}
            className="text-[11px] px-2.5 py-1 rounded-full border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-teal-900/30"
            style={{ borderColor: '#00BFA644', color: '#00BFA6' }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0 border-t"
        style={{ borderColor: '#00BFA622' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Holo anything about this chart…"
          disabled={isBusy}
          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-opacity disabled:opacity-30"
          style={{ background: 'linear-gradient(135deg, #00BFA6, #007a6e)' }}
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </form>

      {/* Disclaimer */}
      <p className="text-center text-[10px] text-slate-600 pb-2 px-4 flex-shrink-0">
        For educational purposes only — not financial advice
      </p>
    </div>
  );
};
