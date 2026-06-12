import { lazy, Suspense, type ReactNode } from 'react';
import type { GlobePlace, GlobeTrip } from '../../api/public';
import type { StylePreset } from '../../lib/map/worldStyle';

// MapLibre is heavy — only loaded when a globe actually renders.
const Globe = lazy(() => import('./Globe').then((m) => ({ default: m.Globe })));

type Props = {
  trips: GlobeTrip[];
  interactive?: boolean;
  onOpen?: (place: GlobePlace) => void;
  stylePreset?: StylePreset;
  fallback?: ReactNode;
};

export function LazyGlobe({ fallback = null, ...props }: Props) {
  return <Suspense fallback={fallback}>{<Globe {...props} />}</Suspense>;
}
