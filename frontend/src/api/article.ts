import { api } from './client';
import type { Photo } from './media';

export type TextAlign = 'left' | 'center';
export type TextSize = 'normal' | 'small';
export type ImageLayout = 'normal' | 'wide' | 'fullBleed';
export type GalleryLayout = 'grid' | 'masonry' | 'carousel';
export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';
/** An article exists once per destination *per language*; 'fr' is the original. */
export type ArticleLang = 'fr' | 'en';
export type PracticalItem = { label: string; value: string };

// The typed block model (DECISIONS D6). TipTap owns only the richText block's html.
export type ArticleBlock =
  | { type: 'richText'; content: { html: string; align?: TextAlign; size?: TextSize } }
  | { type: 'image'; content: { photoId: number; layout: ImageLayout; caption: string | null } }
  | { type: 'gallery'; content: { photoIds: number[]; layout: GalleryLayout } }
  | { type: 'video'; content: { videoId: string; caption: string | null } }
  | { type: 'quote'; content: { text: string; attribution: string | null } }
  | { type: 'practicalInfo'; content: { items: PracticalItem[] } }
  | { type: 'divider'; content: Record<string, never> };

export type BlockType = ArticleBlock['type'];

export type Article = {
  id: number;
  destination_id: number;
  lang: ArticleLang;
  title: string | null;
  subtitle: string | null;
  status: ArticleStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PhotoMap = Record<string, Photo>;

export type ArticleEditorData = {
  article: Article | null;
  blocks: ArticleBlock[];
  photos: PhotoMap;
  lang: ArticleLang;
  langs: ArticleLang[];
};

export type ArticleSaveInput = {
  lang: ArticleLang;
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
  /** The language actually asked for. */
  lang: ArticleLang;
  /** Every language this destination is readable in — never empty (else it's a 404). */
  available_langs: ArticleLang[];
  /** Null when `lang` has no published version; `available_langs` says what does. */
  article: { title: string | null; subtitle: string | null; published_at: string | null } | null;
  blocks: ArticleBlock[];
  photos: PhotoMap;
  /** Recipes pinned to this stop, already filtered to `lang`. */
  recipes: { slug: string; title: string }[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
};

export const BLOCK_TYPES: BlockType[] = ['richText', 'image', 'gallery', 'video', 'quote', 'practicalInfo', 'divider'];

export function emptyBlock(type: BlockType): ArticleBlock {
  switch (type) {
    case 'richText':
      return { type, content: { html: '', align: 'left', size: 'normal' } };
    case 'image':
      return { type, content: { photoId: 0, layout: 'normal', caption: null } };
    case 'gallery':
      return { type, content: { photoIds: [], layout: 'grid' } };
    case 'video':
      return { type, content: { videoId: '', caption: null } };
    case 'quote':
      return { type, content: { text: '', attribution: null } };
    case 'practicalInfo':
      return { type, content: { items: [{ label: '', value: '' }] } };
    case 'divider':
      return { type, content: {} as Record<string, never> };
  }
}

export const articleApi = {
  get: (destinationId: number, lang: ArticleLang) =>
    api.get<ArticleEditorData>(`/admin/destinations/${destinationId}/article?lang=${lang}`),
  save: (destinationId: number, data: ArticleSaveInput) =>
    api.put<ArticleEditorData>(`/admin/destinations/${destinationId}/article`, data),
};

export const publicArticleApi = {
  get: (slug: string, lang: ArticleLang) => api.get<PublicArticle>(`/destinations/${slug}/article?lang=${lang}`),
};
