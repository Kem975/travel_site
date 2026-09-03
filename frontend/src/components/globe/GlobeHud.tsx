import { Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { JourneyStats } from '../../lib/journeyStats';
import { Typewriter } from './Typewriter';

type Props = {
  stats: JourneyStats;
  /** Colour behind the globe — the scrim fades into it so the type stays readable. */
  scrim: string;
};

/**
 * Where the journey stands, over the top-left of the globe.
 *
 * Deliberately not a panel: a soft vignette in the space colour carries the text
 * instead of a card, so the corner reads as part of the map rather than as one more
 * piece of UI. Every line is real trip data or it doesn't render.
 */
export function GlobeHud({ stats, scrim }: Props) {
  const { t, i18n } = useTranslation();
  const { day, countdown, current, origin, km } = stats;

  // Zero-padded to three digits: a mission counter reads 003, not 3, and the
  // width stops the line from jumping as the journey moves into double figures.
  const headline =
    day !== null
      ? t('globe.hud.day', { n: String(day).padStart(3, '0') })
      : countdown !== null
        ? t('globe.hud.countdown', { count: countdown })
        : null;

  // Before departure there is no current stop, so the origin is the place to name.
  const place = current ?? (countdown !== null ? origin : null);
  const where = place ? [place.title, place.country].filter(Boolean).join(', ') : null;

  // Under a kilometre means the route hasn't really left the first stop — no line.
  const distance =
    km !== null && km >= 1 && origin
      ? t('globe.hud.distance', {
          km: Math.round(km).toLocaleString(i18n.language),
          origin: origin.title,
        })
      : null;

  if (!headline && !where) return null;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        maxWidth: 'min(22rem, 66vw)',
        padding: '18px 52px 52px 22px',
        pointerEvents: 'none',
        background: `radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, ${scrim} 80%, transparent), transparent 72%)`,
        textShadow: `0 1px 12px ${scrim}`,
      }}
    >
      {headline && (
        <Text
          ff="monospace"
          fw={600}
          lh={1.05}
          tt="uppercase"
          fz="clamp(1.15rem, 2.4vw, 1.65rem)"
          style={{ letterSpacing: '0.1em' }}
        >
          {/* Keyed on the text so a language switch retypes rather than freezing
              half-written. */}
          <Typewriter key={headline} text={headline} />
        </Text>
      )}
      {where && (
        <Text fz="sm" mt={6} lh={1.3}>
          {where}
        </Text>
      )}
      {distance && (
        <Text fz="xs" c="dimmed" mt={2} style={{ letterSpacing: '0.04em' }}>
          {distance}
        </Text>
      )}
    </Box>
  );
}
