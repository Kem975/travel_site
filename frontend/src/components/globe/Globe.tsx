import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Badge, Box, Button, Card, Group, Image, Text, useComputedColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MAP_CONFIG, registerPmtiles } from '../../lib/map/mapConfig';
import { applyPalette, buildStyle, palette, type Palette, type Scheme, type StylePreset } from '../../lib/map/worldStyle';
import { routeFeature } from '../../lib/map/greatCircle';
import { roundImage } from '../../lib/map/roundImage';
import { journeyStats } from '../../lib/journeyStats';
import { formatDateRange } from '../../lib/date';
import { statusColor } from './statusColors';
import { GlobeHud } from './GlobeHud';
import type { GlobePlace, GlobeTrip } from '../../api/public';

registerPmtiles();

const SPIN_SPEED = 0.06;
const WORLD_VIEW: [number, number] = [10, 25];
const WORLD_ZOOM = 2.85;
const NONE = '__none__';
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const keyOf = (p: GlobePlace) => `${p.trip_slug}/${p.slug}`;
const numberOf = (index: number) => String(index + 1).padStart(2, '0');

/**
 * Stops reached are filled discs, stops still ahead are hollow rings — the ● / ○ the
 * route reads by at a glance. These stay functions rather than literals because
 * applyPalette() rewrites circle-stroke-color on every scheme change and would
 * otherwise flatten the expression back to one flat colour.
 */
const AHEAD: maplibregl.ExpressionSpecification = ['==', ['get', 'status'], 'planned'];
const markerFill = (p: Palette): maplibregl.ExpressionSpecification => [
  'case',
  AHEAD,
  p.markerStroke,
  ['get', 'color'],
];
const markerStroke = (p: Palette): maplibregl.ExpressionSpecification => [
  'case',
  AHEAD,
  ['get', 'color'],
  p.markerStroke,
];

function paintMarkers(map: maplibregl.Map, p: Palette): void {
  if (!map.getLayer('markers')) return;
  map.setPaintProperty('markers', 'circle-color', markerFill(p));
  map.setPaintProperty('markers', 'circle-stroke-color', markerStroke(p));
}

type Props = {
  trips: GlobeTrip[];
  interactive?: boolean;
  onOpen?: (place: GlobePlace) => void;
  stylePreset?: StylePreset;
  /**
   * Pin the globe to one palette regardless of the interface theme. The password
   * gate is a night scene whatever the user's setting, and a daylight globe on it
   * left the two fighting — the warm land against a dark scrim came out grey.
   */
  forceScheme?: Scheme;
};

