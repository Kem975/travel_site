import { api } from './client';
import type { Photo } from './media';

export type ImageLayout = 'normal' | 'wide' | 'fullBleed';
export type GalleryLayout = 'grid' | 'masonry' | 'carousel';
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type PracticalItem = { label: string; value: string };

// The typed block model (DECISIONS D6). TipTap owns only the richText block's html.
export type ArticleBlock =
  | { type: 'richText'; content: { html: string } }
  | { type: 'image'; content: { photoId: number; layout: ImageLayout; caption: string | null } }
  | { type: 'gallery'; content: { photoIds: number[]; layout: GalleryLayout } }
  | { type: 'quote'; content: { text: string; attribution: string | null } }
  | { type: 'practicalInfo'; content: { items: PracticalItem[] } }
  | { type: 'divider'; content: Record<string, never> };

export type BlockType = ArticleBlock['type'];

export type Article = {
  id: number;
  destination_id: number;
  title: string | null;
  subtitle: string | null;
  status: ArticleStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PhotoMap = Record<string, Photo>;

export type ArticleEditorData = { article: Article | null; blocks: ArticleBlock[]; photos: PhotoMap };

export type ArticleSaveInput = {
  title?: string;
  subtitle?: string;
  status: ArticleStatus;
  blocks: ArticleBlock[];
  version?: number;
};

export type PublicArticle = {
  destination: {
    id: number;
    title: string;
    slug: string;
    country: string | null;
    arrival_date: string | null;
    departure_date: string | null;
    excerpt: string | null;
    cover: Photo | null;
  };
  trip: { title: string; slug: string } | null;
  article: { title: string | null; subtitle: string | null; published_at: string | null };
  blocks: ArticleBlock[];
  photos: PhotoMap;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export const BLOCK_TYPES: BlockType[] = ['richText', 'image', 'gallery', 'quote', 'practicalInfo', 'divider'];

export function emptyBlock(type: BlockType): ArticleBlock {
  switch (type) {
    case 'richText':
      return { type, content: { html: '' } };
    case 'image':
      return { type, content: { photoId: 0, layout: 'normal', caption: null } };
    case 'gallery':
      return { type, content: { photoIds: [], layout: 'grid' } };
    case 'quote':
      return { type, content: { text: '', attribution: null } };
    case 'practicalInfo':
      return { type, content: { items: [{ label: '', value: '' }] } };
    case 'divider':
      return { type, content: {} as Record<string, never> };
  }
}

export const articleApi = {
  get: (destinationId: number) => api.get<ArticleEditorData>(`/admin/destinations/${destinationId}/article`),
  save: (destinationId: number, data: ArticleSaveInput) =>
    api.put<ArticleEditorData>(`/admin/destinations/${destinationId}/article`, data),
};

export const publicArticleApi = {
  get: (slug: string) => api.get<PublicArticle>(`/destinations/${slug}/article`),
};
