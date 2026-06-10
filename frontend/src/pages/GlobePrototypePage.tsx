import { Box, Text } from '@mantine/core';
import { GlobePrototype } from '../components/globe/GlobePrototype';

// Standalone, reviewable prototype (not yet the homepage). Validates the globe,
// route arcs, markers, rotation and reduced-motion before integration.
export function GlobePrototypePage() {
  return (
    <Box>
      <Text size="sm" c="dimmed" mb="xs">
        Globe prototype — test data across continents (incl. an Auckland→Honolulu hop across the date line).
        Click a marker to select; drag/scroll to explore (auto-rotation stops on interaction).
      </Text>
      <Box style={{ height: 'calc(100dvh - 120px)', minHeight: 420, borderRadius: 10, overflow: 'hidden' }}>
        <GlobePrototype />
      </Box>
    </Box>
  );
}
