import React, { useState, useEffect, useCallback } from 'react';
import { getMarketNews } from '../services/newsService';
import { NewsArticle } from '../types';
import { ArrowPathIcon } from '../components/icons/ArrowPathIcon';

// ── Date helpers ──────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  // Guard against epoch-zero / invalid timestamps
  if (isNaN(d.getTime()) || d.getFullYear() < 2020) return 'Unknown date';
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day:   'numeric',
    year:  'numeric',
  });
  return `${datePart} · ${timeAgo(iso)}`;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="bg-card border border-slate-800 rounded-xl p-5 animate-pulse flex gap-4">
    <div className="flex-1 space-y-3">
      <div className="h-5 bg-slate-700 rounded w-3/4" />
      <div className="h-3 bg-slate-800 rounded w-1/4" />
      <div className="space-y-1.5">
        <div className="h-3 bg-slate-800 rounded w-full" />
        <div className="h-3 bg-slate-800 rounded w-5/6" />
        <div className="h-3 bg-slate-800 rounded w-4/6" />
      </div>
    </div>
    <div className="flex-shrink-0 w-24 h-20 bg-slate-800 rounded-lg" />
  </div>
);

// ── Article card ──────────────────────────────────────────────────────────────

const ArticleCard: React.FC<{ article: NewsArticle; index: number }> = ({ article, index }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!article.image && !imgFailed;

  return (
    <article
      className="bg-card border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors animate-fade-in"
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <div className="flex gap-4 items-start">
        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Source + date */}
          <p className="text-xs text-slate-500 font-medium truncate">
            {article.source && <span className="text-slate-400">{article.source}</span>}
            {article.source && ' · '}
            <span>{formatDate(article.publishedAt)}</span>
          </p>

          {/* Headline */}
          <h2 className="font-bold text-base leading-snug">
            {article.url && article.url !== '#' ? (
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:text-[#00BFA6] transition-colors"
              >
                {article.title}
              </a>
            ) : (
              <span className="text-foreground">{article.title}</span>
            )}
          </h2>

          {/* Summary */}
          {article.summary && (
            <p
              className="text-sm text-muted-foreground leading-relaxed"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {article.summary}
            </p>
          )}

          {/* Read more link */}
          {article.url && article.url !== '#' && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs text-[#00BFA6] hover:underline mt-1"
            >
              Read full article →
            </a>
          )}
        </div>

        {/* Thumbnail */}
        {showImage && (
          <div className="flex-shrink-0 w-24 h-20 sm:w-32 sm:h-24 rounded-lg overflow-hidden bg-slate-800">
            <img
              src={article.image!}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </article>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const NewsPage: React.FC = () => {
  const [articles, setArticles]   = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMarketNews();
      // Sort newest-first (backend should already do this, but enforce client-side too)
      const sorted = [...data].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      setArticles(sorted);
      setLastFetched(new Date());
    } catch (err) {
      setError('Failed to load news. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Market News</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lastFetched
              ? `Last updated ${timeAgo(lastFetched.toISOString())} · showing articles from the last 7 days`
              : 'Latest headlines from financial markets'}
          </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-slate-700 disabled:opacity-50 flex-shrink-0"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-card border border-slate-800 rounded-xl gap-4">
          <p className="text-2xl">📡</p>
          <p className="font-semibold text-destructive-foreground">{error}</p>
          <button
            onClick={fetchNews}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && articles.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center p-10 bg-card border border-slate-800 rounded-xl gap-3">
          <p className="text-3xl">📰</p>
          <p className="font-semibold text-lg">No recent news available</p>
          <p className="text-sm text-muted-foreground">
            No market news from the last 7 days was found. Try refreshing.
          </p>
          <button
            onClick={fetchNews}
            className="mt-2 px-5 py-2 text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-slate-700 transition"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Article list */}
      {!isLoading && !error && articles.length > 0 && (
        <div className="space-y-4">
          {articles.map((article, i) => (
            <ArticleCard key={article.id || i} article={article} index={i} />
          ))}
          <p className="text-center text-xs text-slate-600 pt-2">
            Showing {articles.length} article{articles.length !== 1 ? 's' : ''} from the last 7 days · powered by Finnhub
          </p>
        </div>
      )}
    </div>
  );
};

export default NewsPage;
