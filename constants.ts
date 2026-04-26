import { Stock, Lesson, PortfolioItem } from './types';

export const STARTING_BALANCE = 10000;

// Prices and daily changes updated to be more realistic as of late 2023/early 2024 for a better simulation.
export const MOCK_STOCKS: Stock[] = [
  // Technology
  { symbol: 'AAPL', name: 'Apple Inc.', price: 191.56, open: 192.20, previousClose: 192.53 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 153.21, open: 152.80, previousClose: 152.05 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', price: 410.65, open: 408.90, previousClose: 409.72 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 175.00, open: 176.10, previousClose: 176.57 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', price: 177.77, open: 180.50, previousClose: 182.63 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 478.10, open: 475.20, previousClose: 471.65 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', price: 345.80, open: 342.10, previousClose: 341.06 },
  { symbol: 'IBM', name: 'IBM', price: 163.55, open: 164.10, previousClose: 164.89 },
  { symbol: 'ORCL', name: 'Oracle Corporation', price: 115.30, open: 116.00, previousClose: 116.49 },
  { symbol: 'ADBE', name: 'Adobe Inc.', price: 615.45, open: 610.00, previousClose: 608.21 },
  { symbol: 'CRM', name: 'Salesforce, Inc.', price: 255.10, open: 253.80, previousClose: 252.99 },
  { symbol: 'INTC', name: 'Intel Corporation', price: 44.50, open: 44.80, previousClose: 45.12 },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', price: 140.20, open: 138.90, previousClose: 138.25 },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', price: 49.80, open: 50.10, previousClose: 50.25 },
  { symbol: 'SAP', name: 'SAP SE', price: 162.70, open: 161.50, previousClose: 160.44 },

  // Finance
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', price: 170.25, open: 171.00, previousClose: 171.58 },
  { symbol: 'V', name: 'Visa Inc.', price: 260.40, open: 259.80, previousClose: 258.11 },
  { symbol: 'BAC', name: 'Bank of America Corp', price: 33.15, open: 33.50, previousClose: 33.84 },
  { symbol: 'WFC', name: 'Wells Fargo & Company', price: 49.50, open: 49.20, previousClose: 48.95 },
  { symbol: 'GS', name: 'The Goldman Sachs Group, Inc.', price: 385.60, open: 388.00, previousClose: 390.10 },
  { symbol: 'C', name: 'Citigroup Inc.', price: 99.47, open: 101.20, previousClose: 101.50 },
  { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', price: 398.70, open: 395.80, previousClose: 395.21 },
  { symbol: 'AXP', name: 'American Express Company', price: 189.30, open: 188.50, previousClose: 187.66 },
  { symbol: 'SCHW', name: 'The Charles Schwab Corporation', price: 68.40, open: 67.90, previousClose: 67.50 },

  // Healthcare
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 160.10, open: 161.20, previousClose: 161.85 },
  { symbol: 'PFE', name: 'Pfizer Inc.', price: 29.45, open: 29.80, previousClose: 30.10 },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', price: 530.90, open: 528.00, previousClose: 525.19 },
  { symbol: 'LLY', name: 'Eli Lilly and Company', price: 620.50, open: 615.00, previousClose: 612.88 },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', price: 118.75, open: 119.10, previousClose: 119.45 },
  { symbol: 'ABBV', name: 'AbbVie Inc.', price: 162.30, open: 161.80, previousClose: 160.50 },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', price: 545.60, open: 542.10, previousClose: 540.80 },
  
  // Consumer Discretionary
  { symbol: 'NKE', name: 'NIKE, Inc.', price: 122.30, open: 123.00, previousClose: 123.50 },
  { symbol: 'MCD', name: 'McDonald\'s Corporation', price: 295.80, open: 294.50, previousClose: 293.10 },
  { symbol: 'SBUX', name: 'Starbucks Corporation', price: 107.40, open: 106.80, previousClose: 106.20 },
  { symbol: 'HD', name: 'The Home Depot, Inc.', price: 350.10, open: 348.00, previousClose: 347.90 },
  { symbol: 'LOW', name: 'Lowe\'s Companies, Inc.', price: 230.60, open: 228.90, previousClose: 227.50 },
  { symbol: 'F', name: 'Ford Motor Company', price: 12.15, open: 12.25, previousClose: 12.35 },
  { symbol: 'GM', name: 'General Motors Company', price: 36.50, open: 36.80, previousClose: 37.10 },
  
  // Consumer Staples
  { symbol: 'WMT', name: 'Walmart Inc.', price: 165.25, open: 164.80, previousClose: 164.30 },
  { symbol: 'PG', name: 'Procter & Gamble Co.', price: 158.90, open: 159.20, previousClose: 159.50 },
  { symbol: 'KO', name: 'The Coca-Cola Company', price: 61.20, open: 61.50, previousClose: 61.80 },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', price: 175.40, open: 174.90, previousClose: 174.20 },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', price: 660.00, open: 658.10, previousClose: 655.90 },
  { symbol: 'TGT', name: 'Target Corporation', price: 142.80, open: 141.50, previousClose: 140.90 },
  
  // Industrials
  { symbol: 'BA', name: 'The Boeing Company', price: 260.50, open: 258.90, previousClose: 257.40 },
  { symbol: 'CAT', name: 'Caterpillar Inc.', price: 295.10, open: 293.80, previousClose: 292.60 },
  { symbol: 'HON', name: 'Honeywell International Inc.', price: 205.75, open: 204.90, previousClose: 203.80 },
  { symbol: 'UPS', name: 'United Parcel Service, Inc.', price: 160.00, open: 158.80, previousClose: 157.90 },
  { symbol: 'LMT', name: 'Lockheed Martin Corporation', price: 455.25, open: 453.90, previousClose: 452.70 },

  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', price: 102.60, open: 103.10, previousClose: 103.50 },
  { symbol: 'CVX', name: 'Chevron Corporation', price: 150.40, open: 151.20, previousClose: 151.80 },

  // Communication Services
  { symbol: 'DIS', name: 'The Walt Disney Company', price: 92.15, open: 91.80, previousClose: 91.50 },
  { symbol: 'VZ', name: 'Verizon Communications Inc.', price: 38.50, open: 38.20, previousClose: 38.10 },
  { symbol: 'T', name: 'AT&T Inc.', price: 17.20, open: 17.10, previousClose: 17.00 },
  { symbol: 'NFLX', name: 'Netflix, Inc.', price: 485.50, open: 483.20, previousClose: 480.90 },
];

