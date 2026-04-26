import React, { useState, useEffect, useMemo } from 'react';
import { askAI, getPortfolioInsightPrompt } from '../../services/geminiService';
import { useAppContext } from '../../context/AppContext';
import { ChatBubbleIcon } from '../icons/ChatBubbleIcon';
import { XIcon } from '../icons/XIcon';

// Renders the AI analysis, parsing the markdown-like format from the Gemini API response.
const AnalysisContent: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;

    if (!text.includes('### ')) {
        return <p className="text-foreground text-sm whitespace-pre-wrap">{text}</p>;
    }

    const sections = text.split('### ').filter(s => s.trim() !== '');

    return (
        <div className="text-foreground text-sm prose prose-invert max-w-none">
            {sections.map((section, index) => {
                const parts = section.split('\n');
                const title = parts[0].trim();
                const content = parts.slice(1).join('\n').trim();
                return (
                    <div key={index} className={index > 0 ? "mt-4" : ""}>
                        <h3>{title}</h3>
                        <p className="mt-1 whitespace-pre-wrap">{content}</p>
                    </div>
                )
            })}
        </div>
    )
}

interface PortfolioInsightModalProps {
    onClose: () => void;
}

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

export const PortfolioInsightModal: React.FC<PortfolioInsightModalProps> = ({ onClose }) => {
    const { state, dispatch } = useAppContext();
    // FIX: Corrected property name from `user` to `currentUser` to match AppState, and added null-safety checks below.
    const { currentUser: user, marketData, lastAnalysisTime, portfolioAnalysisCache } = state;
    const [analysis, setAnalysis] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const { portfolioValue, totalPandL } = useMemo(() => {
        if (!user) return { portfolioValue: 0, totalPandL: 0 };
        const portfolioValue = user.portfolio.reduce((acc, item) => {
            const currentPrice = marketData[item.stock.symbol] || item.stock.price;
            return acc + (currentPrice * item.shares);
        }, 0);
        const totalCost = user.portfolio.reduce((acc, item) => acc + item.avgCost * item.shares, 0);
        return { portfolioValue, totalPandL: portfolioValue - totalCost };
    }, [user, marketData]);

    useEffect(() => {
        if (!user) return;
        const now = Date.now();
        const isCacheValid = lastAnalysisTime && (now - lastAnalysisTime < CACHE_DURATION) && portfolioAnalysisCache;

        const fetchAnalysis = async () => {
            setIsLoading(true);
            if (user.portfolio.length === 0) {
                const noStocksMessage = "You don't have any stocks in your portfolio yet. Buy some stocks to get personalized insights!";
                setAnalysis(noStocksMessage);
                dispatch({ type: 'SET_PORTFOLIO_ANALYSIS', payload: { analysis: noStocksMessage } });
                setIsLoading(false);
                return;
            };
            
            const prompt = getPortfolioInsightPrompt(user, portfolioValue, totalPandL);
            const result = await askAI(prompt);
            setAnalysis(result);
            dispatch({ type: 'SET_PORTFOLIO_ANALYSIS', payload: { analysis: result } });
            setIsLoading(false);
        };

        if (isCacheValid) {
            setAnalysis(portfolioAnalysisCache!);
            setIsLoading(false);
        } else {
            fetchAnalysis();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, portfolioValue, totalPandL]);
    
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl border border-slate-800 animate-slide-in-up relative flex flex-col">
                <button 
                    onClick={onClose} 
                    className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
                    aria-label="Close"
                >
                    <XIcon className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold mb-4 flex items-center flex-shrink-0">
                    <ChatBubbleIcon className="w-6 h-6 mr-3 text-accent" />
                    Portfolio Insights
                </h2>
                
                <div className="bg-secondary/50 p-4 rounded-lg my-4 border border-slate-700 max-h-[50vh] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center min-h-[150px]">
                            <p className="text-muted-foreground text-sm animate-pulse">Tyche is analyzing your portfolio...</p>
                        </div>
                    ) : (
                       <div className="pr-2">
                             <AnalysisContent text={analysis} />
                       </div>
                    )}
                </div>

                <div className="flex justify-end mt-auto flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};