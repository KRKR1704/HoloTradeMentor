import React, { useState, useEffect, useCallback } from "react";
import { getMarketNews } from "../services/newsService";
import { NewsArticle } from "../types";
import { ArrowPathIcon } from "../components/icons/ArrowPathIcon";

const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
};

const NewsPage: React.FC = () => {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newsData = await getMarketNews();
      setArticles(newsData);
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError("Failed to load real-time news. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-card border border-slate-800 rounded-lg">
      <ArrowPathIcon className="w-8 h-8 animate-spin text-accent mb-4" />
      <p className="font-semibold">Fetching Real-Time Market News...</p>
      <p className="text-sm text-muted-foreground">
        HoloTradeMentor is scanning the latest headlines for you.
      </p>
    </div>
  );

  const renderError = () => (
    <div className="text-center p-8 bg-destructive/10 border border-destructive/50 rounded-lg">
      <p className="font-semibold text-destructive-foreground">{error}</p>
      <button
        onClick={fetchNews}
        disabled={isLoading}
        className="mt-4 px-4 py-2 text-sm font-medium rounded-md transition bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Market News</h1>
          <p className="text-muted-foreground">
            Stay updated with the latest headlines impacting the market.
          </p>
        </div>
        <button
          onClick={fetchNews}
          disabled={isLoading}
          className="flex items-center px-4 py-2 text-sm font-medium rounded-md transition bg-secondary hover:bg-secondary/80 text-secondary-foreground disabled:opacity-50"
          title="Refresh News"
        >
          <ArrowPathIcon
            className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {isLoading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : (
        <div className="space-y-4">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-card border border-slate-800 p-5 rounded-lg shadow-sm animate-slide-in-up"
              style={{ animationDelay: `${articles.indexOf(article) * 50}ms` }}
            >
              <h2 className="text-xl font-bold text-accent">{article.title}</h2>
              <div className="text-xs text-muted-foreground my-2">
                <span>{article.source}</span> &bull;{" "}
                <span>{timeAgo(article.publishedAt)}</span>
              </div>
              <p className="mt-2 text-foreground">{article.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsPage;
