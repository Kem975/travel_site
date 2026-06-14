import { SegmentedControl } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '../../i18n';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('en') ? 'en' : 'fr';

  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      value={current}
      onChange={(value) => setLanguage(value === 'en' ? 'en' : 'fr')}
      data={[
        { label: 'FR', value: 'fr' },
        { label: 'EN', value: 'en' },
      ]}
      aria-label="Language"
    />
  );
}
