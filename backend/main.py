import os
import json
import time
import asyncio
import random
import hashlib
import httpx
import anthropic
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime, timezone, timedelta

load_dotenv()

FINNHUB_API_KEY  = os.getenv("FINNHUB_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
AV_API_KEY        = os.getenv("AV_API_KEY")

FINNHUB_BASE = "https://finnhub.io/api/v1"
AV_BASE_URL  = "https://www.alphavantage.co/query"

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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ───────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    symbol: str
    interval: str
    ohlc_summary: str
    question: Optional[str] = None


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: Optional[dict] = {}


class AskRequest(BaseModel):
    prompt: str
    context: Optional[str] = None


# ── Mock data fallback ────────────────────────────────────────────────────────
# Used when Finnhub API key is absent or returns an error.

_BASE_PRICES = {
    "AAPL": 185.0, "MSFT": 415.0, "NVDA": 875.0, "TSLA": 250.0,
    "ORCL": 165.0, "META": 550.0, "GOOGL": 175.0, "AMZN": 205.0,
    "NFLX": 620.0, "AMD":  160.0, "INTC":  30.0,  "CRM":  290.0,
}

_COMPANY_NAMES = {
    "AAPL": "Apple Inc.",            "MSFT": "Microsoft Corp.",
    "NVDA": "NVIDIA Corp.",          "TSLA": "Tesla Inc.",
    "ORCL": "Oracle Corp.",          "META": "Meta Platforms",
    "GOOGL": "Alphabet Inc.",        "AMZN": "Amazon.com Inc.",
    "NFLX": "Netflix Inc.",          "AMD":  "Advanced Micro Devices",
    "INTC": "Intel Corp.",           "CRM":  "Salesforce Inc.",
}


def _seed_for(symbol: str) -> int:
    return int(hashlib.md5(symbol.upper().encode()).hexdigest(), 16) % (2 ** 32)


def _mock_candles(symbol: str, interval: str) -> list:
    count = 78 if interval == "5min" else 90
    rng   = random.Random(_seed_for(symbol))
    base  = _BASE_PRICES.get(symbol.upper(), 100.0)
    price = base * rng.uniform(0.85, 1.15)
    now   = datetime.utcnow()
    candles = []
    for i in range(count - 1, -1, -1):
        if interval == "1day":
            dt       = now - timedelta(days=i)
            time_str = dt.strftime("%Y-%m-%d")
        else:
            dt       = now - timedelta(minutes=i * 5)
            time_str = dt.strftime("%Y-%m-%d %H:%M:%S")

        pct     = rng.gauss(0.0005, 0.014)
        open_p  = price
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
    last    = candles[-1]
    prev    = candles[-2] if len(candles) > 1 else last
    change  = round(last["close"] - prev["close"], 2)
    pct     = round(change / prev["close"] * 100, 2) if prev["close"] else 0.0
    return {
        "symbol":         symbol.upper(),
        "name":           _COMPANY_NAMES.get(symbol.upper(), symbol.upper()),
        "price":          str(last["close"]),
        "change":         str(change),
        "change_percent": str(pct),
        "volume":         str(last["volume"]),
        "is_market_open": True,
        "is_mock":        True,
    }


# ── Caches ───────────────────────────────────────────────────────────────────
# profile2 data changes at most once a day — cache for 1 hour to save API calls.

_PROFILE_CACHE: dict[str, tuple[float, dict]] = {}
PROFILE_CACHE_TTL = 3600  # seconds

# News: general market and per-symbol — cache for 15 minutes
_NEWS_CACHE: dict[str, tuple[float, list]] = {}
NEWS_CACHE_TTL  = 15 * 60  # seconds
NEWS_MAX_AGE    = 7 * 24 * 60 * 60  # 7 days in seconds


def _map_finnhub_article(item: dict) -> dict:
    """Normalise a single Finnhub news item to our API shape."""
    ts = item.get("datetime", 0)
    try:
        published_at = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        published_at = datetime.now(tz=timezone.utc).isoformat()

    image = item.get("image") or None
    if image == "":
        image = None

    return {
        "id":           str(item.get("id", "")),
        "title":        item.get("headline", ""),
        "source":       item.get("source", ""),
        "summary":      item.get("summary", ""),
        "url":          item.get("url") or "#",
        "image":        image,
        "publishedAt":  published_at,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── News ─────────────────────────────────────────────────────────────────────

@app.get("/api/news")
async def get_market_news():
    """General market news — last 7 days, cached 15 min."""
    cache_key = "__general__"
    now = time.time()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < NEWS_CACHE_TTL:
        return cached[1]

    if FINNHUB_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/news",
                    params={"category": "general", "token": FINNHUB_API_KEY},
                )
            items = resp.json()
            if not isinstance(items, list):
                raise ValueError(f"Unexpected response: {items}")

            cutoff   = now - NEWS_MAX_AGE
            articles = []
            for item in items:
                if item.get("datetime", 0) < cutoff:
                    continue
                articles.append(_map_finnhub_article(item))
                if len(articles) >= 20:
                    break

            _NEWS_CACHE[cache_key] = (now, articles)
            return articles

        except Exception:
            pass  # fall through to empty list

    return []


@app.get("/api/news/{symbol}")
async def get_stock_news(symbol: str):
    """Company-specific news — last 7 days, cached 15 min per symbol."""
    cache_key = f"stock:{symbol.upper()}"
    now = time.time()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < NEWS_CACHE_TTL:
        return cached[1]

    if FINNHUB_API_KEY:
        try:
            to_date   = datetime.now().strftime("%Y-%m-%d")
            from_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/company-news",
                    params={
                        "symbol": symbol,
                        "from":   from_date,
                        "to":     to_date,
                        "token":  FINNHUB_API_KEY,
                    },
                )
            items = resp.json()
            if not isinstance(items, list):
                raise ValueError(f"Unexpected response: {items}")

            cutoff   = now - NEWS_MAX_AGE
            articles = []
            for item in items:
                if item.get("datetime", 0) < cutoff:
                    continue
                articles.append(_map_finnhub_article(item))
                if len(articles) >= 15:
                    break

            _NEWS_CACHE[cache_key] = (now, articles)
            return articles

        except Exception:
            pass

    return []


