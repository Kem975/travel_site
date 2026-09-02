import { api } from './client';
import type { ArticleBlock, ArticleLang, PhotoMap } from './article';
import type { Photo } from './media';

export type RecipeStatus = 'draft' | 'published';

/** A recipe's identity — the same in every language. */
export type Recipe = {
  id: number;
  trip_id: number;
  destination_id: number | null;
  slug: string;
  cover_photo_id: number | null;
  sort_order: number;
  cover?: Photo | null;
};

/** One language's words. */
export type RecipeTranslation = {
  translation_id: number;
  lang: ArticleLang;
  title: string;
  subtitle: string | null;
  ingredients: string[];
  steps: string[];
  status: RecipeStatus;
  published_at: string | null;
};

export type AdminRecipeRow = Recipe & {
  trip_title: string;
  /** French title — the list would otherwise be blank for untitled drafts. */
  title: string | null;
  status: RecipeStatus | null;
  langs: ArticleLang[];
};

export type RecipeEditorData = {
  recipe: Recipe;
  translation: RecipeTranslation | null;
  blocks: ArticleBlock[];
  photos: PhotoMap;
  lang: ArticleLang;
  langs: ArticleLang[];
};

export type RecipeTranslationInput = {
  lang: ArticleLang;
  title: string;
  subtitle: string | null;
  ingredients: string[];
  steps: string[];
  status: RecipeStatus;
  blocks: ArticleBlock[];
};

export type PublicRecipeSummary = {
  slug: string;
  title: string;
  subtitle: string | null;
  trip_title: string;
  trip_slug: string;
  cover: Photo | null;
};

export type PublicRecipe = {
  recipe: { slug: string; cover: Photo | null };
  trip: { title: string; slug: string };
  lang: ArticleLang;
  available_langs: ArticleLang[];
  /** Null when `lang` has no published version; `available_langs` says what does. */
  translation: { title: string; subtitle: string | null; ingredients: string[]; steps: string[] } | null;
  blocks: ArticleBlock[];
  photos: PhotoMap;
};

export const recipeApi = {
  list: () => api.get<{ recipes: AdminRecipeRow[] }>('/admin/recipes').then((r) => r.recipes),
  get: (id: number, lang: ArticleLang) => api.get<RecipeEditorData>(`/admin/recipes/${id}?lang=${lang}`),
  create: (data: { title: string; trip_id: number; destination_id: number | null }) =>
    api.post<{ recipe: Recipe }>('/admin/recipes', data),
  update: (id: number, data: { trip_id: number; destination_id: number | null; slug: string }) =>
    api.put<{ recipe: Recipe }>(`/admin/recipes/${id}`, data),
  saveTranslation: (id: number, data: RecipeTranslationInput) =>
    api.put<Omit<RecipeEditorData, 'recipe' | 'langs'>>(`/admin/recipes/${id}/translation`, data),
  setCover: (id: number, photoId: number | null) =>
    api.put<{ recipe: Recipe }>(`/admin/recipes/${id}/cover`, { photo_id: photoId }),
  remove: (id: number) => api.del<{ deleted: boolean }>(`/admin/recipes/${id}`),
};

export const publicRecipeApi = {
  list: (lang: ArticleLang) =>
    api.get<{ recipes: PublicRecipeSummary[] }>(`/recipes?lang=${lang}`).then((r) => r.recipes),
  get: (slug: string, lang: ArticleLang) => api.get<PublicRecipe>(`/recipes/${slug}?lang=${lang}`),
};
