import { Badge, Box, Button, Card, Group, Image, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { GlobePlace } from '../../api/public';
import { formatDateRange } from '../../lib/date';
import { statusColor } from './statusColors';

type Props = {
  place: GlobePlace;
  /**
   * Eyebrow above the title. Set only for the stop the globe offers on arrival,
   * which needs saying why it is there; a stop the reader clicked does not.
   */
  label?: string | null;
  onOpen?: (place: GlobePlace) => void;
};

/**
 * The card in the globe's bottom-left corner: one stop, its cover, and the way in.
 *
 * Shared by the two things that can put a stop there — the marker you clicked and
 * the latest published article — so the two can never drift into looking like
 * different objects.
 */
export function PlacePreviewCard({ place, label, onOpen }: Props) {
  const { t, i18n } = useTranslation();
  const dates = formatDateRange(place.arrival_date, place.departure_date, i18n.language);

  return (
    <Card style={{ position: 'absolute', bottom: 16, left: 16, width: 280 }} withBorder shadow="md" radius="md" padding="sm">
      {place.cover_thumb ? (
        <Card.Section>
          <Image src={place.cover_thumb} alt="" h={120} fit="cover" className="vt-hero" />
        </Card.Section>
      ) : (
        <Box mb="xs" style={{ height: 80, borderRadius: 6, background: `linear-gradient(135deg, ${statusColor(place.status)}, #1c3a4a)` }} />
      )}

      {/* The HUD's register, borrowed: this line is a note about the card, not part
          of the stop's own text. */}
      {label && (
        <Text ff="monospace" fz={10} c="var(--app-accent)" tt="uppercase" mt="xs" style={{ letterSpacing: '0.18em' }}>
          {label}
        </Text>
      )}

      <Group justify="space-between" mt={label ? 4 : 'xs'}>
        <Text fw={700}>{place.title}</Text>
        <Badge size="sm" variant="light">
          {t(`admin.destStatus.${place.status}`)}
        </Badge>
      </Group>
      {place.country && (
        <Text size="sm" c="dimmed">
          {place.country}
        </Text>
      )}
      {dates && (
        <Text size="xs" c="dimmed" mt={2}>
          {dates}
        </Text>
      )}
      <Button size="xs" mt="sm" fullWidth disabled={!place.has_article} onClick={() => onOpen?.(place)}>
        {place.has_article ? t('globe.read') : t('globe.noStory')}
      </Button>
    </Card>
  );
}
