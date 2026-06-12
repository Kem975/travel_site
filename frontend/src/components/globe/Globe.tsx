import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Badge, Box, Button, Card, Group, Image, Text, useComputedColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MAP_CONFIG, registerPmtiles } from '../../lib/map/mapConfig';
import { applyPalette, buildStyle, palette } from '../../lib/map/worldStyle';
import { routeFeature } from '../../lib/map/greatCircle';
import { roundImage } from '../../lib/map/roundImage';
import { statusColor } from './statusColors';
import type { GlobePlace, GlobeTrip } from '../../api/public';

registerPmtiles();

const SPIN_SPEED = 0.06;
const WORLD_VIEW: [number, number] = [10, 25];
const WORLD_ZOOM = 2.85;
const NONE = '__none__';
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const keyOf = (p: GlobePlace) => `${p.trip_slug}/${p.slug}`;

type Props = {
  trips: GlobeTrip[];
  interactive?: boolean;
  onOpen?: (place: GlobePlace) => void;
};

export function Globe({ trips, interactive = true, onOpen }: Props) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme('dark');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const spinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const [selected, setSelected] = useState<GlobePlace | null>(null);
  const [spinning, setSpinning] = useState(false);

  const places = trips.flatMap((tr) => tr.places).filter((p) => p.lng != null && p.lat != null);
  const showData = interactive && places.length > 0;

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
      style: buildStyle(DEFAULT_MAP_CONFIG, scheme),
      center: WORLD_VIEW,
      zoom: WORLD_ZOOM,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;
    const byKey = new Map(places.map((p) => [keyOf(p), p]));
    const p = palette(scheme);

    map.on('load', async () => {
      map.setProjection({ type: 'globe' });

      if (showData) {
        map.addSource('route', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: trips.map((tr) => routeFeature(tr.places)) },
        });
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': p.route, 'line-width': 2, 'line-opacity': 0.9 },
        });

        const markerData: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: places.map((place) => ({
            type: 'Feature',
            properties: {
              key: keyOf(place),
              title: place.title,
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
        map.addLayer({
          id: 'markers',
          type: 'circle',
          source: 'markers',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 3, 5, 5, 8],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': p.markerStroke,
            'circle-stroke-width': 1.5,
          },
        });
        map.addLayer({
          id: 'marker-labels',
          type: 'symbol',
          source: 'markers',
          layout: {
            'text-field': ['get', 'title'],
            'text-font': ['Noto Sans Regular'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 2.4, 0, 3.2, 12],
            'text-anchor': 'left',
            'text-offset': [0.9, 0],
            'text-allow-overlap': false,
            'text-optional': true,
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
    if (map && readyRef.current) applyPalette(map, scheme);
  }, [scheme]);

  return (
    <Box style={{ position: 'relative', height: '100%', width: '100%', background: palette(scheme).space }}>
      <div
        ref={containerRef}
        role="application"
        aria-label={t('globe.ariaLabel')}
        style={{ position: 'absolute', inset: 0 }}
      />

      {showData && (
        <Group style={{ position: 'absolute', top: 12, left: 12 }} gap="xs">
          <Button size="xs" variant="white" color="dark" onClick={spinning ? stopSpin : startSpin}>
            {spinning ? `⏸ ${t('globe.pause')}` : `▶ ${t('globe.rotate')}`}
          </Button>
          {selected && (
            <Button size="xs" variant="default" onClick={resetView}>
              {t('globe.reset')}
            </Button>
          )}
        </Group>
      )}

      {selected && (
        <Card style={{ position: 'absolute', bottom: 16, left: 16, width: 280 }} withBorder shadow="md" radius="md" padding="sm">
          {selected.cover_thumb ? (
            <Card.Section>
              <Image src={selected.cover_thumb} alt="" h={120} fit="cover" />
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
