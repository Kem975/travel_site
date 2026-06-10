import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Badge, Box, Button, Card, Group, Text, useComputedColorScheme } from '@mantine/core';
import { DEFAULT_MAP_CONFIG, registerPmtiles } from '../../lib/map/mapConfig';
import { applyPalette, buildStyle, palette } from '../../lib/map/worldStyle';
import { routeFeature } from '../../lib/map/greatCircle';
import { TEST_DESTINATIONS, type GlobeDestination } from '../../lib/map/testDestinations';

registerPmtiles();

const SPIN_SPEED = 0.08; // degrees of longitude per frame (~slow cinematic)
const WORLD_VIEW: [number, number] = [10, 25];
const WORLD_ZOOM = 3;
const NONE = '__none__';
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Markers as a native GeoJSON source so MapLibre renders them ON the globe
// (correct positioning + occlusion). Density adapts via zoom expressions.
const markerData = {
  type: 'FeatureCollection',
  features: TEST_DESTINATIONS.filter((d) => d.lng != null && d.lat != null).map((d) => ({
    type: 'Feature',
    properties: { id: d.id, title: d.title, color: d.color },
    geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
  })),
} as unknown as GeoJSON.FeatureCollection;

export function GlobePrototype() {
  const scheme = useComputedColorScheme('dark');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const spinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);

  const [selected, setSelected] = useState<GlobeDestination | null>(null);
  const [spinning, setSpinning] = useState(false);

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

  const select = (dest: GlobeDestination) => {
    stopSpin();
    selectedIdRef.current = dest.id;
    setSelected(dest);
    mapRef.current?.setFilter('markers-selected', ['==', ['get', 'id'], dest.id]);
    if (dest.lng != null && dest.lat != null) {
      mapRef.current?.flyTo({ center: [dest.lng, dest.lat], zoom: 4.2, duration: 2200, essential: true });
    }
  };

  const resetView = () => {
    selectedIdRef.current = null;
    setSelected(null);
    mapRef.current?.setFilter('markers-selected', ['==', ['get', 'id'], NONE]);
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
    const p = palette(scheme);

    map.on('load', () => {
      map.setProjection({ type: 'globe' });

      map.addSource('route', { type: 'geojson', data: routeFeature(TEST_DESTINATIONS) });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': p.route, 'line-width': 2, 'line-opacity': 0.9 },
      });

      map.addSource('markers', { type: 'geojson', data: markerData });
      map.addLayer({
        id: 'markers-selected',
        type: 'circle',
        source: 'markers',
        filter: ['==', ['get', 'id'], NONE],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 5, 16],
          'circle-color': 'rgba(255,210,125,0.18)',
          'circle-stroke-color': '#ffd27d',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'markers',
        type: 'circle',
        source: 'markers',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 3, 5, 5, 9],
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
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
          'text-offset': [0.8, 0],
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: { 'text-color': p.label, 'text-halo-color': p.labelHalo, 'text-halo-width': 1.4 },
      });

      map.on('click', 'markers', (e) => {
        const id = e.features?.[0]?.properties?.id;
        const dest = TEST_DESTINATIONS.find((d) => d.id === id);
        if (dest) select(dest);
      });
      map.on('mouseenter', 'markers', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'markers', () => {
        map.getCanvas().style.cursor = '';
      });

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

  // Recolor when the app's light/dark scheme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (map && readyRef.current) {
      applyPalette(map, scheme);
    }
  }, [scheme]);

  return (
    <Box style={{ position: 'relative', height: '100%', width: '100%', background: palette(scheme).space }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <Group style={{ position: 'absolute', top: 12, left: 12 }} gap="xs">
        {spinning ? (
          <Button size="xs" variant="white" color="dark" onClick={stopSpin}>
            ⏸ Pause
          </Button>
        ) : (
          <Button size="xs" variant="white" color="dark" onClick={startSpin}>
            ▶ Rotate
          </Button>
        )}
        {selected && (
          <Button size="xs" variant="default" onClick={resetView}>
            Reset view
          </Button>
        )}
      </Group>

      {selected && (
        <Card style={{ position: 'absolute', bottom: 16, left: 16, width: 260 }} withBorder shadow="md" radius="md" padding="sm">
          <Box mb="xs" style={{ height: 96, borderRadius: 6, background: `linear-gradient(135deg, ${selected.color}, #1c3a4a)` }} />
          <Group justify="space-between">
            <Text fw={700}>{selected.title}</Text>
            <Badge size="sm" variant="light">
              {selected.status}
            </Badge>
          </Group>
          {selected.country && (
            <Text size="sm" c="dimmed">
              {selected.country}
            </Text>
          )}
          <Button size="xs" mt="sm" fullWidth disabled>
            Read the story (integration)
          </Button>
        </Card>
      )}

      <Text size="xs" c="dimmed" style={{ position: 'absolute', bottom: 4, right: 8 }}>
        {DEFAULT_MAP_CONFIG.attribution}
      </Text>
    </Box>
  );
}
