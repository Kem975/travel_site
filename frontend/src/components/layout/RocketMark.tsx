import { useId } from 'react';

/**
 * The site mark: a red-and-white chequered rocket, sitting beside the name like an
 * emoji would. Drawn rather than borrowed — it nods at the Tintin silhouette the
 * name refers to without reproducing Hergé's artwork.
 *
 * Sized in `em` so it tracks whatever heading it is set next to, and outlined in
 * `currentColor` so the same drawing works on the cream and the midnight ground.
 */
export function RocketMark({ height = '1.2em' }: { height?: string }) {
  // A clip path needs a document-unique id, and the mark appears more than once.
  // useId's colons are legal in an id but awkward inside url(#…), so strip them.
  const clip = `rocket-hull-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const hull = 'M18 2C22.6 8 28 14.6 28 21v23l-2.5 7h-15L8 44V21C8 14.6 13.4 8 18 2Z';
  const nose = 'M18 2C22.6 8 28 14.6 28 21H8C8 14.6 13.4 8 18 2Z';

  return (
    <svg
      viewBox="0 0 36 60"
      role="img"
      aria-hidden="true"
      focusable="false"
      style={{ height, width: 'auto', flex: 'none', transform: 'translateY(0.12em)' }}
    >
      <clipPath id={clip}>
        <path d={hull} />
      </clipPath>
      {/* Fins first: they belong behind the hull, and the taper hides their inner edge. */}
      <path d="M8 29 1 52h7Z" fill="#C0392B" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M28 29l7 23h-7Z" fill="#C0392B" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <path d={hull} fill="#FBF7EF" />
      <g clipPath={`url(#${clip})`} fill="#C0392B">
        <path d={nose} />
        <rect x="8" y="21" width="10" height="7.5" />
        <rect x="18" y="28.5" width="10" height="7.5" />
        <rect x="8" y="36" width="10" height="7.5" />
        <rect x="18" y="43.5" width="10" height="7.5" />
      </g>
      <path d={hull} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
