import os
import json
import math
import random
import hashlib
import httpx
import anthropic
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional, List, Dict
from datetime import datetime, timedelta

load_dotenv()

TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
AV_API_KEY = os.getenv("AV_API_KEY")

TWELVE_DATA_BASE = "https://api.twelvedata.com"
AV_BASE_URL = "https://www.alphavantage.co/query"

HOLO_SYSTEM_PROMPT = """You are Holo, a friendly and encouraging financial educator built into HoloTrade Mentor.

Your job is to help complete beginners understand stock charts and market concepts — not to give investment advice.

Guidelines:
- Explain things in plain, jargon-free English. If you must use a term (like OHLC or volatility), define it immediately.
- Be warm, encouraging, and patient. Never make the user feel silly for not knowing something.
- Focus on education: explain WHAT you see in the data and WHY it matters conceptually.
- NEVER recommend buying or selling any stock. If asked, gently redirect: "I can explain what this pattern means, but I'm not able to advise on whether to buy or sell."
- Keep responses concise and scannable — use short paragraphs or bullet points when helpful.
- Always end with a small encouragement or invite a follow-up question.

You are not a financial advisor. You are a teacher."""

app = FastAPI(title="HoloTrade Mentor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    symbol: str
    interval: str
    ohlc_summary: str
    question: Optional[str] = None


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[dict] = {}


class AskRequest(BaseModel):
    prompt: str
    context: Optional[str] = None


class StockModel(BaseModel):
    symbol: str
    name: str
    price: float
    open: float
    previousClose: float


class PortfolioItemModel(BaseModel):
    stock: StockModel
    shares: int
    avgCost: float


class TradeModel(BaseModel):
    stock: StockModel
    shares: int
    price: float
    type: str
    timestamp: int


class UserModel(BaseModel):
    id: str
    name: str
    email: str
    balance: float
    portfolio: List[PortfolioItemModel]
    tradeHistory: List[TradeModel]
    lessonProgress: List[str] = []


class LessonProgressUpdate(BaseModel):
    lessonId: str


# ── Mock data fallback ───────────────────────────────────────────────────────
# Used when Twelve Data API key is absent or returns an error.

_BASE_PRICES = {
    "AAPL": 185.0, "MSFT": 415.0, "NVDA": 875.0, "TSLA": 250.0,
    "ORCL": 165.0, "META": 550.0, "GOOGL": 175.0, "AMZN": 205.0,
    "NFLX": 620.0, "AMD":  160.0, "INTC":  30.0,  "CRM":  290.0,
}

_COMPANY_NAMES = {
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "NVDA": "NVIDIA Corp.",
    "TSLA": "Tesla Inc.", "ORCL": "Oracle Corp.",     "META": "Meta Platforms",
    "GOOGL": "Alphabet Inc.", "AMZN": "Amazon.com Inc.", "NFLX": "Netflix Inc.",
    "AMD": "Advanced Micro Devices", "INTC": "Intel Corp.", "CRM": "Salesforce Inc.",
}

DEFAULT_USER = UserModel(
    id="guest-id",
    name="Investor",
    email="guest@example.com",
    balance=10000.0,
    portfolio=[],
    tradeHistory=[],
    lessonProgress=[],
)

USER_STORE: Dict[str, UserModel] = {"guest-id": DEFAULT_USER}

LESSON_CATALOG = [
    {
        "id": "l1",
        "title": "What is a Stock?",
        "difficulty": "Beginner",
        "level": 1,
        "content": "A stock is a small ownership share in a company. Owning one means you participate in the company’s success and learn how markets value businesses.",
        "resources": [
            {
                "label": "Investopedia: What Is a Stock?",
                "url": "https://www.investopedia.com/terms/s/stock.asp",
            }
        ],
    },
    {
        "id": "l2",
        "title": "How to Read Stock Charts",
        "difficulty": "Beginner",
        "level": 2,
        "content": "Stock charts show how prices change over time. Learning to read bars, lines, and trends helps you understand whether a stock is moving up, down, or sideways.",
        "sections": [
            {
                "title": "Chart basics",
                "content": "Line charts are the simplest, showing the closing price over time. Candlestick charts provide more information, including the open, high, low, and close prices for each period.",
            },
            {
                "title": "Why it matters",
                "content": "Reading a chart helps you see trends, momentum, and whether a stock is moving up, down, or sideways.",
            },
        ],
        "resources": [
            {
                "label": "Investopedia: Stock Chart Basics",
                "url": "https://www.investopedia.com/terms/s/stock-chart.asp",
            }
        ],
    },
    {
        "id": "l3",
        "title": "Understanding Market Cap",
        "difficulty": "Intermediate",
        "level": 3,
        "content": "Market capitalization is the total value of a company’s shares. It helps beginners compare companies and understand the difference between large, mid, and small caps.",
        "sections": [
            {
                "title": "Why market cap matters",
                "content": "Market cap helps beginners compare companies and understand the difference between large, mid, and small caps.",
            },
        ],
        "resources": [
            {
                "label": "Investopedia: Market Capitalization",
                "url": "https://www.investopedia.com/terms/m/marketcapitalization.asp",
            }
        ],
    },
    {
        "id": "l4",
        "title": "What is Diversification?",
        "difficulty": "Intermediate",
        "level": 4,
        "content": "Diversification means spreading risk across different stocks or sectors. It is a simple way to avoid putting too much weight on one company or market move.",
    },
    {
        "id": "l5",
        "title": "Managing Risk and Review",
        "difficulty": "Advanced",
        "level": 5,
        "content": "Managing risk means thinking about how much loss you can accept and reviewing your holdings regularly. It helps you stay calm and learn from how the market behaves.",
    },
    {
        "id": "l6",
        "title": "Why Earnings Matter",
        "difficulty": "Intermediate",
        "level": 3,
        "content": "Company earnings show how much profit a business makes. Beginners can use earnings to understand whether a stock is growing and how the market may react.",
    },
    {
        "id": "l7",
        "title": "What Is a Dividend?",
        "difficulty": "Beginner",
        "level": 2,
        "content": "A dividend is a payment a company makes to its shareholders. It is one way investors can earn money from stocks, not just from price changes.",
    },
    {
        "id": "l8",
        "title": "Support and Resistance",
        "difficulty": "Intermediate",
        "level": 4,
        "content": "Support and resistance are price levels where a stock often stops falling or rising. These terms help traders notice where buyers or sellers may step in.",
    },
    {
        "id": "l9",
        "title": "Why Volume Matters",
        "difficulty": "Intermediate",
        "level": 4,
        "content": "Volume shows how many shares trade in a day. High volume can mean more interest and stronger price moves, while low volume often means the market is quiet.",
    },
    {
        "id": "l10",
        "title": "Reviewing Your Learning Progress",
        "difficulty": "Advanced",
        "level": 5,
        "content": "Reviewing what you have learned helps you remember it longer. Reflecting on new concepts turns individual lessons into a stronger understanding of the market.",
    },
]


def _seed_for(symbol: str) -> int:
    """Stable seed derived from the symbol so mock data is consistent per symbol."""
    return int(hashlib.md5(symbol.upper().encode()).hexdigest(), 16) % (2 ** 32)


def _mock_candles(symbol: str, interval: str) -> list:
    count = 78 if interval == "5min" else 90
    rng = random.Random(_seed_for(symbol))
    base = _BASE_PRICES.get(symbol.upper(), 100.0)
    price = base * rng.uniform(0.85, 1.15)
    now = datetime.utcnow()
    candles = []
    for i in range(count - 1, -1, -1):
        if interval == "1day":
            dt = now - timedelta(days=i)
            time_str = dt.strftime("%Y-%m-%d")
        else:
            dt = now - timedelta(minutes=i * 5)
            time_str = dt.strftime("%Y-%m-%d %H:%M:%S")

        # Gaussian random walk — slight upward drift
        pct = rng.gauss(0.0005, 0.014)
        open_p = price
        close_p = round(price * (1 + pct), 2)
        high_p  = round(max(open_p, close_p) * (1 + abs(rng.gauss(0, 0.004))), 2)
        low_p   = round(min(open_p, close_p) * (1 - abs(rng.gauss(0, 0.004))), 2)
        volume  = int(rng.uniform(8e6, 6e7))
        candles.append({"time": time_str, "open": open_p, "high": high_p,
                         "low": low_p, "close": close_p, "volume": volume})
        price = close_p
    return candles


def _mock_quote(symbol: str) -> dict:
    candles = _mock_candles(symbol, "1day")
    last = candles[-1]
    prev = candles[-2] if len(candles) > 1 else last
    change = round(last["close"] - prev["close"], 2)
    pct    = round(change / prev["close"] * 100, 2) if prev["close"] else 0.0
    return {
        "symbol": symbol.upper(),
        "name": _COMPANY_NAMES.get(symbol.upper(), symbol.upper()),
        "price": str(last["close"]),
        "change": str(change),
        "change_percent": str(pct),
        "volume": str(last["volume"]),
        "is_market_open": True,
        "is_mock": True,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── Symbol Search ─────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search_symbols(query: str = ""):
    if not query.strip():
        return []

    if TWELVE_DATA_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{TWELVE_DATA_BASE}/symbol_search",
                    params={"symbol": query, "outputsize": 10, "apikey": TWELVE_DATA_API_KEY},
                )
            data = resp.json()
            if "data" in data:
                return [
                    {
                        "symbol": item.get("symbol"),
                        "name": item.get("instrument_name"),
                        "exchange": item.get("exchange"),
                        "type": item.get("instrument_type"),
                    }
                    for item in data["data"]
                ]
        except Exception:
            pass  # fall through to mock

    # Mock fallback: match query against known symbols/names
    q = query.upper()
    results = []
    for sym, name in _COMPANY_NAMES.items():
        if q in sym or q in name.upper():
            results.append({"symbol": sym, "name": name, "exchange": "NASDAQ", "type": "Common Stock"})
    return results[:10]


# ── Market Data ───────────────────────────────────────────────────────────────

@app.get("/api/quote/{symbol}")
async def get_quote(symbol: str):
    # Try live data first; fall back to mock on any failure
    if TWELVE_DATA_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{TWELVE_DATA_BASE}/quote",
                    params={"symbol": symbol, "apikey": TWELVE_DATA_API_KEY},
                )
            data = resp.json()
            if "code" not in data or data["code"] == 200:
                return {
                    "symbol": data.get("symbol"),
                    "name": data.get("name"),
                    "price": data.get("close"),
                    "change": data.get("change"),
                    "change_percent": data.get("percent_change"),
                    "volume": data.get("volume"),
                    "is_market_open": data.get("is_market_open"),
                    "is_mock": False,
                }
        except Exception:
            pass  # fall through to mock

    return _mock_quote(symbol)