export const MOCK_LESSONS: Lesson[] = [
  {
    id: 'l1',
    title: 'What is a Stock?',
    difficulty: 'Beginner',
    content: 'A stock (also known as equity) is a security that represents the ownership of a fraction of a corporation. This entitles the owner of the stock to a proportion of the corporation\'s assets and profits equal to how much stock they own. Units of stock are called "shares."',
  },
  {
    id: 'l2',
    title: 'How to Read Stock Charts',
    difficulty: 'Beginner',
    content: 'Stock charts track the price of a stock over a set period of time. The y-axis (vertical) represents the price, and the x-axis (horizontal) represents time. Line charts are the simplest, showing the closing price over time. Candlestick charts provide more information, including the open, high, low, and close prices for each period.',
  },
  {
    id: 'l3',
    title: 'Understanding Market Cap',
    difficulty: 'Intermediate',
    content: 'Market capitalization, or "market cap," is the total value of a company\'s outstanding shares of stock. It\'s calculated by multiplying the company\'s share price by the number of shares outstanding. It\'s a common metric used to determine a company\'s size.',
  },
];

export const MOCK_INITIAL_PORTFOLIO: PortfolioItem[] = [
    {
        stock: MOCK_STOCKS[0],
        shares: 10,
        avgCost: 165.50
    },
    {
        stock: MOCK_STOCKS[2],
        shares: 5,
        avgCost: 320.10
    }
]
