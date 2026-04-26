import React, { useState, useRef, useEffect } from 'react';
import { askAI } from '../services/geminiService';

interface Message {
  sender: 'user' | 'ai';
  text: string;
}

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: "Hello! I'm Tyche, your AI assistant. How can I help you learn about trading today?" },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (textToSend.trim() === '' || isLoading) return;

    const userMessage: Message = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiResponse = await askAI(textToSend);
      const aiMessage: Message = { sender: 'ai', text: aiResponse };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        sender: 'ai',
        text: 'Sorry, I am having trouble connecting. Please try again later.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const SuggestedPrompts = () => (
    <div className="mb-4 p-3 bg-background rounded-lg border border-slate-800">
        <p className="text-sm font-bold text-muted-foreground mb-3">Not sure what to ask? Try one of these:</p>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => handleSend("What is a P/E ratio?")} className="bg-secondary text-sm text-secondary-foreground px-3 py-1 rounded-full hover:bg-secondary/80 transition">What is a P/E ratio?</button>
            <button onClick={() => handleSend("Explain market diversification.")} className="bg-secondary text-sm text-secondary-foreground px-3 py-1 rounded-full hover:bg-secondary/80 transition">Explain market diversification.</button>
            <button onClick={() => handleSend("What's the difference between a stock and an ETF?")} className="bg-secondary text-sm text-secondary-foreground px-3 py-1 rounded-full hover:bg-secondary/80 transition">Stock vs ETF?</button>
        </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-140px)] sm:h-[calc(100vh-80px)] flex flex-col">
      <h1 className="text-3xl font-bold mb-4">AI Assistant</h1>
      
      <div className="flex-grow bg-card border border-slate-800 rounded-lg p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-xl ${
                msg.sender === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {messages.length === 1 && <SuggestedPrompts />}
        {isLoading && (
            <div className="flex justify-start">
                <div className="max-w-xs p-3 rounded-xl bg-secondary text-secondary-foreground">
                    <div className="animate-pulse">Thinking...</div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask about a stock or a concept..."
          className="flex-grow bg-card border border-slate-800 rounded-l-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary transition"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-r-lg hover:bg-primary/90 transition disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Assistant;