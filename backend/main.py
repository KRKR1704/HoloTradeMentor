import os
import re
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

HOLO_SYSTEM_PROMPT = """You are Holo, a personal stock market mentor inside HoloTrade Mentor. You are coaching a complete beginner who wants to genuinely understand investing — not just get answers.

YOUR ROLE IS TO TEACH, NOT TO CHAT.

How a good mentor responds:
1. Lead with the concept, then ground it in the actual chart data in front of the user. Never explain in the abstract — always tie it to what they are currently looking at.
2. Use the Socratic method. Ask the user a question at the end of every response to make them think. Examples: "What do you notice about the last 3 candles?", "Why do you think the price fell sharply here?", "What does a long lower wick tell you about buyers and sellers?"
3. Use real-world analogies. Make finance human. A candlestick high = "the highest price anyone agreed to pay all day — like the peak bid at an auction." Support = "a price floor where buyers keep stepping in, like a sale price that keeps attracting shoppers."
4. Structure every response as a mini-lesson: concept → what it looks like here → why it matters for investors → question or challenge for the user.
5. Give the user micro-challenges: "Try switching to the 5-min view and tell me if the trend looks different", "Look at the candle from [date] — is it bullish or bearish, and why?"
6. Reference prior context. If you've explained a concept earlier in this chat, build on it rather than repeating it. Treat the conversation as a progressive curriculum.
7. Celebrate correct thinking: "Exactly right — that's called a breakout", "Good instinct — that's what a resistance level looks like."

What you NEVER do:
- Give buy or sell recommendations. If asked, redirect: "That's your call to make — I can explain the concept behind it, but I won't tell you what to do with your money."
- Give flat dictionary definitions without context. Always explain WHY the concept matters to a real investor.
- Write a wall of text. Use short paragraphs, bullet points, or numbered steps to keep lessons scannable.
- Be vague. Be specific about what you see in the chart data provided.

You are not a chatbot. You are a mentor. Every response should leave the user knowing something they didn't before AND thinking about something new."""

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
    ohlc_summary: Optional[str] = None   # optional: backend fetches from cache if absent
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


class NewsRequest(BaseModel):
    category: str = "general"


class StockNewsRequest(BaseModel):
    symbol: str
    name: str = ""


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

# Candle data — cache for 60 s so rapid page loads and HoloMentor's own candle
# fetch don't both hit Finnhub; keeps the chart feeling snappy.
_CANDLE_CACHE: dict[str, tuple[float, dict]] = {}
CANDLE_CACHE_TTL = 60  # seconds

# News cache — Claude web-search results per category/symbol, TTL 20 min
_NEWS_CACHE: dict[str, tuple[float, list]] = {}
NEWS_CACHE_TTL = 20 * 60  # seconds

NEWS_SYSTEM_PROMPT = (
    "You are a financial news summarizer for beginner investors. "
    "Always use web search to find real, current news — never fabricate stories. "
    "Be factual, neutral, and educational. Never give buy/sell recommendations. "
    "Always cite the real source publication name."
)


def _parse_news_json(raw: str) -> list:
    """Extract and parse a JSON array from Claude's response text."""
    raw = raw.strip()
    # Strip accidental markdown fences
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fence_match:
        raw = fence_match.group(1).strip()
    # Find the outermost JSON array
    arr_match = re.search(r"\[[\s\S]*\]", raw)
    if arr_match:
        return json.loads(arr_match.group(0))
    return json.loads(raw)  # last-resort full parse


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


# ── News (Claude web-search powered) ─────────────────────────────────────────

