import React, { useState, useEffect } from 'react';
import { askAI, getTradeFeedbackPrompt } from '../../services/geminiService';
import { Trade, User, TradeType } from '../../types';
import { ChatBubbleIcon } from '../icons/ChatBubbleIcon';

interface TradeFeedbackModalProps {
    feedbackContext: {
        trade: Trade;
        userBeforeTrade: User;
    };
    onClose: () => void;
}

export const TradeFeedbackModal: React.FC<TradeFeedbackModalProps> = ({ feedbackContext, onClose }) => {
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchFeedback = async () => {
            if (!feedbackContext) return;
            setIsLoading(true);
            const { trade, userBeforeTrade } = feedbackContext;
            const prompt = getTradeFeedbackPrompt(trade, userBeforeTrade);
            const result = await askAI(prompt);
            setFeedback(result);
            setIsLoading(false);
        };
        fetchFeedback();
    }, [feedbackContext]);

    if (!feedbackContext) return null;

    const { trade } = feedbackContext;
    const isBuy = trade.type === TradeType.BUY;
    const title = `Trade Confirmed: ${isBuy ? 'Bought' : 'Sold'} ${trade.stock.symbol}`;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl border border-slate-800 animate-slide-in-up">
                <h2 className={`text-2xl font-bold mb-2 ${isBuy ? 'text-positive' : 'text-destructive'}`}>{title}</h2>
                <p className="text-muted-foreground mb-4">
                    {trade.shares} shares at ${trade.price.toFixed(2)} each.
                </p>

                <div className="bg-secondary/50 p-3 rounded-lg my-4 border border-slate-700">
                    <h3 className="text-md font-bold text-accent flex items-center mb-2">
                        <ChatBubbleIcon className="w-5 h-5 mr-2" />
                        Tyche's Feedback
                    </h3>
                    {isLoading ? (
                        <p className="text-muted-foreground text-sm animate-pulse">Analyzing your move...</p>
                    ) : (
                        <p className="text-foreground text-sm">{feedback}</p>
                    )}
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};