import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ActionIcon, Anchor, Box, Group, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { publicApi } from '../../api/public';
import type { JourneyStop } from '../../api/public';

const GLYPH = { visited: '✓', current: '●' } as const;

/**
 * The route as a single scrollable line inside the navbar. Every stop is rendered
 * and the strip is scrolled to centre the current one, rather than windowing to N
 * stops: the container just shows as many as it has room for, which is what makes
 * the same markup work from desktop down to a phone.
 */
export function JourneyTimeline() {
  const { t } = useTranslation();
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
  }, [data, readEdges]);

  if (!data || data.stops.length === 0) return null;

  const scrollBy = (direction: -1 | 1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <Group gap={2} wrap="nowrap" style={{ minWidth: 0 }} justify="center">
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
      <Box
        ref={scroller}
        component="nav"
        className="no-scrollbar"
        aria-label={t('journey.timeline')}
        onScroll={readEdges}
        style={{ flex: 1, minWidth: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}
      >
        <Group gap={6} wrap="nowrap" style={{ width: 'max-content' }}>
          {data.stops.map((stop, i) => (
            <Group key={`${stop.trip_slug}-${stop.slug}-${i}`} gap={6} wrap="nowrap">
              {i > 0 && (
                <Text c="dimmed" size="xs" aria-hidden>
                  ─
                </Text>
              )}
              <Stop stop={stop} innerRef={stop.state === 'current' ? current : undefined} />
            </Group>
          ))}
        </Group>
      </Box>
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
  const style = {
    fontSize: 'var(--mantine-font-size-xs)',
    fontWeight: isCurrent ? 600 : 400,
    color: isCurrent ? 'var(--globe-marker-active)' : undefined,
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
