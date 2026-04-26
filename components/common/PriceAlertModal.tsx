import React, { useState, useEffect } from "react";
import {
  askAI,
  getPriceAlertExplanationPrompt,
} from "../../services/aiService";
import { PortfolioItem } from "../../types";
import { ChatBubbleIcon } from "../icons/ChatBubbleIcon";

// FIX: Defined PriceAlert interface locally as it's only used here and the component is not currently implemented in the app.
interface PriceAlert {
  item: PortfolioItem;
  newPrice: number;
}

interface PriceAlertModalProps {
  alert: PriceAlert;
  onClose: () => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  alert,
  onClose,
}) => {
  const [explanation, setExplanation] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExplanation = async () => {
      if (!alert) return;
      setIsLoading(true);
      const prompt = getPriceAlertExplanationPrompt(alert.item, alert.newPrice);
      const result = await askAI(prompt);
      setExplanation(result);
      setIsLoading(false);
    };
    fetchExplanation();
  }, [alert]);

  if (!alert) return null;

  const { item, newPrice } = alert;
  const priceChange = newPrice - item.stock.price;
  const isPositive = priceChange >= 0;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl border border-slate-800 animate-slide-in-up">
        <h2 className="text-2xl font-bold mb-2">Portfolio Update</h2>
        <p className="text-muted-foreground mb-4">
          <span className="font-bold text-foreground">{item.stock.symbol}</span>{" "}
          has moved to ${newPrice.toFixed(2)}(
          <span className={isPositive ? "text-positive" : "text-destructive"}>
            {priceChange.toFixed(2)}
          </span>
          )
        </p>

        <div className="bg-secondary/50 p-3 rounded-lg my-4 border border-slate-700">
          <h3 className="text-md font-bold text-accent flex items-center mb-2">
            <ChatBubbleIcon className="w-5 h-5 mr-2" />
            What this means
          </h3>
          {isLoading ? (
            <p className="text-muted-foreground text-sm animate-pulse">
              Analyzing the impact...
            </p>
          ) : (
            <p className="text-foreground text-sm">{explanation}</p>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};