export function Globe({ trips, interactive = true, onOpen, stylePreset = 'minimal', forceScheme }: Props) {
  const { t, i18n } = useTranslation();
  const themeScheme = useComputedColorScheme('dark');
  const scheme = forceScheme ?? themeScheme;
  // The generous treatment (route glow, marker halo, larger type) belongs to every
  // preset except 'minimal', terrain included — it needs it most, over a busy texture.
  const rich = stylePreset !== 'minimal';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const spinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<GlobePlace | null>(null);
  const [spinning, setSpinning] = useState(false);

  const places = trips.flatMap((tr) => tr.places).filter((p) => p.lng != null && p.lat != null);
  const showData = interactive && places.length > 0;
  const stats = useMemo(() => journeyStats(trips), [trips]);

  const stopSpin = () => {
    spinningRef.current = false;
    setSpinning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const startSpin = () => {
    if (reducedMotion()) return;
    spinningRef.current = true;
    setSpinning(true);
    const frame = () => {
      const map = mapRef.current;
      if (!map || !spinningRef.current) return;
      const c = map.getCenter();
      map.setCenter([c.lng - SPIN_SPEED, c.lat]);
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const select = (place: GlobePlace) => {
    stopSpin();
    setSelected(place);
    mapRef.current?.setFilter('markers-selected', ['==', ['get', 'key'], keyOf(place)]);
    if (place.lng != null && place.lat != null) {
      mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 4.4, duration: 2200, essential: true });
    }
  };

  const resetView = () => {
    setSelected(null);
    mapRef.current?.setFilter('markers-selected', ['==', ['get', 'key'], NONE]);
    mapRef.current?.flyTo({ center: WORLD_VIEW, zoom: WORLD_ZOOM, duration: 1600 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(DEFAULT_MAP_CONFIG, scheme, stylePreset),
      center: WORLD_VIEW,
      zoom: WORLD_ZOOM,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;
    const byKey = new Map(places.map((p) => [keyOf(p), p]));
    const p = palette(scheme, stylePreset);

    map.on('load', async () => {
      map.setProjection({ type: 'globe' });

      if (showData) {
        // One polyline across every country: the journey is continuous, so the hop
        // from one country's last stop to the next country's first is a leg like any other.
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [routeFeature(places)] },
        });
        if (rich) {
          map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': p.route,
              'line-width': ['interpolate', ['linear'], ['zoom'], 1, 4, 5, 9],
              'line-blur': 4,
              'line-opacity': 0.35,
            },
          });
        }
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': p.route,
            'line-width': rich ? ['interpolate', ['linear'], ['zoom'], 1, 2.4, 5, 3.4] : 2,
            'line-opacity': rich ? 1 : 0.9,
          },
        });

        const markerData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: places.map((place, index) => ({
            type: 'Feature',
            properties: {
              key: keyOf(place),
              title: place.title,
              num: numberOf(index),
              status: place.status,
              color: statusColor(place.status),
              icon: place.cover_thumb ? `cv:${keyOf(place)}` : '',
            },
            geometry: { type: 'Point', coordinates: [place.lng as number, place.lat as number] },
          })),
        };
        map.addSource('markers', { type: 'geojson', data: markerData });

        map.addLayer({
          id: 'markers-selected',
          type: 'circle',
          source: 'markers',
          filter: ['==', ['get', 'key'], NONE],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 5, 18],
            'circle-color': p.markerHalo,
            'circle-stroke-color': p.markerActive,
            'circle-stroke-width': 2,
          },
        });
        if (rich) {
          map.addLayer({
            id: 'markers-glow',
            type: 'circle',
            source: 'markers',
            paint: {
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 5, 16],
              'circle-color': p.markerHalo,
              'circle-blur': 0.6,
              'circle-opacity': 0.9,
            },
          });
        }
        // Where we are now, ringed so it reads differently from every stop behind it.
        map.addLayer({
          id: 'markers-current',
          type: 'circle',
          source: 'markers',
          filter: ['==', ['get', 'status'], 'current'],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 5, 19],
            'circle-opacity': 0,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': rich ? 2 : 1.5,
            'circle-stroke-opacity': 0.85,
          },
        });
        map.addLayer({
          id: 'markers',
          type: 'circle',
          source: 'markers',
          paint: {
            'circle-radius': rich
              ? ['interpolate', ['linear'], ['zoom'], 1, 3.2, 3, 6.5, 5, 10]
              : ['interpolate', ['linear'], ['zoom'], 1, 2.5, 3, 5, 5, 8],
            'circle-color': markerFill(p),
            'circle-stroke-color': markerStroke(p),
            'circle-stroke-width': rich ? 2 : 1.5,
          },
        });
        map.addLayer({
          id: 'marker-labels',
          type: 'symbol',
          source: 'markers',
          layout: {
            // Numbered in route order: the globe reads as an itinerary, not a scatter.
            'text-field': ['concat', ['get', 'num'], '  ', ['get', 'title']],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 2.4, 0, 3.2, 12],
            'text-anchor': 'left',
            'text-offset': [0.9, 0],
            'text-allow-overlap': false,
            'text-optional': true,
            ...(rich ? { 'text-letter-spacing': 0.08, 'text-transform': 'uppercase' } : {}),
          },
          paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
        });

        // Circular cover-photo markers — added after their images are ready.
        await Promise.all(
          places.map(async (place) => {
            if (!place.cover_thumb) return;
            const data = await roundImage(place.cover_thumb);
            const name = `cv:${keyOf(place)}`;
            if (data && !map.hasImage(name)) {
              map.addImage(name, data, { pixelRatio: 2 });
            }
          }),
        );
        if (map.getLayer('marker-labels')) {
          map.addLayer(
            {
              id: 'marker-photos',
              type: 'symbol',
              source: 'markers',
              filter: ['!=', ['get', 'icon'], ''],
              layout: {
                'icon-image': ['get', 'icon'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 5, 0.85],
                'icon-allow-overlap': true,
              },
              paint: { 'icon-opacity': ['interpolate', ['linear'], ['zoom'], 3.2, 0, 4, 1] },
            },
            'marker-labels',
          );
        }

        map.on('click', 'markers', (e) => {
          const k = e.features?.[0]?.properties?.key;
          const place = typeof k === 'string' ? byKey.get(k) : undefined;
          if (place) select(place);
        });
        for (const layer of ['markers', 'marker-photos']) {
          map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
          map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
        }
      }

      readyRef.current = true;
      startSpin();
    });

    const onInteract = () => stopSpin();
    const canvas = map.getCanvas();
    ['mousedown', 'wheel', 'touchstart', 'keydown'].forEach((ev) =>
      canvas.addEventListener(ev, onInteract, { passive: true }),
    );

    return () => {
      stopSpin();
      map.remove();
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyPalette(map, scheme, stylePreset);
    paintMarkers(map, palette(scheme, stylePreset));
  }, [scheme, stylePreset]);

  const space = palette(scheme, stylePreset).space;
  // Darkening cream with pure black turns it grey, which is exactly the note the
  // warm light theme does not have. In daylight the vignette closes toward the
  // palette's own brown instead; at night black is still the right shadow.
  const shade = scheme === 'dark' ? '#000' : '#6E431E';
  const selectedDates = selected
    ? formatDateRange(selected.arrival_date, selected.departure_date, i18n.language)
    : null;
  const background = rich
    ? `radial-gradient(circle at 50% 45%, color-mix(in srgb, ${space} 82%, #fff 18%), ${space} 55%, color-mix(in srgb, ${space} 82%, ${shade} 18%) 100%)`
    : space;

  return (
    <Box style={{ position: 'relative', height: '100%', width: '100%', background }}>
      <div
        ref={containerRef}
        role="application"
        aria-label={t('globe.ariaLabel')}
        style={{ position: 'absolute', inset: 0 }}
      />

      {showData && <GlobeHud stats={stats} scrim={space} />}

      {/* Controls sit opposite the journey line, on the same vignette so they stay
          readable over terrain without needing a panel of their own. */}
      {showData && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            padding: '12px 12px 44px 44px',
            pointerEvents: 'none',
            background: `radial-gradient(110% 120% at 100% 0%, color-mix(in srgb, ${space} 72%, transparent), transparent 70%)`,
          }}
        >
          <Group gap="xs" style={{ pointerEvents: 'auto' }}>
            <Button size="xs" variant="subtle" color="gray" onClick={spinning ? stopSpin : startSpin}>
              {spinning ? t('globe.pause') : t('globe.rotate')}
            </Button>
            {selected && (
              <Button size="xs" variant="subtle" color="gray" onClick={resetView}>
                {t('globe.reset')}
              </Button>
            )}
          </Group>
        </Box>
      )}

      {selected && (
        <Card style={{ position: 'absolute', bottom: 16, left: 16, width: 280 }} withBorder shadow="md" radius="md" padding="sm">
          {selected.cover_thumb ? (
            <Card.Section>
              <Image src={selected.cover_thumb} alt="" h={120} fit="cover" className="vt-hero" />
            </Card.Section>
          ) : (
            <Box mb="xs" style={{ height: 80, borderRadius: 6, background: `linear-gradient(135deg, ${statusColor(selected.status)}, #1c3a4a)` }} />
          )}
          <Group justify="space-between" mt="xs">
            <Text fw={700}>{selected.title}</Text>
            <Badge size="sm" variant="light">
              {t(`admin.destStatus.${selected.status}`)}
            </Badge>
          </Group>
          {selected.country && (
            <Text size="sm" c="dimmed">
              {selected.country}
            </Text>
          )}
          {selectedDates && (
            <Text size="xs" c="dimmed" mt={2}>
              {selectedDates}
            </Text>
          )}
          <Button
            size="xs"
            mt="sm"
            fullWidth
            disabled={!selected.has_article}
            onClick={() => selected && onOpen?.(selected)}
          >
            {selected.has_article ? t('globe.read') : t('globe.noStory')}
          </Button>
        </Card>
      )}
    </Box>
  );
}
