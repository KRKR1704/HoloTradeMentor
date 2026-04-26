# 🌐 HoloTrade Mentor

### AI-Powered Financial Learning Platform

> _Turning real stock market data into an interactive classroom — where an AI mentor teaches beginners how to understand investing, instead of just showing them charts._

⚠️ **Educational purposes only. Not financial advice.**

---

## 📌 Overview

HoloTrade Mentor is a hackathon MVP built for the **Economic Empowerment & Education** track. It pairs real-time stock market data and candlestick charts with a Claude-powered AI mentor — the **Holo** — that explains what users are seeing, teaches the underlying concepts, and answers follow-up questions in plain, beginner-friendly language.

No prior finance knowledge required.

---

## 🎯 The Problem

Despite the democratisation of stock market access, most trading platforms assume prior domain knowledge. Complex charts, technical indicators, and financial jargon create an invisible barrier that turns potential learners away before they can develop meaningful understanding.

| Pain Point                       | Impact                                         |
| -------------------------------- | ---------------------------------------------- |
| Charts shown without explanation | Users cannot interpret what they see           |
| Jargon-heavy interfaces          | Beginners feel intimidated and disengage       |
| Passive, read-only tools         | No interactive feedback loop for learning      |
| Risk misunderstood               | Uninformed decisions, potential financial harm |

---

## ✨ Features

### F1 — Real-Time Stock Data

Live quote data (price, change %, volume) for **AAPL, MSFT, NVDA, TSLA** via Twelve Data API. Refreshed every 30 seconds with colour-coded movement indicators.

### F2 — Candlestick Chart Viewer

Interactive OHLC candlestick charts powered by TradingView's `lightweight-charts`. Supports **5-minute intraday** and **daily** intervals with hover crosshair inspection.

### F3 — Holo AI Mentor ⭐

On chart load, the Claude-powered Holo mentor automatically generates a contextual explanation — identifying trend direction, volatility signals, and notable patterns. All output is phrased in beginner-friendly English.

### F4 — Interactive Q&A

Ask free-form questions like _"What does this dip mean?"_, _"Explain volatility"_, or _"Is this stock risky right now?"_ The mentor responds dynamically using current chart context and full conversational history.

### F5 — Concept Glossary Tooltips

Hover-enabled inline tooltips on jargon terms (OHLC, volume, moving average, etc.) — no need to leave the platform.

### F6 — Ethical Disclaimer System

Persistent banner and AI-level prompt constraints enforce educational-only output. The mentor never gives buy/sell recommendations.

---

## 🛠️ Tech Stack

| Layer           | Technology                       | Purpose                                    |
| --------------- | -------------------------------- | ------------------------------------------ |
| Frontend        | React + TypeScript               | Component-driven UI, type-safe development |
| Styling         | Tailwind CSS                     | Utility-first rapid styling                |
| Charts          | lightweight-charts (TradingView) | High-performance candlestick rendering     |
| Backend         | FastAPI (Python)                 | REST API layer; proxy for external APIs    |
| AI              | Claude API (`claude-sonnet-4`)   | Holo mentor responses & chart explanations |
| Market Data     | Twelve Data API                  | Real-time quotes + OHLC candle data        |
| Fallback Data   | Alpha Vantage API                | Backup source if Twelve Data rate-limits   |
| Frontend Deploy | Vercel                           | Zero-config React hosting                  |
| Backend Deploy  | Render / Railway                 | FastAPI container, free tier               |

---

---

## Team Members

| Name                          | LinkedIn                                                               |
| ----------------------------- | ---------------------------------------------------------------------- |
| **Shriya Sharma**             | [LinkedIn](https://www.linkedin.com/in/shriyasharmacs26/)              |
| **Roopesh Kumar Reddy Kaipa** | [LinkedIn](https://www.linkedin.com/in/roopeshkaipa/)                  |
| **Vedika Desai**              | [LinkedIn](https://www.linkedin.com/in/vedika-dinesh-desai-80690a240/) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- API keys for: [Anthropic](https://console.anthropic.com), [Finnhub](https://finnhub.io), [Alpha Vantage](https://www.alphavantage.co) (optional)

### 1. Clone the repo

```bash
git clone https://github.com/your-username/holotrade-mentor.git
cd holotrade-mentor
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:

```env
ANTHROPIC_API_KEY=your_anthropic_key
FINNHUB_API_KEY=your_finnhub_key
AV_API_KEY=your_alpha_vantage_key   # optional
```

Start the FastAPI server:

```bash
uvicorn main:app --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create a `.env.local` file in `/frontend`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

The app will be running at `http://localhost:5173`.

## 🗺️ Implementation Roadmap

- [x] Stage 1 — Project scaffold & three-panel UI layout
- [x] Stage 2 — Live stock data integration (Twelve Data)
- [x] Stage 3 — Candlestick chart rendering (lightweight-charts)
- [x] Stage 4 — Holo AI mentor auto-explanation (Claude API)
- [x] Stage 5 — Interactive Q&A with conversational history
- [x] Stage 6 — Polish, Holo avatar animation, demo prep

---

## ⚖️ Ethical Considerations

- All AI output is explicitly framed as **educational content only**, never financial advice
- The Claude system prompt instructs the mentor to **avoid buy/sell recommendations** under any circumstances
- A **persistent disclaimer banner** is visible across all views
- Holo explains _why_ something may be risky — it never tells users what to do
- **No user data or personal financial information is collected or stored**

---

## 🔮 Future Enhancements

- 📊 **Paper trading simulator** — practice with virtual funds, no real money
- 💼 **Portfolio tracker** — monitor multiple positions and P&L
- 🎓 **Personalised learning paths** — AI-curated modules based on knowledge gaps
- 📉 **Risk analysis engine** — automated risk scores per stock
- 🎙️ **Voice-enabled Holo mentor** — spoken explanations for accessibility
- 📦 **ETF & mutual fund comparison module**
- 🔔 **Real-time alerts with AI narrative** — price movement notifications with context

---

## 👥 Target Audience

- University students in finance, business, or any field curious about investing
- Beginner retail investors (18–28) opening their first brokerage accounts
- Student investment clubs using it as a shared learning tool

---

## 📄 Disclaimer

> This platform is for **educational purposes only** and does not constitute financial advice. Always consult a qualified financial advisor before making investment decisions.

---

_Built with ❤️ for the Economic Empowerment & Education Hackathon Track_
