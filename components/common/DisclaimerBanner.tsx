import React from 'react';

export const DisclaimerBanner: React.FC = () => (
  <div
    className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-40 flex items-center px-4 py-1.5"
    style={{
      background: '#070f1a',
      borderTop: '1px solid #1e3a4a',
      borderLeft: '3px solid #00BFA6',
    }}
  >
    <p
      className="w-full text-center text-slate-400 leading-tight truncate"
      style={{ fontSize: 11 }}
    >
      ⚠️ HoloTrade Mentor is for educational purposes only and does not constitute financial advice.
      Always consult a qualified financial advisor before investing.
    </p>
  </div>
);
