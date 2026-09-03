import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActionIcon, Anchor, Box, Group, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../../api/public';
import type { JourneyStop } from '../../api/public';

const GLYPH = { visited: '✓', current: '●' } as const;

/**
 * How many stops the strip is allowed to show. Letting the container decide meant
 * the line kept every stop and simply squeezed, which reads as clutter long before
 * it becomes unreadable — and the fourth nav item made that worse. Windowing to a
 * fixed count per breakpoint keeps the header calm: the strip always ends on where
 * we are now, so the ones dropped are the oldest.
 */
function useVisibleStops(): number {
  // Read synchronously on the first render. Mantine defers to an effect by default,
  // which is right for SSR and wrong here: this is a client-only SPA, and deferring
  // meant every desktop load drew one stop and then snapped to seven.
  const eager = { getInitialValueInEffect: false } as const;
  const wide = useMediaQuery('(min-width: 90em)', false, eager);
  const desktop = useMediaQuery('(min-width: 75em)', false, eager);
  const tablet = useMediaQuery('(min-width: 62em)', false, eager);
  if (wide) return 7;
  if (desktop) return 5;
  if (tablet) return 3;
  // Below that the header has a burger, a wordmark and two toggles to fit: the
  // strip earns room for exactly one stop, which is the one that matters.
  return 1;
}

/**
 * The route as a single line inside the navbar, ending on the current stop. It
 * still scrolls when a window's worth of stops does not fit, but the chevrons only
 * appear when there is actually something to scroll to.
 */
export function JourneyTimeline() {
  const { t } = useTranslation();
  const limit = useVisibleStops();
  const { data } = useQuery({ queryKey: ['journey', 'timeline'], queryFn: publicApi.journeyTimeline });
  const scroller = useRef<HTMLDivElement>(null);
  const current = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const readEdges = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const slack = el.scrollWidth - el.clientWidth;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft >= slack - 1 });
  }, []);

  useEffect(() => {
    if (!data) return;
    current.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
    readEdges();
    const observer = new ResizeObserver(readEdges);
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, [data, limit, readEdges]);

  if (!data || data.stops.length === 0) return null;

  const stops = data.stops.slice(-limit);
  // A leading rule where the route was cut, so the line reads as continuing off
  // to the left rather than as the whole journey.
  const truncated = stops.length < data.stops.length;
  const overflowing = !(edges.start && edges.end);

  const scrollBy = (direction: -1 | 1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <Group gap={2} wrap="nowrap" style={{ minWidth: 0 }} justify="center">
      {overflowing && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          disabled={edges.start}
          onClick={() => scrollBy(-1)}
          aria-label={t('common.previous')}
        >
          ‹
        </ActionIcon>
      )}
      <Box
        ref={scroller}
        component="nav"
        className="no-scrollbar"
        aria-label={t('journey.timeline')}
        onScroll={readEdges}
        style={{ flex: 1, minWidth: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}
      >
        <Group gap={6} wrap="nowrap" style={{ width: 'max-content' }}>
          {stops.map((stop, i) => (
            <Group key={`${stop.trip_slug}-${stop.slug}-${i}`} gap={6} wrap="nowrap">
              {(i > 0 || truncated) && (
                <Text c="dimmed" size="xs" aria-hidden>
                  ─
                </Text>
              )}
              <Stop stop={stop} innerRef={stop.state === 'current' ? current : undefined} />
            </Group>
          ))}
        </Group>
      </Box>
      {overflowing && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          disabled={edges.end}
          onClick={() => scrollBy(1)}
          aria-label={t('common.next')}
        >
          ›
        </ActionIcon>
      )}
    </Group>
  );
}

function Stop({ stop, innerRef }: { stop: JourneyStop; innerRef?: Ref<HTMLDivElement> }) {
  const isCurrent = stop.state === 'current';
  // Only the current stop leads with its glyph; the others trail it.
  const label = isCurrent ? (
    <>
      <span aria-hidden>{GLYPH.current} </span>
      {stop.title}
    </>
  ) : (
    <>
      {stop.title}
      <span aria-hidden> {GLYPH[stop.state]}</span>
    </>
  );
  // --app-accent, not --globe-marker-active: the marker amber is tuned to sit on
  // satellite imagery and is too light to carry text on the header. Same hue,
  // the value that clears AA.
  const style = {
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: isCurrent ? 600 : 400,
    color: isCurrent ? 'var(--app-accent)' : undefined,
    letterSpacing: isCurrent ? '0.01em' : undefined,
  };

  return (
    <Box ref={innerRef} style={{ display: 'inline-flex' }} aria-current={isCurrent ? 'step' : undefined}>
      <Anchor
        component={Link}
        to={`/pays/${stop.trip_slug}/${stop.slug}`}
        underline="hover"
        c={isCurrent ? undefined : 'dimmed'}
        style={style}
      >
        {label}
      </Anchor>
    </Box>
  );
}
