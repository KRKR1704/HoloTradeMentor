import { Lesson } from './types';

export const STARTING_BALANCE = 10000;

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
