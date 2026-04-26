import { NewsArticle } from '../types';
import { generateRealTimeNews } from './geminiService';

export const getMarketNews = async (): Promise<NewsArticle[]> => {
  // This function now directly calls the Gemini service to get real-time news.
  // Error handling is managed by the component calling this function.
  return await generateRealTimeNews();
};
