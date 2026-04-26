import { NewsArticle } from '../types';
import { generateRealTimeNews } from './aiService';

export const getMarketNews = async (): Promise<NewsArticle[]> => {
  // This function now directly calls the Anthropic AI service to get real-time news.
  // Error handling is managed by the component calling this function.
  return await generateRealTimeNews();
};
