import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Container size="sm" py="xl">
      <Stack align="center" gap="md" mt="xl">
        <Title order={1} fz={64} c="dimmed">
          404
        </Title>
        <Text c="dimmed">{t('notFound.body')}</Text>
        <Button component={Link} to="/">
          {t('notFound.home')}
        </Button>
      </Stack>
    </Container>
  );
}
