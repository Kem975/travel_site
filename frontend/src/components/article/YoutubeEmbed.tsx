import { useState } from 'react';
import { AspectRatio, Box, Center, UnstyledButton } from '@mantine/core';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { youtubeEmbedUrl, youtubeThumbnail } from '../../lib/youtube';

/** Facade: the thumbnail is a plain image, so YouTube loads nothing until a click. */
export function YoutubeEmbed({ videoId, title }: { videoId: string; title?: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);

  return (
    <AspectRatio ratio={16 / 9}>
      {playing ? (
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title ?? t('article.blocks.video.play')}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ border: 0, borderRadius: 8 }}
        />
      ) : (
        <UnstyledButton
          onClick={() => setPlaying(true)}
          aria-label={t('article.blocks.video.play')}
          style={{ display: 'block', width: '100%', height: '100%', position: 'relative', borderRadius: 8, overflow: 'hidden' }}
        >
          <img
            src={youtubeThumbnail(videoId)}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          <Center style={{ position: 'absolute', inset: 0 }}>
            <Box
              style={{
                width: 68,
                height: 48,
                borderRadius: 12,
                background: 'rgba(0, 0, 0, 0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconPlayerPlayFilled size={24} color="white" />
            </Box>
          </Center>
        </UnstyledButton>
      )}
    </AspectRatio>
  );
}
