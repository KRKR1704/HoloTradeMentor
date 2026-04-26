import React, { useState } from "react";
import { askAI } from "../services/aiService";

const Assistant: React.FC = () => {
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await askAI(query);
      setResponse(result);
    } catch (error) {
      setResponse("Sorry, something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6 pb-24 sm:pb-6 animate-fade-in">
      <h1 className="text-3xl font-bold">AI Assistant</h1>
      <p className="text-muted-foreground">
        Ask me anything about stocks, investing, or trading!
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask your question here..."
          className="w-full h-32 p-3 bg-card border border-slate-800 rounded-lg text-foreground resize-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>

      {response && (
        <div className="bg-card border border-slate-800 p-5 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Response</h2>
          <p className="text-foreground whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
};

export default Assistant;
