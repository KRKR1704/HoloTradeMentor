import React from 'react';
import { GLOSSARY_TERMS } from './glossary';
import { GlossaryTooltip } from '../components/GlossaryTooltip';

// Escape special regex characters in a term string
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Lazily built so it's only compiled once
let _pattern: RegExp | null = null;
function getPattern(): RegExp {
  if (!_pattern) {
    const escaped = GLOSSARY_TERMS.map(escapeRegex);
    _pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  }
  return _pattern;
}

/**
 * Parses a string of Holo chat output and wraps recognised glossary terms
 * in <GlossaryTooltip>. Each unique term is highlighted only on its first
 * occurrence to avoid visual noise.
 */
export function parseGlossaryTerms(text: string): React.ReactNode {
  if (!text) return text;

  const pattern = getPattern();
  // Reset lastIndex because the regex is reused across calls
  pattern.lastIndex = 0;

  // split() with a capturing group returns matches interleaved with non-match segments
  const parts = text.split(pattern);

  const seen = new Set<string>();
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    const key = part.toLowerCase();
    const matchedTerm = GLOSSARY_TERMS.find((t) => t.toLowerCase() === key);

    if (matchedTerm && !seen.has(key)) {
      seen.add(key);
      nodes.push(
        <GlossaryTooltip key={i} term={matchedTerm}>
          {part}
        </GlossaryTooltip>
      );
    } else {
      // Merge consecutive plain-text segments
      const prev = nodes[nodes.length - 1];
      if (typeof prev === 'string') {
        nodes[nodes.length - 1] = prev + part;
      } else {
        nodes.push(part);
      }
    }
  }

  return nodes;
}
