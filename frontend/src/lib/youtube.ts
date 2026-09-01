const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The video id from anything YouTube hands you: a watch URL, a share link, a
 * Shorts link, an embed URL, or the bare id. Returns null when it isn't one.
 * Only the id is ever stored, so nothing user-typed reaches the iframe src.
 */
export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (value === '') {
    return null;
  }
  if (ID.test(value)) {
    return value;
  }

  let url: URL;
  try {
    url = new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const candidate =
    host === 'youtu.be'
      ? url.pathname.slice(1)
      : host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')
        ? (url.searchParams.get('v') ?? url.pathname.replace(/^\/(embed|shorts|v|live)\//, ''))
        : '';

  return ID.test(candidate) ? candidate : null;
}

export const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export const youtubeEmbedUrl = (id: string) =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