# ── Symbol Search ─────────────────────────────────────────────────────────────

@app.get("/api/search")
async def search_symbols(query: str = ""):
    if not query.strip():
        return []

    if FINNHUB_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/search",
                    params={"q": query, "token": FINNHUB_API_KEY},
                )
            data = resp.json()

            results = []
            for item in data.get("result", []):
                item_type = item.get("type", "")
                if item_type not in ("Common Stock", "ETP"):
                    continue

                sym      = item.get("symbol", "")
                has_dot  = "." in sym   # Finnhub uses dots for non-US exchanges
                exchange = "NSE/BSE — may have limited data" if has_dot else ""

                results.append({
                    "symbol":         sym,
                    "name":           item.get("description", sym),
                    "display_symbol": item.get("displaySymbol", sym),
                    "exchange":       exchange,
                    "type":           item_type,
                })

                if len(results) >= 8:
                    break

            return results

        except Exception:
            pass  # fall through to mock

    # Mock fallback: fuzzy match against known symbols/names
    q = query.upper()
    results = []
    for sym, name in _COMPANY_NAMES.items():
        if q in sym or q in name.upper():
            results.append({
                "symbol":         sym,
                "name":           name,
                "display_symbol": sym,
                "exchange":       "NASDAQ",
                "type":           "Common Stock",
            })
    return results[:8]


# ── Market Data ───────────────────────────────────────────────────────────────

