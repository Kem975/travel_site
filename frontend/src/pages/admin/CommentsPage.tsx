import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { adminCommentApi, type CommentStatus } from '../../api/comments';

const STATUSES: CommentStatus[] = ['pending', 'published', 'rejected', 'spam'];
const statusColor: Record<CommentStatus, string> = {
  pending: 'yellow',
  published: 'teal',
  rejected: 'gray',
  spam: 'orange',
};

export function CommentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CommentStatus>('pending');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['admin', 'comments', status],
    queryFn: () => adminCommentApi.list(status),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
  };
  const moderate = useMutation({
    mutationFn: ({ id, next }: { id: number; next: CommentStatus }) => adminCommentApi.setStatus(id, next),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: number) => adminCommentApi.remove(id), onSuccess: invalidate });
  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) => adminCommentApi.reply(id, body),
    onSuccess: () => {
      setReplyTo(null);
      setReplyBody('');
      invalidate();
    },
  });

  return (
    <Container size="lg" py="md">
      <Title order={2} mb="md">
        {t('comments.admin.title')}
      </Title>
      <SegmentedControl
        mb="md"
        value={status}
        onChange={(v) => setStatus(v as CommentStatus)}
        data={STATUSES.map((s) => ({ value: s, label: t(`comments.status.${s}`) }))}
      />

      {isLoading ? (
        <Loader />
      ) : comments && comments.length > 0 ? (
        <Stack>
          {comments.map((comment) => (
            <Card key={comment.id} withBorder radius="md" padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Group gap="xs">
                    <Text fw={600}>{comment.author_name}</Text>
                    {comment.parent_id && (
                      <Badge size="xs" variant="light">
                        {t('comments.admin.replyBadge')}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {comment.destination_title} · {comment.created_at?.slice(0, 16).replace('T', ' ')}
                    {comment.author_email ? ` · ${comment.author_email}` : ''}
                  </Text>
                </div>
                <Badge color={statusColor[comment.status]} variant="light">
                  {t(`comments.status.${comment.status}`)}
                </Badge>
              </Group>

              <Text size="sm" mt="xs" style={{ whiteSpace: 'pre-wrap' }}>
                {comment.body}
              </Text>

              <Group gap="xs" mt="sm">
                {comment.status !== 'published' && (
                  <Button size="compact-xs" color="teal" variant="light" onClick={() => moderate.mutate({ id: comment.id, next: 'published' })}>
                    {t('comments.admin.approve')}
                  </Button>
                )}
                {comment.status !== 'rejected' && (
                  <Button size="compact-xs" variant="subtle" onClick={() => moderate.mutate({ id: comment.id, next: 'rejected' })}>
                    {t('comments.admin.reject')}
                  </Button>
                )}
                {comment.status !== 'spam' && (
                  <Button size="compact-xs" color="orange" variant="subtle" onClick={() => moderate.mutate({ id: comment.id, next: 'spam' })}>
                    {t('comments.admin.spam')}
                  </Button>
                )}
                {!comment.parent_id && (
                  <Button size="compact-xs" variant="subtle" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}>
                    {t('comments.admin.replyBtn')}
                  </Button>
                )}
                <Button
                  size="compact-xs"
                  color="red"
                  variant="subtle"
                  onClick={() => {
                    if (window.confirm(t('comments.admin.confirmDelete'))) remove.mutate(comment.id);
                  }}
                >
                  {t('comments.admin.delete')}
                </Button>
              </Group>

              {replyTo === comment.id && (
                <Group mt="xs" align="flex-end" wrap="nowrap">
                  <Textarea
                    style={{ flex: 1 }}
                    autosize
                    minRows={1}
                    placeholder={t('comments.admin.replyPlaceholder')}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.currentTarget.value)}
                  />
                  <Button size="xs" loading={reply.isPending} disabled={!replyBody.trim()} onClick={() => reply.mutate({ id: comment.id, body: replyBody })}>
                    {t('comments.admin.send')}
                  </Button>
                </Group>
              )}
            </Card>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed">{t('comments.admin.empty')}</Text>
      )}
    </Container>
  );
}
