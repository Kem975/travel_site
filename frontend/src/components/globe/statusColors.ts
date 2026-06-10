import type { GlobeStatusName } from '../../api/public';

// Marker styling by destination status (plan §7.3).
const STATUS_COLOR: Record<GlobeStatusName, string> = {
  visited: '#5bb3a6',
  current: '#ffce6b',
  planned: '#7f97a6',
  cancelled: '#9a9a9a',
  hidden: '#9a9a9a',
};

export function statusColor(status: string): string {
  return STATUS_COLOR[status as GlobeStatusName] ?? '#7f97a6';
}
