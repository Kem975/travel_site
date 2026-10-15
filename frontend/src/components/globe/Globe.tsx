import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Button, Group, useComputedColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MAP_CONFIG, registerPmtiles } from '../../lib/map/mapConfig';
import { applyPalette, buildStyle, palette, type Palette, type Scheme, type StylePreset } from '../../lib/map/worldStyle';
import { routeFeature } from '../../lib/map/greatCircle';
import { roundImage } from '../../lib/map/roundImage';
import { journeyStats } from '../../lib/journeyStats';
import { statusColor } from './statusColors';
import { GlobeHud } from './GlobeHud';
import { PlacePreviewCard } from './PlacePreviewCard';
import type { DeparturePoint, GlobePlace, GlobeTrip } from '../../api/public';

registerPmtiles();

const SPIN_SPEED = 0.06;
const WORLD_VIEW: [number, number] = [10, 25];
const NONE = '__none__';

/**
 * MapLibre's default field of view puts the camera 1.5 viewport-heights back:
 * cameraToCenterDistance = 0.5 / tan(fov / 2) * height, and tan(fov / 2) is 1/3.
 * We never set `fov`, so this holds.
 */
const CAMERA_DISTANCE_PER_HEIGHT = 1.5;

/**
 * Narrower than this and we stop fitting and start filling — see fitZoom. 768 is
 * an iPad in portrait, and also Mantine's `sm` breakpoint, which the rest of the
 * site already turns on.
 */
const TABLET_WIDTH = 768;

/** Used only if the container has not been laid out yet. */
const FALLBACK_ZOOM = 2.85;

/**
 * The zoom at which the globe is exactly as wide as the shorter side of its
 * container — so the whole Earth is on screen, touching two edges.
 *
 * MapLibre draws the globe as a sphere of `worldSize / 2π` pixels seen in
 * perspective from `cameraToCenterDistance` in front of its near surface, which
 * puts its centre at d = f + R. The silhouette of a sphere is smaller than the
 * sphere: its on-screen radius is f·R / √(d² − R²) = f·R / √(f² + 2fR). This
 * inverts that for R, then turns R back into a zoom.
 *
 * Below tablet width the rule flips: a phone screen is tall and narrow, so
 * fitting the *shorter* side would leave the Earth as a small disc marooned in a
 * column of empty sky. There we hold the tablet size instead, which fills the
 * height and crops the sides — too big rather than too small.
 */
function fitZoom(width: number, height: number): number {
  if (width <= 0 || height <= 0) return FALLBACK_ZOOM;

  const target = width >= TABLET_WIDTH ? Math.min(width, height) : TABLET_WIDTH;
  const f = CAMERA_DISTANCE_PER_HEIGHT * height;
  const r = target / 2;
  const R = (r * r) / f + r * Math.sqrt(1 + (r * r) / (f * f));
  return Math.log2((R * 2 * Math.PI) / 512);
}
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

/** Night: a blurred glow in the route's own colour. Day: an opaque dark casing. */
function routeCasing(scheme: Scheme, p: Palette): Record<string, unknown> {
  return scheme === 'dark'
    ? {
        'line-color': p.route,
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 4, 5, 9],
        'line-blur': 4,
        'line-opacity': 0.35,
      }
    : {
        'line-color': 'rgba(28,38,48,0.55)',
        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 4.4, 5, 6.6],
        'line-blur': 0,
        'line-opacity': 1,
      };
}

function paintMarkers(map: maplibregl.Map, p: Palette): void {
  if (!map.getLayer('markers')) return;
  map.setPaintProperty('markers', 'circle-color', markerFill(p));
  map.setPaintProperty('markers', 'circle-stroke-color', markerStroke(p));
}

