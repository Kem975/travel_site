import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionIcon, Badge, Card, Container, Group, Image, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { mediaApi, type Photo } from '../../api/media';
import { PhotoUploader } from '../../components/admin/PhotoUploader';
import { PhotoMetaModal } from '../../components/admin/PhotoMetaModal';

export function MediaLibraryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: photos, isLoading } = useQuery({ queryKey: ['admin', 'photos', 'library'], queryFn: () => mediaApi.list() });
  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Photo | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'photos'] });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => mediaApi.remove(id),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
    onError: (error) => {
      // e.g. 409 when the photo is still a cover or used in an article block.
      window.alert(error instanceof Error ? error.message : t('media.deleteError'));
    },
  });

  const edit = (photo: Photo) => {
    setEditing(photo);
    open();
  };
  const confirmDelete = (photo: Photo) => {
    if (window.confirm(t('media.confirmDelete'))) {
      deleteMutation.mutate(photo.id);
    }
  };

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="lg">
        {t('media.library.title')}
      </Title>
      <Stack>
        <PhotoUploader onUploaded={invalidate} />

        {isLoading ? (
          <Loader />
        ) : photos && photos.length > 0 ? (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
            {photos.map((photo) => (
              <Card key={photo.id} withBorder padding="xs" radius="md">
                <Card.Section>
                  <Image src={photo.thumb ?? undefined} alt={photo.alt_text ?? ''} h={140} fit="cover" />
                </Card.Section>
                <Group justify="space-between" mt="xs" wrap="nowrap">
                  <Text size="sm" truncate="end">
                    {photo.caption ?? photo.original_filename ?? `#${photo.id}`}
                  </Text>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon variant="subtle" size="sm" onClick={() => edit(photo)}>
                      <IconEdit size={15} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => confirmDelete(photo)}>
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Group>
                </Group>
                {photo.category && (
                  <Badge size="xs" variant="light" mt={4}>
                    {t(`media.categories.${photo.category}`)}
                  </Badge>
                )}
              </Card>
            ))}
          </SimpleGrid>
        ) : (
          <Text c="dimmed">{t('media.empty')}</Text>
        )}
      </Stack>

      <PhotoMetaModal opened={opened} onClose={close} photo={editing} />
    </Container>
  );
}
