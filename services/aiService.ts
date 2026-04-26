// All AI calls route through the FastAPI backend which uses the Anthropic Claude API.
// No API keys are stored or used in the frontend.

import { Stock, PortfolioItem, TradeType, Trade, User, StockHistoryPoint, NewsArticle, Lesson } from '../types';

const BACKEND = 'http://localhost:8000';

// Stream text/plain from backend, calling onChunk for each chunk.
// Resolves with the full accumulated text when the stream closes.
export async function streamAI(
  prompt: string,
  onChunk: (chunk: string, full: string) => void,
  context?: string,
): Promise<string> {
  try {
    const res = await fetch(`${BACKEND}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context }),
    });
    if (!res.ok || !res.body) return 'The AI assistant is temporarily unavailable. Please try again.';

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      onChunk(chunk, full);
    }
    return full;
  } catch {
    return fallbackResponse;
  }
}

// Legacy non-streaming helper kept for backward compat (reads full stream then returns)
export const askAI = async (query: string, context?: string): Promise<string> => {
  return streamAI(query, () => {}, context);
};

// ── Prompt builders (pure functions — no API calls) ───────────────────────────

export const getTradeInsightPrompt = (
  stock: Stock,
  shares: number,
  type: TradeType,
  portfolio: PortfolioItem[],
  balance: number
): string => {
  const portfolioSummary =
    portfolio.length > 0
      ? `a portfolio containing: ${portfolio.map((p) => `${p.shares} shares of ${p.stock.symbol}`).join(', ')}.`
      : 'an empty portfolio.';
  const tradeAction =
    type === TradeType.BUY
      ? `buying ${shares} shares of ${stock.name} (${stock.symbol})`
      : `selling ${shares} shares of ${stock.name} (${stock.symbol})`;
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const totalCost = stock.price * shares;

  let prompt = `Explain the potential impact of ${tradeAction} for a beginner investor with ${portfolioSummary} Their cash balance is ${fmt(balance)} and this trade involves ${fmt(totalCost)}.`;

  if (type === TradeType.BUY) {
    prompt += ` Focus on educational concepts like diversification, risk, and what percentage of cash this trade uses.`;
  } else {
    const holding = portfolio.find((p) => p.stock.symbol === stock.symbol);
    if (holding) {
      const pnl = (stock.price - holding.avgCost) * shares;
      const outcome = pnl >= 0 ? 'locking in a profit' : 'realizing a loss';
      prompt += ` This trade involves ${outcome}. Explain what "realizing a gain/loss" means and how it affects their cash balance.`;
    }
  }

  prompt += ` Keep it concise (2-3 sentences), educational, and address the user as "you". Do not give financial advice or predict future performance.`;
  return prompt;
};

export const getTradeFeedbackPrompt = (trade: Trade, userBeforeTrade: User): string => {
  const { stock, shares, type, price } = trade;
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const actionText = `${type === TradeType.BUY ? 'bought' : 'sold'} ${shares} share${shares > 1 ? 's' : ''} of ${stock.symbol} at ${fmt(price)}`;
  const portfolioSummary =
    userBeforeTrade.portfolio.length > 0
      ? `Before this, your portfolio held: ${userBeforeTrade.portfolio.map((p) => `${p.shares} of ${p.stock.symbol}`).join(', ')}.`
      : 'Before this, your portfolio was empty.';

  let prompt = `A beginner investor just ${actionText}. ${portfolioSummary} Their cash balance was ${fmt(userBeforeTrade.balance)}.`;

  if (type === TradeType.BUY) {
    const pct = ((price * shares) / userBeforeTrade.balance) * 100;
    prompt += ` This purchase used ${pct.toFixed(1)}% of available cash. Comment on concentration risk or diversification.`;
  } else {
    const holding = userBeforeTrade.portfolio.find((p) => p.stock.symbol === stock.symbol);
    if (holding) {
      const pnl = (price - holding.avgCost) * shares;
      const outcome = pnl >= 0 ? `realized a gain of ${fmt(pnl)}` : `realized a loss of ${fmt(Math.abs(pnl))}`;
      prompt += ` By selling, you ${outcome}. Explain this concept and the importance of a sell strategy.`;
    }
  }

  prompt += ` Frame as direct, encouraging feedback (2-4 sentences). Do not give financial advice. Start with "Good move," or "Here's something to consider,".`;
  return prompt;
};

export const getPortfolioInsightPrompt = (user: User, portfolioValue: number, totalPandL: number): string => {
  const list = user.portfolio.map((p) => `- ${p.shares} shares of ${p.stock.name} (${p.stock.symbol})`).join('\n');
  const profitText = totalPandL >= 0 ? `up $${totalPandL.toFixed(2)}` : `down $${Math.abs(totalPandL).toFixed(2)}`;

  return `Analyze my current portfolio of virtual stocks:
${list}

Total portfolio value: $${portfolioValue.toFixed(2)}
Total profit/loss: ${profitText}
Current cash balance: $${user.balance.toFixed(2)}

Please provide:
### Portfolio Composition
A 1-2 sentence overview of what my portfolio currently looks like.

### Strategy Evaluation
Assess my current allocation (diverse? too risky?).

### Educational Tip
One key concept (like "risk tolerance" or "sector weightings") that applies to my holdings.

Keep the tone encouraging and educational. Avoid specific buy/sell recommendations.`;
};

export const getRealTimeStockAnalysisPrompt = (stock: Stock, history: StockHistoryPoint[]): string => {
  if (history.length < 2) {
    return `Provide a brief company overview for ${stock.name} (${stock.symbol}).`;
  }
  const start = history[0].close;
  const end = history[history.length - 1].close;
  const change = end - start;
  const pct = (change / start) * 100;

  return `The stock ${stock.name} (${stock.symbol}) moved from $${start.toFixed(2)} to $${end.toFixed(2)}, a ${change >= 0 ? 'gain' : 'loss'} of ${Math.abs(pct).toFixed(2)}% over this period.

Provide a brief educational technical analysis:
1. Overall trend (bullish, bearish, or sideways).
2. One key support or resistance level to watch.
3. One financial metric a beginner should check for this company.

Keep it concise, objective, and strictly educational.`;
};

export const getPriceAlertExplanationPrompt = (holding: PortfolioItem, newPrice: number): string => {
  const change = newPrice - holding.stock.price;
  const pct = (change / holding.stock.price) * 100;
  const direction = change >= 0 ? 'risen' : 'fallen';
  const unrealizedPnl = (newPrice - holding.avgCost) * holding.shares;
  const pnlText = unrealizedPnl >= 0 ? `an unrealized gain of $${unrealizedPnl.toFixed(2)}` : `an unrealized loss of $${Math.abs(unrealizedPnl).toFixed(2)}`;

  return `${holding.stock.name} (${holding.stock.symbol}) has ${direction} by ${Math.abs(pct).toFixed(2)}% to $${newPrice.toFixed(2)}. You hold ${holding.shares} shares at an average cost of $${holding.avgCost.toFixed(2)}, giving you ${pnlText}. Briefly explain what this price movement means for a beginner investor and what "unrealized gain/loss" means. Keep it to 2-3 sentences, educational, and don't recommend any action.`;
};

export const fetchLearnLessons = async (completedIds: string[] = []): Promise<Lesson[]> => {
  try {
    const params = new URLSearchParams();
    if (completedIds.length > 0) {
      params.set('completedIds', completedIds.join(','));
    }

    const url = `${BACKEND}/api/mentor/lessons${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.error('fetchLearnLessons failed:', res.status, res.statusText, text);
      return [];
    }
    const data = JSON.parse(text);
    if (data && typeof data === 'object' && 'success' in data && data.success === false) {
      console.error('fetchLearnLessons api error:', data.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('fetchLearnLessons error:', error);
    return [];
  }
};

export const generateRealTimeNews = async (): Promise<NewsArticle[]> => {
  try {
    const res = await fetch(`${BACKEND}/api/ai/news`, { method: 'POST' });
    if (!res.ok) return [];
    return await res.json() as NewsArticle[];
  } catch {
    return [];
  }
};
