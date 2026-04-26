import React from "react";
import { ChatBubbleIcon } from "../icons/ChatBubbleIcon";

interface FloatingInsightButtonProps {
  onClick: () => void;
}

export const FloatingInsightButton: React.FC<FloatingInsightButtonProps> = ({
  onClick,
}) => {
  const title = "Holo At a Glance: Your Quick Market Insights";

  return (
    <button
      onClick={onClick}
      className="fixed bottom-20 sm:bottom-6 right-6 bg-accent text-accent-foreground rounded-full p-4 shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background transition-all duration-300 z-40 hover:bg-accent/90 hover:scale-110"
      aria-label={title}
      title={title}
    >
      <ChatBubbleIcon className="w-8 h-8" />
    </button>
  );
};
