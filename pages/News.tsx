import React, { useState, useEffect, useCallback } from 'react';
import { getMarketNews, clearNewsCache } from '../services/newsService';
import { NewsArticle } from '../types';
import { ArrowPathIcon } from '../components/icons/ArrowPathIcon';

// ── Sentiment badge ───────────────────────────────────────────────────────────

const SentimentBadge: React.FC<{ sentiment: NewsArticle['sentiment'] }> = ({ sentiment }) => {
  const map = {
    positive: { label: 'Positive', classes: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50' },
    negative: { label: 'Negative', classes: 'bg-red-950/60 text-red-400 border-red-800/50' },
    neutral:  { label: 'Neutral',  classes: 'bg-slate-800/60 text-slate-400 border-slate-700' },
  } as const;

  const { label, classes } = map[sentiment] ?? map.neutral;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${classes}`}>
      {sentiment === 'positive' ? '▲' : sentiment === 'negative' ? '▼' : '●'} {label}
    </span>
  );
};

// ── Loading state ─────────────────────────────────────────────────────────────

const LoadingState: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center p-12 bg-card border border-slate-800 rounded-xl gap-4">
    {/* Pulsing orb */}
    <div className="relative w-12 h-12">
      <div
        className="absolute inset-0 rounded-full animate-ping opacity-30"
        style={{ background: '#00BFA6' }}
      />
      <div
        className="relative w-12 h-12 rounded-full flex items-center justify-center text-xl"
        style={{ background: 'radial-gradient(circle at 35% 35%, #00e5cc, #006e7f 55%, #0D1B2A)' }}
      >
        🔍
      </div>
    </div>
    <div>
      <p className="font-semibold text-foreground">Holo is searching for the latest news…</p>
      <p className="text-sm text-muted-foreground mt-1">
        Scanning financial headlines · this takes a few seconds
      </p>
    </div>
  </div>
);

// ── Article card ──────────────────────────────────────────────────────────────

const ArticleCard: React.FC<{ article: NewsArticle; index: number }> = ({ article, index }) => {
  const note = article.relevance ?? article.impact;

  return (
    <article
      className="bg-card border border-slate-800 rounded-xl p-5 space-y-3 hover:border-slate-700 transition-colors animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      {/* Header: headline + sentiment */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-bold text-base leading-snug text-foreground flex-1">
          {article.headline}
        </h2>
        <SentimentBadge sentiment={article.sentiment} />
      </div>

      {/* Source */}
      {article.source && (
        <p className="text-xs text-slate-500 font-medium">{article.source}</p>
      )}

      {/* Summary */}
      <p className="text-sm text-muted-foreground leading-relaxed">{article.summary}</p>

      {/* Why it matters */}
      {note && (
        <p className="text-sm italic leading-relaxed" style={{ color: '#00BFA6' }}>
          💡 <span className="font-medium">Why it matters:</span> {note}
        </p>
      )}
    </article>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const NewsPage: React.FC = () => {
  const [articles, setArticles]   = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const fetchNews = useCallback(async (bustCache = false) => {
    setIsLoading(true);
    setError(null);
    try {
      if (bustCache) await clearNewsCache();
      const data = await getMarketNews();
      setArticles(data);
      setFetchedAt(new Date());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load news.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(false);
  }, [fetchNews]);

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">Market News</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {fetchedAt
              ? `Last fetched ${fetchedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Holo searches the web for real, current financial news'}
          </p>
        </div>
        <button
          onClick={() => fetchNews(true)}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-slate-700 transition disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh News
        </button>
      </div>

      {/* Loading */}
      {isLoading && <LoadingState />}

      {/* Error */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-card border border-slate-800 rounded-xl gap-4">
          <p className="text-3xl">📡</p>
          <p className="font-semibold">Holo couldn't fetch news right now.</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => fetchNews(true)}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition"
          >
            Try Refreshing
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-card border border-slate-800 rounded-xl gap-3">
          <p className="text-3xl">📰</p>
          <p className="font-semibold text-lg">No news found</p>
          <p className="text-sm text-muted-foreground">
            Holo couldn't find recent stories. Try refreshing.
          </p>
          <button
            onClick={() => fetchNews(true)}
            className="mt-2 px-5 py-2 text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-slate-700 transition"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Articles */}
      {!isLoading && !error && articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article, i) => (
            <ArticleCard key={i} article={article} index={i} />
          ))}

          {/* Footer */}
          <p className="text-center text-xs text-slate-600 pt-2 pb-1">
            Powered by Holo AI + Web Search · {articles.length} stories · refreshes on demand only
          </p>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