type Props = {
  trips: GlobeTrip[];
  /**
   * Where the journey started. When set, the globe opens on it and the rotation
   * runs from there, so the first thing you see is home and the Earth turns away
   * from it. Left out on the password gate: that globe is decorative and must not
   * disclose anything about us before sign-in, not even which coast we left.
   */
  departure?: DeparturePoint | null;
  /** Stop whose article was published last — shown in the corner until one is picked. */
  latestDestinationId?: number | null;
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

export function Globe({
  trips,
  departure,
  latestDestinationId,
  interactive = true,
  onOpen,
  stylePreset = 'minimal',
  forceScheme,
}: Props) {
  const { t } = useTranslation();
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
  // Mirrors readyRef as state. The map is built once, with whatever scheme was
  // resolved at mount — useComputedColorScheme reports its fallback first — so the
  // palette has to be re-applied once the style has actually loaded. As a ref alone
  // that correction never fired: the effect below bailed on `!ready` and, with
  // nothing in its dependencies changing afterwards, never ran again.
  const [ready, setReady] = useState(false);

  const places = trips.flatMap((tr) => tr.places).filter((p) => p.lng != null && p.lat != null);
  const showData = interactive && places.length > 0;
  const stats = useMemo(() => journeyStats(trips), [trips]);

  // The view the globe opens on and returns to. The departure point when there is
  // one; otherwise the generic world view, which is all the gate ever gets.
  const home: [number, number] = departure ? [departure.lng, departure.lat] : WORLD_VIEW;

  // Measured from the container at the moment it is needed rather than cached:
  // "back to the journey" should fit the window the reader has now, not the one
  // they arrived with.
  // Null, not a guess, when the container has no size yet — a lazily loaded chunk
  // can mount before layout settles, and a zoom computed from a zero-width box
  // would stick for the whole session. getBoundingClientRect because clientWidth
  // reads 0 on a box whose own width is still unresolved.
  const measuredFitZoom = (): number | null => {
    const el = containerRef.current;
    if (!el) return null;
    const { width, height } = el.getBoundingClientRect();
    return width > 0 && height > 0 ? fitZoom(width, height) : null;
  };

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
    mapRef.current?.flyTo({ center: home, zoom: measuredFitZoom() ?? FALLBACK_ZOOM, duration: 1600 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const initialZoom = measuredFitZoom();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(DEFAULT_MAP_CONFIG, scheme, stylePreset),
      center: home,
      zoom: initialZoom ?? FALLBACK_ZOOM,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;

    // Mounted before the container had a width, so the zoom above is a guess.
    // Take the first real size MapLibre reports and fit to it, once — after that
    // the zoom belongs to the reader.
    if (initialZoom === null) {
      const refit = () => {
        const zoom = measuredFitZoom();
        if (zoom === null) return;
        map.off('resize', refit);
        map.setZoom(zoom);
      };
      map.on('resize', refit);
    }
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
          // Same layer, two jobs. At night it is a glow: the route is the brightest
          // thing around, and bleeding light off it reads as altitude. In daylight
          // it is a casing instead — a dark line under the amber one — because a
          // mid-value stroke crossing pale desert and pale ocean has nothing to
          // contrast against on its own.
          map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: routeCasing(scheme, p),
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
      setReady(true);
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
    if (!map || !ready) return;
    applyPalette(map, scheme, stylePreset);
    const p = palette(scheme, stylePreset);
    paintMarkers(map, p);
    if (map.getLayer('route-glow')) {
      for (const [key, value] of Object.entries(routeCasing(scheme, p))) {
        map.setPaintProperty('route-glow', key, value as never);
      }
    }
  }, [scheme, stylePreset, ready]);

  // What the corner card shows: the stop you clicked, or — until then — the stop
  // whose article was published most recently. Looked up in `places` rather than
  // sent whole, so the card and its marker are always the same record.
  const latest =
    latestDestinationId != null ? (places.find((p) => p.id === latestDestinationId) ?? null) : null;
  const previewed = selected ?? latest;

  const space = palette(scheme, stylePreset).space;
  // Darkening cream with pure black turns it grey, which is exactly the note the
  // warm light theme does not have. In daylight the vignette closes toward the
  // palette's own brown instead; at night black is still the right shadow.
  const shade = scheme === 'dark' ? '#000' : '#6E431E';
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

      {/* Nothing picked yet: offer the newest piece of writing rather than an empty
          corner. The first click replaces it, label and all, and returning to the
          world view brings it back — it is simply what the corner says when no stop
          is selected. */}
      {showData && previewed && (
        <PlacePreviewCard
          place={previewed}
          label={selected === null ? t('globe.latestArticle') : null}
          onOpen={onOpen}
        />
      )}
    </Box>
  );
}
