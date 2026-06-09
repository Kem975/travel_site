import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Divider, Group, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { publicCommentApi, type PublicComment } from '../../api/comments';
import { CommentForm } from './CommentForm';

function CommentView({ comment, dimmed }: { comment: PublicComment; dimmed?: boolean }) {
  return (
    <Paper withBorder={!dimmed} radius="md" p="sm" bg={dimmed ? 'transparent' : undefined}>
      <Group justify="space-between" mb={2}>
        <Text fw={600} size="sm">
          {comment.author_name}
        </Text>
        <Text size="xs" c="dimmed">
          {comment.created_at?.slice(0, 10)}
        </Text>
      </Group>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {comment.body}
      </Text>
    </Paper>
  );
}

export function CommentThread({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['public', 'comments', slug],
    queryFn: () => publicCommentApi.list(slug),
  });
  const [replyTo, setReplyTo] = useState<number | null>(null);

  if (isLoading) {
    return <Loader />;
  }
  if (!data || !data.comments_enabled) {
    return null;
  }

  return (
    <Stack maw={720} mx="auto" w="100%" mt="xl" gap="md">
      <Title order={3}>{t('comments.title')}</Title>

      {data.comments.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('comments.empty')}
        </Text>
      ) : (
        <Stack>
          {data.comments.map((comment) => (
            <Stack key={comment.id} gap="xs">
              <CommentView comment={comment} />
              <Box pl="lg">
                <Stack gap="xs">
                  {comment.replies.map((reply) => (
                    <CommentView key={reply.id} comment={reply} dimmed />
                  ))}
                </Stack>
                {replyTo === comment.id ? (
                  <Box mt="xs">
                    <CommentForm
                      slug={slug}
                      formToken={data.form_token}
                      parentId={comment.id}
                      onPosted={() => {
                        setReplyTo(null);
                        void refetch();
                      }}
                    />
                  </Box>
                ) : (
                  <Button variant="subtle" size="compact-xs" mt={4} onClick={() => setReplyTo(comment.id)}>
                    {t('comments.replyTo')}
                  </Button>
                )}
              </Box>
            </Stack>
          ))}
        </Stack>
      )}

      <Divider my="sm" />
      <Title order={5}>{t('comments.leave')}</Title>
      <CommentForm slug={slug} formToken={data.form_token} onPosted={() => void refetch()} />
    </Stack>
  );
}