@app.get("/api/quote/{symbol}")
async def get_quote(symbol: str):
    if FINNHUB_API_KEY:
        try:
            now = time.time()
            cached = _PROFILE_CACHE.get(symbol.upper())
            profile_fresh = cached and (now - cached[0]) < PROFILE_CACHE_TTL

            async with httpx.AsyncClient(timeout=8.0) as client:
                if profile_fresh:
                    # Profile already cached — only hit the quote endpoint
                    q_resp = await client.get(
                        f"{FINNHUB_BASE}/quote",
                        params={"symbol": symbol, "token": FINNHUB_API_KEY},
                    )
                    profile = cached[1]
                else:
                    # Fetch quote + profile in parallel
                    q_resp, p_resp = await asyncio.gather(
                        client.get(f"{FINNHUB_BASE}/quote",
                                   params={"symbol": symbol, "token": FINNHUB_API_KEY}),
                        client.get(f"{FINNHUB_BASE}/stock/profile2",
                                   params={"symbol": symbol, "token": FINNHUB_API_KEY}),
                    )
                    profile = p_resp.json()
                    _PROFILE_CACHE[symbol.upper()] = (now, profile)

            q = q_resp.json()

            # Finnhub returns c=0 for unknown symbols
            if not q.get("c"):
                raise ValueError(f"No quote data for {symbol!r}")

            return {
                "symbol":         symbol.upper(),
                "name":           profile.get("name") or symbol.upper(),
                "exchange":       profile.get("exchange", ""),
                "logo":           profile.get("logo", ""),
                "market_cap":     profile.get("marketCapitalization"),
                "price":          str(round(float(q["c"]), 4)),
                "change":         str(round(float(q.get("d")  or 0), 4)),
                "change_percent": str(round(float(q.get("dp") or 0), 4)),
                "high":           str(round(float(q.get("h")  or 0), 4)),
                "low":            str(round(float(q.get("l")  or 0), 4)),
                "open":           str(round(float(q.get("o")  or 0), 4)),
                "prev_close":     str(round(float(q.get("pc") or 0), 4)),
                # Finnhub /quote does not expose volume — omit so frontend hides the field
                "volume":         None,
                "is_market_open": True,
                "is_mock":        False,
            }

        except Exception:
            pass  # fall through to mock

    return _mock_quote(symbol)


@app.get("/api/candles/{symbol}")
async def get_candles(symbol: str, interval: str = "1day"):
    if interval not in ("5min", "1day"):
        raise HTTPException(status_code=400, detail="interval must be '5min' or '1day'")

    if FINNHUB_API_KEY:
        try:
            to_ts = int(time.time())

            if interval == "5min":
                from_ts    = to_ts - (2 * 24 * 60 * 60)   # last 2 days → plenty of 5-min bars
                resolution = "5"
            else:  # 1day
                from_ts    = to_ts - (180 * 24 * 60 * 60)  # last 6 months of daily bars
                resolution = "D"

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{FINNHUB_BASE}/stock/candle",
                    params={
                        "symbol":     symbol,
                        "resolution": resolution,
                        "from":       from_ts,
                        "to":         to_ts,
                        "token":      FINNHUB_API_KEY,
                    },
                )
            data = resp.json()

            if data.get("s") != "ok":
                raise ValueError(
                    f"Finnhub returned s={data.get('s')!r} for {symbol} ({interval})"
                )

            timestamps = data["t"]
            opens      = data["o"]
            highs      = data["h"]
            lows       = data["l"]
            closes     = data["c"]
            volumes    = data.get("v", [])

            candles = []
            for i, ts in enumerate(timestamps):
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                time_str = (
                    dt.strftime("%Y-%m-%d")
                    if interval == "1day"
                    else dt.strftime("%Y-%m-%d %H:%M:%S")
                )
                candles.append({
                    "time":   time_str,
                    "open":   round(float(opens[i]),  4),
                    "high":   round(float(highs[i]),  4),
                    "low":    round(float(lows[i]),   4),
                    "close":  round(float(closes[i]), 4),
                    "volume": int(volumes[i]) if i < len(volumes) else 0,
                })

            return {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": False}

        except Exception:
            pass  # fall through to mock

    candles = _mock_candles(symbol, interval)
    return {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": True}


# ── Alpha Vantage news helper (optional enrichment for Holo) ──────────────────

async def get_news_sentiment(ticker: str) -> list:
    if not AV_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                AV_BASE_URL,
                params={
                    "function": "NEWS_SENTIMENT",
                    "tickers":  ticker,
                    "limit":    5,
                    "apikey":   AV_API_KEY,
                },
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
        user_content += (
            f"\n\nRecent news context for {body.symbol}:\n"
            + "\n".join(f"- {h}" for h in headlines)
        )

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
    client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

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


# ── General AI (portfolio features) ──────────────────────────────────────────

HOLOTRADE_SYSTEM_PROMPT = """You are HoloTrade, a friendly AI financial assistant built into a stock trading simulator.
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

    client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=HOLOTRADE_SYSTEM_PROMPT,
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

    client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
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
