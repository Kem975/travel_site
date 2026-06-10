import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globe.css';
import { Badge, Box, Button, Card, Group, Text } from '@mantine/core';
import { DEFAULT_MAP_CONFIG, registerPmtiles } from '../../lib/map/mapConfig';
import { buildStyle, ROUTE_COLOR } from '../../lib/map/worldStyle';
import { routeFeature } from '../../lib/map/greatCircle';
import { TEST_DESTINATIONS, type GlobeDestination } from '../../lib/map/testDestinations';

registerPmtiles();

const SPIN_SPEED = 0.08; // degrees of longitude per frame (~slow cinematic)
const WORLD_VIEW: [number, number] = [10, 25];
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function GlobePrototype() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const spinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const markersRef = useRef<{ el: HTMLDivElement; id: string }[]>([]);
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

  const applyMarkerState = () => {
    const map = mapRef.current;
    if (!map) return;
    const z = map.getZoom();
    const size = z < 2.2 ? 'dot' : z < 4 ? 'thumb' : 'large';
    markersRef.current.forEach(({ el, id }) => {
      el.dataset.size = size;
      el.dataset.selected = selectedIdRef.current === id ? 'true' : 'false';
    });
  };

  const select = (dest: GlobeDestination) => {
    stopSpin();
    selectedIdRef.current = dest.id;
    setSelected(dest);
    applyMarkerState();
    if (dest.lng != null && dest.lat != null) {
      mapRef.current?.flyTo({ center: [dest.lng, dest.lat], zoom: 4.2, duration: 2200, essential: true });
    }
  };

  const resetView = () => {
    selectedIdRef.current = null;
    setSelected(null);
    applyMarkerState();
    mapRef.current?.flyTo({ center: WORLD_VIEW, zoom: 1.5, duration: 1800 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(DEFAULT_MAP_CONFIG),
      center: WORLD_VIEW,
      zoom: 1.5,
      attributionControl: false,
      dragRotate: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.setProjection({ type: 'globe' });

      map.addSource('route', { type: 'geojson', data: routeFeature(TEST_DESTINATIONS) });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ROUTE_COLOR, 'line-width': 2, 'line-opacity': 0.9 },
      });

      for (const dest of TEST_DESTINATIONS) {
        if (dest.lng == null || dest.lat == null) continue;
        const el = document.createElement('div');
        el.className = 'globe-marker';
        el.style.setProperty('--c', dest.color);
        el.dataset.size = 'dot';
        el.innerHTML = `<span class="globe-marker__dot"></span><span class="globe-marker__label"></span>`;
        el.querySelector('.globe-marker__label')!.textContent = dest.title;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          select(dest);
        });
        new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([dest.lng, dest.lat]).addTo(map);
        markersRef.current.push({ el, id: dest.id });
      }

      applyMarkerState();
      startSpin();
    });

    map.on('zoom', applyMarkerState);

    const onInteract = () => stopSpin();
    const canvas = map.getCanvas();
    ['mousedown', 'wheel', 'touchstart', 'keydown'].forEach((ev) =>
      canvas.addEventListener(ev, onInteract, { passive: true }),
    );

    return () => {
      stopSpin();
      map.remove();
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box style={{ position: 'relative', height: '100%', width: '100%', background: '#05101a' }}>
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

      <Text size="xs" c="gray.5" style={{ position: 'absolute', bottom: 4, right: 8 }}>
        {DEFAULT_MAP_CONFIG.attribution}
      </Text>
    </Box>
  );
}
