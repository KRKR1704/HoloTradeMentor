import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, GLOSSARY_TERMS } from '../utils/glossary';

interface GlossaryTooltipProps {
  term: string;
  children: React.ReactNode;
}

export const GlossaryTooltip: React.FC<GlossaryTooltipProps> = ({ term, children }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, above: true });
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Resolve definition case-insensitively
  const definition =
    GLOSSARY[term] ??
    GLOSSARY[GLOSSARY_TERMS.find((k) => k.toLowerCase() === term.toLowerCase()) ?? ''] ??
    '';

  const handleMouseEnter = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const TOOLTIP_W = 228;
    const TOOLTIP_H = 90; // rough estimate
    const GAP = 6;

    const above = r.top > TOOLTIP_H + GAP * 2;
    const x = Math.max(8, Math.min(r.left, window.innerWidth - TOOLTIP_W - 8));
    const y = above ? r.top - GAP : r.bottom + GAP;

    setCoords({ x, y, above });
    setVisible(true);
  }, []);

  // Don't render the tooltip wrapper if no definition exists
  if (!definition) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        className="underline decoration-dotted decoration-teal-400/50 cursor-help text-teal-300 hover:text-teal-200 transition-colors"
      >
        {children}
      </span>

      {visible &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none rounded-xl px-3 py-2.5 text-xs shadow-2xl"
            style={{
              left: coords.x,
              top: coords.y,
              maxWidth: 228,
              transform: coords.above ? 'translateY(-100%)' : 'translateY(0)',
              background: '#071524',
              border: '1px solid #00BFA666',
            }}
          >
            <p
              className="font-bold mb-1 tracking-wide"
              style={{ color: '#00BFA6' }}
            >
              {term}
            </p>
            <p className="text-slate-300 leading-snug">{definition}</p>
          </div>,
          document.body
        )}
    </>
  );
};