@app.post("/api/news")
async def get_market_news(body: NewsRequest):
    """General market news — Claude searches the web, cached 20 min."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    cache_key = f"general:{body.category}"
    now = time.time()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < NEWS_CACHE_TTL:
        return cached[1]

    user_message = (
        "Search the web for the latest stock market and financial news from the last "
        "24 hours. Summarize the top 6 most important stories. For each story return:\n"
        "- headline (concise, max 12 words)\n"
        "- summary (2-3 sentences, plain English, beginner friendly)\n"
        "- source (publication name)\n"
        "- relevance (one sentence on why this matters to investors)\n"
        "- sentiment: 'positive' | 'negative' | 'neutral'\n\n"
        "Respond ONLY in valid JSON array format, no markdown, no preamble:\n"
        '[{"headline":"","summary":"","source":"","relevance":"","sentiment":""}]'
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=NEWS_SYSTEM_PROMPT,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": user_message}],
        )

        raw = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )
        articles = _parse_news_json(raw)
        _NEWS_CACHE[cache_key] = (now, articles)
        return articles

    except Exception as e:
        return {"error": f"Could not fetch news: {str(e)}", "articles": []}


@app.post("/api/news/stock")
async def get_stock_news(body: StockNewsRequest):
    """Stock-specific news — Claude searches the web, cached 20 min per symbol."""
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    cache_key = f"stock:{body.symbol.upper()}"
    now = time.time()
    cached = _NEWS_CACHE.get(cache_key)
    if cached and (now - cached[0]) < NEWS_CACHE_TTL:
        return cached[1]

    display = f"{body.name} ({body.symbol})" if body.name else body.symbol
    user_message = (
        f"Search the web for the latest news about {display} stock from the last "
        "7 days. Summarize the top 5 most relevant stories for a beginner investor. "
        "For each story return:\n"
        "- headline (concise, max 12 words)\n"
        "- summary (2-3 sentences, plain English)\n"
        "- source (publication name)\n"
        "- impact (how this news might affect the stock — educational framing only, "
        "no buy/sell advice)\n"
        "- sentiment: 'positive' | 'negative' | 'neutral'\n\n"
        "Respond ONLY in valid JSON array format, no markdown, no preamble:\n"
        '[{"headline":"","summary":"","source":"","impact":"","sentiment":""}]'
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=NEWS_SYSTEM_PROMPT,
            tools=[{"type": "web_search_20250305", "name": "web_search"}],
            messages=[{"role": "user", "content": user_message}],
        )

        raw = "".join(
            block.text for block in response.content if hasattr(block, "text")
        )
        articles = _parse_news_json(raw)
        _NEWS_CACHE[cache_key] = (now, articles)
        return articles

    except Exception as e:
        return {"error": f"Could not fetch news: {str(e)}", "articles": []}


@app.delete("/api/news/cache")
async def clear_news_cache():
    """Bust the entire news cache so the next fetch is always fresh."""
    _NEWS_CACHE.clear()
    return {"cleared": True, "message": "News cache cleared"}


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

    # Serve from cache if fresh (avoids double Finnhub hit: chart + HoloMentor)
    cache_key = f"{symbol.upper()}:{interval}"
    now_ts = time.time()
    cached_candle = _CANDLE_CACHE.get(cache_key)
    if cached_candle and (now_ts - cached_candle[0]) < CANDLE_CACHE_TTL:
        return cached_candle[1]

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

            result = {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": False}
            _CANDLE_CACHE[cache_key] = (now_ts, result)
            return result

        except Exception:
            pass  # fall through to mock

    candles = _mock_candles(symbol, interval)
    result = {"symbol": symbol, "interval": interval, "candles": candles, "is_mock": True}
    _CANDLE_CACHE[cache_key] = (now_ts, result)
    return result


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


# ── OHLC summary helper (used by mentor endpoints, leverages candle cache) ─────

async def _build_ohlc_summary(symbol: str, interval: str, provided: Optional[str]) -> str:
    """Return OHLC summary text. Uses caller-supplied text if present, otherwise
    fetches from /api/candles (hits the 60-second cache when warm)."""
    if provided:
        return provided
    try:
        cache_key = f"{symbol.upper()}:{interval}"
        cached = _CANDLE_CACHE.get(cache_key)
        if cached and (time.time() - cached[0]) < CANDLE_CACHE_TTL:
            candles = cached[1].get("candles", [])
        else:
            # Fetch fresh (will also populate the cache via get_candles)
            async with httpx.AsyncClient(timeout=8.0) as hc:
                r = await hc.get(
                    f"http://localhost:8000/api/candles/{symbol}",
                    params={"interval": interval},
                )
            candles = r.json().get("candles", []) if r.status_code == 200 else []
        last5 = candles[-5:]
        if not last5:
            return f"Symbol: {symbol}, Interval: {interval} (no recent data)"
        rows = "\n".join(
            f"{c['time']}  O:${float(c['open']):.2f} H:${float(c['high']):.2f} "
            f"L:${float(c['low']):.2f} C:${float(c['close']):.2f}"
            for c in last5
        )
        return f"Last 5 candles for {symbol} ({interval}):\n{rows}"
    except Exception:
        return f"Symbol: {symbol}, Interval: {interval}"


# ── AI Mentor ─────────────────────────────────────────────────────────────────

@app.post("/api/mentor/explain")
async def mentor_explain(body: ExplainRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    # Build OHLC context (uses cache — fast if chart already loaded)
    ohlc_summary = await _build_ohlc_summary(body.symbol, body.interval, body.ohlc_summary)

    user_content = (
        f"I'm looking at the {body.interval} chart for {body.symbol}.\n\n"
        f"Here's a summary of the recent price data:\n{ohlc_summary}\n\n"
    )
    if body.question:
        user_content += f"My question: {body.question}"
    else:
        user_content += (
            "Give me a focused lesson on what this chart is showing. "
            "Pick the single most educational thing visible in this data, "
            "explain the concept clearly with an analogy, show me where I can see it "
            "in these specific candles, and end by asking me a question to check my understanding."
        )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_response():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=700,
                system=HOLO_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_content}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            yield f"\n\n⚠ Holo encountered an error: {e}"

    return StreamingResponse(stream_response(), media_type="text/plain")


@app.post("/api/mentor/chat")
async def mentor_chat(body: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    if not body.messages:
        raise HTTPException(status_code=400, detail="messages array cannot be empty")

    system = HOLO_SYSTEM_PROMPT
    if body.context:
        # Enrich system prompt with live context
        ctx_parts = []
        if body.context.get("symbol"):
            ctx_parts.append(f"Current stock: {body.context['symbol']}")
        if body.context.get("interval"):
            ctx_parts.append(f"Chart interval: {body.context['interval']}")
        # If frontend didn't send ohlc_summary, fetch from cache
        ohlc = await _build_ohlc_summary(
            body.context.get("symbol", ""),
            body.context.get("interval", "1day"),
            body.context.get("ohlc_summary"),
        )
        if ohlc:
            ctx_parts.append(f"Recent chart data:\n{ohlc}")
        if ctx_parts:
            system += "\n\nCurrent session context:\n" + "\n".join(ctx_parts)

    messages = [{"role": m.role, "content": m.content} for m in body.messages]
    client   = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_response():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=700,
                system=system,
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            yield f"\n\n⚠ Holo encountered an error: {e}"

    return StreamingResponse(stream_response(), media_type="text/plain")


# ── General AI (portfolio features) ──────────────────────────────────────────

HOLOTRADE_SYSTEM_PROMPT = """You are Holo, a personal investing mentor inside HoloTrade Mentor.
A student just made a trade. Your job is to turn it into a teaching moment — not to praise or criticise the trade itself, but to make the student understand the concept behind it.

Mentor rules:
- Identify ONE investing concept this trade illustrates (e.g. position sizing, concentration risk, realising a loss, cost averaging) and explain it clearly.
- Use the actual numbers from their trade to make the lesson concrete and personal.
- End with a single question that makes them reflect on their decision ("What % of your portfolio did this trade represent? Is that comfortable for you?").
- Keep it to 3-4 sentences max. Punchy, not preachy.
- Never recommend they reverse the trade or imply it was a mistake. Teach the concept; let them draw their own conclusions.
This is for educational purposes only — not financial advice."""


@app.post("/api/ai/ask")
async def ai_ask(body: AskRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    user_content = body.prompt
    if body.context:
        user_content = f"Context: {body.context}\n\n{body.prompt}"

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def stream_response():
        try:
            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=400,
                system=HOLOTRADE_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_content}],
            ) as stream:
                for text in stream.text_stream:
                    yield text
        except Exception as e:
            yield f"Unable to generate feedback: {e}"

    return StreamingResponse(stream_response(), media_type="text/plain")


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
