import { useEffect, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Types `text` out one character at a time, trailing a blinking caret — the
 * readout printing itself, the way a mission console would.
 *
 * The caret keeps blinking once the line is finished: it is the cursor waiting
 * for the next day, not a loading indicator. With reduced motion the whole line
 * is there immediately and the caret holds steady.
 */
export function Typewriter({ text, msPerChar = 85 }: { text: string; msPerChar?: number }) {
  const reduced = reducedMotion();
  const [shown, setShown] = useState(() => (reduced ? text.length : 0));

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      return;
    }
    setShown(0);
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar, reduced]);

  return (
    <span>
      {/* The full string stays in the accessible tree: a screen reader should read
          the day, not watch it arrive. */}
      <span aria-hidden="true">{text.slice(0, shown)}</span>
      <span className="sr-only">{text}</span>
      <span className="hud-caret" aria-hidden="true">
        _
      </span>
    </span>
  );
}
