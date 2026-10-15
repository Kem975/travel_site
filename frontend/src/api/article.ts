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

/** Blocks that hold content rather than other blocks. */
export type LeafBlock =
  | { type: 'richText'; content: { html: string; align?: TextAlign; size?: TextSize } }
  | { type: 'image'; content: { photoId: number; layout: ImageLayout; caption: string | null } }
  | { type: 'gallery'; content: { photoIds: number[]; layout: GalleryLayout } }
  | { type: 'video'; content: { videoId: string; caption: string | null } }
  | { type: 'quote'; content: { text: string; attribution: string | null } }
  | { type: 'practicalInfo'; content: { items: PracticalItem[] } }
  | { type: 'divider'; content: Record<string, never> };

/**
 * What a column may hold. Drawn from the leaves, so a column can never contain
 * another `columns` — the nesting is one level deep by construction, not by a
 * runtime check that something could forget. A divider is excluded too: a rule
 * across half the page separates nothing.
 */
export type ColumnBlock = Exclude<LeafBlock, { type: 'divider' }>;

export type ArticleBlock = LeafBlock | { type: 'columns'; content: { left: ColumnBlock; right: ColumnBlock } };

export type BlockType = ArticleBlock['type'];
export type ColumnBlockType = ColumnBlock['type'];

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

export const COLUMN_BLOCK_TYPES: ColumnBlockType[] = [
  'richText',
  'image',
  'gallery',
  'video',
  'quote',
  'practicalInfo',
];
export const BLOCK_TYPES: BlockType[] = [...COLUMN_BLOCK_TYPES, 'divider', 'columns'];

export function emptyColumnBlock(type: ColumnBlockType): ColumnBlock {
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
  }
}

export function emptyBlock(type: BlockType): ArticleBlock {
  if (type === 'divider') return { type, content: {} as Record<string, never> };
  // Two videos: the pairing this block was added for. Either side can be changed
  // to any other type from the editor, so the default costs nothing.
  if (type === 'columns') {
    return { type, content: { left: emptyColumnBlock('video'), right: emptyColumnBlock('video') } };
  }
  return emptyColumnBlock(type);
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
