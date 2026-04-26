# HoloTrade: Project Proposal
## AI-Powered Stock Trading Simulator

---

### 1. Vision Statement
**HoloTrade** aims to democratize financial education by providing a risk-free, high-fidelity environment where users can learn the art and science of stock trading. By merging real-time market data with cutting-edge AI insights, HoloTrade transforms the complex world of finance into an accessible, interactive learning journey.

### 2. Executive Summary
The financial markets are often perceived as intimidating or inaccessible to beginners. HoloTrade solves this by offering a virtual trading platform that simulates real market conditions using $10,000 in virtual "starting capital." Unlike traditional simulators, HoloTrade integrates **Claude** as a personal trading mentor, providing instant explanations of market trends, portfolio analysis, and educational guidance.

### 3. Core Features

#### 🛡️ Risk-Free Trading Simulation
- **Virtual Capital**: Start with $10,000 in virtual funds.
- **Real-Time Data**: Execute trades (Buy/Sell) based on live market prices.
- **Dynamic Portfolio**: Track holdings, average cost, and unrealized gains/losses in real-time.

#### 🤖 AI Mentor (Powered by Gemini)
- **Trade Feedback**: Receive AI-generated insights on individual trades to understand the "why" behind market movements.
- **Portfolio Analysis**: Get high-level summaries of your investment strategy and risk profile.
- **Smart Assistant**: A dedicated chat interface to ask questions about financial concepts (e.g., "What is market cap?").

#### 📚 Educational Learning Paths
- **Structured Lessons**: Curated content ranging from "Stock Market Basics" to "Advanced Technical Analysis."
- **Gamified Progress**: Track completed lessons and unlock new trading strategies.

#### 📊 Advanced Visualization
- **Interactive Charts**: Candlestick and line charts powered by Recharts for technical analysis.
- **Market News**: Integrated news feed to connect global events with stock performance.

---

### 4. Technical Architecture

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (v19), TypeScript, Vite |
| **Styling** | Tailwind CSS (Modern Slate & Gold Palette) |
| **Backend/Auth** | Firebase & Google Authentication |
| **AI Engine** | Google Gemini API (@google/genai) |
| **Data Visualization** | Recharts (Candlestick & Portfolio Performance) |
| **State Management** | React Context API |

---

### 5. Target Audience
1.  **Beginner Investors**: Individuals looking to learn how the market works without financial risk.
2.  **Students & Educators**: A tool for classrooms to simulate economic scenarios.
3.  **Casual Traders**: Users who want to test new strategies before deploying real capital.

---

### 6. Development Roadmap

#### Phase 1: Foundation (Current)
- [x] Basic trading mechanics (Buy/Sell).
- [x] Real-time mock stock data integration.
- [x] Initial Gemini AI assistant integration.
- [x] Comprehensive Dashboard UI.

#### Phase 2: Enhanced Intelligence
- [ ] Predictive trend analysis using Gemini.
- [ ] Social Trading: Share portfolio performance snapshots.
- [ ] Personalized daily "Market Briefings" from the AI assistant.

#### Phase 3: Advanced Education
- [ ] Interactive quizzes for the Learn module.
- [ ] Achievement system for financial milestones.

---

### 7. Visual Identity & Mood
- **Atmosphere**: Professional, Tech-forward, and Trustworthy.
- **Primary Palette**: Deep Stormy Blue (`#1a1d24`) accented with Amber/Gold (`#d97706`).
- **Typography**: Inter (Sans-serif) for high legibility and a modern feel.

---
*HoloTrade - Investing in Knowledge.*
