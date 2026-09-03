import { Box, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { JourneyStats } from '../../lib/journeyStats';
import { formatCoords } from '../../lib/coords';
import { Typewriter } from './Typewriter';

type Props = {
  stats: JourneyStats;
  /** Colour behind the globe — the scrim fades into it so the type stays readable. */
  scrim: string;
};

/**
 * Where the journey stands, down the left of the globe.
 *
 * Deliberately not a panel: a soft vignette in the space colour carries the text
 * instead of a card, so the corner reads as part of the map rather than as one more
 * piece of UI — and so the page never starts to look like a cockpit. Every line is
 * real trip data or it doesn't render.
 *
 * The registers are split on purpose. The day is editorial — serif, large, the
 * sentence you'd say out loud. The stamp and the figures under the rule are
 * monospace, because they are readings: a leg number, a date, a distance, a
 * position. Nothing else on the site borrows the technical voice.
 */
export function GlobeHud({ stats, scrim }: Props) {
  const { t, i18n } = useTranslation();
  const { day, countdown, current, origin, km, country } = stats;

  const headline =
    day !== null
      ? t('globe.hud.day', { n: day })
      : countdown !== null
        ? t('globe.hud.countdown', { count: countdown })
        : null;

  // A log entry's header: which country of the route, and the date it is read on.
  const stamp = [
    country !== null ? t('globe.hud.country', { n: String(country).padStart(2, '0') }) : null,
    new Date().toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }),
  ]
    .filter(Boolean)
    .join(' · ');

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
  const coords = place ? formatCoords(place.lat, place.lng, i18n.language) : null;

  if (!headline && !where) return null;

  const micro = { letterSpacing: '0.18em' } as const;

  return (
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        maxWidth: 'min(24rem, 70vw)',
        padding: '16px 52px 52px 22px',
        pointerEvents: 'none',
        background: `radial-gradient(120% 130% at 0% 0%, color-mix(in srgb, ${scrim} 82%, transparent), transparent 74%)`,
        textShadow: `0 1px 12px ${scrim}`,
      }}
    >
      <Text ff="monospace" fz={10} c="var(--app-hud-muted)" tt="uppercase" mb={6} style={micro}>
        {stamp}
      </Text>

      {headline && (
        <Text ff="heading" fw={600} lh={1.05} fz="clamp(1.5rem, 3.2vw, 2.15rem)">
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
        <Text ff="monospace" fz={11} c="var(--app-hud-muted)" mt={4} lh={1.45}>
          {distance}
        </Text>
      )}

      {coords && (
        <>
          {/* The rule is the only piece of chrome here, and it carries the signature
              amber: it separates the sentence above from the readings below. */}
          <Box mt={14} mb={8} style={{ width: 30, height: 2, background: 'var(--app-accent)' }} />
          <Text ff="monospace" fz={10} c="var(--app-hud-muted)" tt="uppercase" mb={3} style={micro}>
            {t('globe.hud.coordinates')}
          </Text>
          <Text ff="monospace" fz={11} lh={1.5} c="var(--app-hud-muted)">
            {coords.lat}
            <br />
            {coords.lng}
          </Text>
        </>
      )}
    </Box>
  );
}