@app.get("/api/user")
async def get_user():
    return USER_STORE["guest-id"]


@app.patch("/api/user/lesson-progress")
async def update_lesson_progress(body: LessonProgressUpdate):
    user = USER_STORE["guest-id"]
    if body.lessonId not in user.lessonProgress:
        user.lessonProgress.append(body.lessonId)
    return user


@app.get("/api/candles/{symbol}")
async def get_candles(symbol: str, interval: str = "1day"):
    if interval not in ("5min", "1day"):
        raise HTTPException(status_code=400, detail="interval must be '5min' or '1day'")

    # Try live data first; fall back to mock on any failure
    if TWELVE_DATA_API_KEY:
        try:
            outputsize = 78 if interval == "5min" else 90
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{TWELVE_DATA_BASE}/time_series",
                    params={
                        "symbol": symbol,
                        "interval": interval,
                        "outputsize": outputsize,
                        "apikey": TWELVE_DATA_API_KEY,
                    },
                )
            data = resp.json()
            if "code" not in data or data["code"] == 200:
                candles = [
                    {
                        "time": bar["datetime"],
                        "open": float(bar["open"]),
                        "high": float(bar["high"]),
                        "low": float(bar["low"]),
                        "close": float(bar["close"]),
                        "volume": int(bar["volume"]),
                    }
                    for bar in reversed(data.get("values", []))
                ]
                return {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": False}
        except Exception:
            pass  # fall through to mock

    candles = _mock_candles(symbol, interval)
    return {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": True}


# ── Alpha Vantage helpers ─────────────────────────────────────────────────────

async def get_news_sentiment(ticker: str) -> list:
    if not AV_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                AV_BASE_URL,
                params={"function": "NEWS_SENTIMENT", "tickers": ticker, "limit": 5, "apikey": AV_API_KEY},
            )
        data = resp.json()
        return [item["title"] for item in data.get("feed", [])[:5] if "title" in item]
    except Exception:
        return []


# ── AI Mentor ─────────────────────────────────────────────────────────────────

@app.post("/api/mentor/explain")
async def mentor_explain(body: ExplainRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    user_content = (
        f"I'm looking at the {body.interval} chart for {body.symbol}.\n\n"
        f"Here's a summary of the recent price data:\n{body.ohlc_summary}\n\n"
    )
    if body.question:
        user_content += f"My question: {body.question}"
    else:
        user_content += "Can you explain what this chart is showing me?"

    headlines = await get_news_sentiment(body.symbol)
    if headlines:
        user_content += f"\n\nRecent news context for {body.symbol}:\n" + "\n".join(f"- {h}" for h in headlines)

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_response():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=HOLO_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.post("/api/mentor/chat")
async def mentor_chat(body: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    if not body.messages:
        raise HTTPException(status_code=400, detail="messages array cannot be empty")

    system = HOLO_SYSTEM_PROMPT
    if body.context:
        ctx_parts = []
        if body.context.get("symbol"):
            ctx_parts.append(f"Current stock: {body.context['symbol']}")
        if body.context.get("interval"):
            ctx_parts.append(f"Chart interval: {body.context['interval']}")
        if body.context.get("ohlc_summary"):
            ctx_parts.append(f"Recent chart data:\n{body.context['ohlc_summary']}")
        if ctx_parts:
            system += "\n\nCurrent session context:\n" + "\n".join(ctx_parts)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_response():
        with client.messages.stream(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system,
            messages=messages,
        ) as stream:
            for text in stream.text_stream:
                yield text

    return StreamingResponse(stream_response(), media_type="text/plain")


# ── General AI (used by frontend simulator features) ─────────────────────────

HoloTrade_SYSTEM_PROMPT = """You are HoloTrade, a friendly AI financial assistant built into a stock trading simulator.
Your role is to educate beginner investors clearly and encouragingly.
Never give direct financial advice or predict stock prices.
Focus on explaining concepts and analyzing past data.
This is for educational purposes only — not financial advice."""


@app.post("/api/ai/ask")
async def ai_ask(body: AskRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    user_content = body.prompt
    if body.context:
        user_content = f"Context: {body.context}\n\n{body.prompt}"

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=HoloTrade_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_content}],
    )
    return {"response": message.content[0].text}


@app.post("/api/ai/news")
async def ai_news():
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    prompt = """Generate 5 realistic but fictional stock market news articles for today.
Return a JSON array where each object has exactly these keys:
- "id": unique string like "news-1"
- "title": engaging headline string
- "source": fictional outlet name like "MarketPulse Daily"
- "summary": 2-3 sentence string
- "publishedAt": ISO date string for today
- "url": placeholder string "#"

Return ONLY the raw JSON array — no markdown, no code fences, no extra text."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1].lstrip("json").strip() if len(parts) > 1 else raw

    try:
        return json.loads(raw)
    except Exception:
        return []

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Internal server error. Please try again later."},
    )


@app.get("/api/mentor/lessons")
async def mentor_lessons(completedIds: Optional[str] = Query(default=None), limit: int = Query(default=3, ge=1, le=20)):
    try:
        completed_list = [item.strip() for item in (completedIds or "").split(",") if item.strip()]
        completed_set = set(completed_list)
        available = [lesson for lesson in LESSON_CATALOG if lesson["id"] not in completed_set]
        return available[:limit]
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={"success": False, "message": "Error fetching lessons: %s" % str(exc)},
        )
