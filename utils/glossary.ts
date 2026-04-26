export const GLOSSARY: Record<string, string> = {
  'OHLC':           'Open, High, Low, Close — the four price points that define a single candlestick bar.',
  'Open':           'The price at which a stock first traded when the market opened for that period.',
  'High':           'The highest price a stock reached during a trading period.',
  'Low':            'The lowest price a stock reached during a trading period.',
  'Close':          'The final price at which a stock traded when the market closed for that period.',
  'Volume':         'The number of shares traded during a period. High volume often signals strong conviction behind a price move.',
  'Volatility':     "How much a stock's price fluctuates. High volatility means larger, faster swings — more potential gain and more risk.",
  'Candlestick':    "A chart element showing a stock's open, high, low, and close for a time period. The body shows the open-to-close range; the wicks show extreme prices.",
  'Bull candle':    'A green candlestick where the close is higher than the open — buyers were in control that period.',
  'Bear candle':    'A red candlestick where the close is lower than the open — sellers were in control that period.',
  'Moving Average': "The average of a stock's price over a set number of past periods, smoothing out short-term noise to reveal the underlying trend.",
  'Support':        'A price level where a stock has historically stopped falling and bounced back — buyers tend to step in here.',
  'Resistance':     'A price level where a stock has historically struggled to rise above — sellers tend to step in here.',
  'Intraday':       'Activity happening within a single trading day, from market open to close.',
  'Market Cap':     "Market Capitalisation — the total value of all a company's shares. Calculated as: share price × total shares outstanding.",
};

// Sorted longest-first so multi-word terms always match before their component words
export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
