import React from 'react';
import { Link } from 'react-router-dom';

const steps = [
  {
    number: '01',
    title: 'Browse Stocks',
    description:
      'Head to the Trade tab to see live (or simulated) prices for popular stocks like AAPL, MSFT, NVDA, and TSLA. Click any card to open its detail view.',
  },
  {
    number: '02',
    title: 'Read the Chart',
    description:
      'Each stock has an interactive candlestick chart. Switch between 5-minute intraday and daily views. Hover over any candle to see Open, High, Low, and Close prices.',
  },
  {
    number: '03',
    title: 'Ask Holo',
    description:
      'Holo is your AI mentor — it automatically explains the chart when you open a stock and answers follow-up questions in plain English, with no jargon.',
  },
  {
    number: '04',
    title: 'Practice Trading',
    description:
      'Use your virtual $10,000 balance to buy and sell stocks without any real risk. Watch your portfolio grow and learn how the market works at your own pace.',
  },
];

const DemoPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4 sm:p-8 max-w-3xl space-y-10 pb-24 sm:pb-10 animate-fade-in">
      {/* Hero */}
      <div className="text-center space-y-3 pt-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
          HoloTrade Mentor
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          A beginner-friendly stock simulator powered by AI. Learn how to read
          charts, understand market concepts, and practice trading — all in one
          place.
        </p>
      </div>

      {/* What is it */}
      <div className="rounded-xl border-l-4 border-[#00BFA6] bg-[#071524] p-6 space-y-2">
        <h2 className="text-xl font-bold text-foreground">What is HoloTrade Mentor?</h2>
        <p className="text-muted-foreground leading-relaxed">
          HoloTrade Mentor combines real (or simulated) market data with an AI
          tutor called <span className="text-[#00BFA6] font-semibold">Holo</span>.
          Holo explains stock charts in plain English, answers your questions,
          and helps you build confidence before ever risking real money.
          Everything is for educational purposes — Holo never gives financial
          advice.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border-l-4 border-[#00BFA6] bg-[#071524] p-5 space-y-2"
            >
              <p className="text-3xl font-black text-[#00BFA6]/30 font-mono leading-none">
                {step.number}
              </p>
              <h3 className="text-lg font-bold text-foreground">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
        <Link
          to="/trade"
          className="text-center bg-[#00BFA6] text-[#0D1B2A] font-bold py-3 px-8 rounded-xl hover:bg-[#00BFA6]/90 transition text-lg"
        >
          Explore Stocks →
        </Link>
        <Link
          to="/"
          className="text-center bg-secondary text-foreground font-bold py-3 px-8 rounded-xl hover:bg-secondary/80 transition border border-slate-700 text-lg"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default DemoPage;
