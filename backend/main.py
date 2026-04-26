import os
import json
import math
import random
import hashlib
import httpx
import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional, List
from datetime import datetime, timedelta

load_dotenv()

TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

TWELVE_DATA_BASE = "https://api.twelvedata.com"

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
    allow_origins=["http://localhost:3000"],
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
