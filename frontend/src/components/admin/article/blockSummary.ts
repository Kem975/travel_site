import type { ArticleBlock } from '../../../api/article';

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Plain text of a rich-text block, for counting words. */
function textOf(html: string): string {
  // DOMParser builds an inert document: no scripts run and no images load, which
  // matters because this html is author input even though the server sanitises it.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // An element boundary is a word boundary. textContent on its own runs the last
  // word of one paragraph into the first of the next, which quietly undercounts
  // by one per paragraph — on the very number this summary exists to show.
  doc.body.querySelectorAll('*').forEach((el) => el.append(' '));
  return doc.body.textContent ?? '';
}

function words(html: string): number {
  const text = textOf(html).trim();
  return text === '' ? 0 : text.split(/\s+/).length;
}

function snippet(value: string, max = 48): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? `« ${clean} »` : `« ${clean.slice(0, max)}… »`;
}

/** The part after the type name — what this particular block holds. */
function detail(block: ArticleBlock, t: Translate): string | null {
  switch (block.type) {
    case 'richText': {
      const count = words(block.content.html);
      return count === 0 ? t('article.summary.empty') : t('article.summary.words', { count });
    }
    case 'gallery':
      return t('article.summary.photos', { count: block.content.photoIds.length });
    case 'practicalInfo':
      return t('article.summary.rows', { count: block.content.items.length });
    case 'quote':
      return block.content.text.trim() === '' ? t('article.summary.empty') : snippet(block.content.text);
    case 'image':
    case 'video':
      return block.content.caption ? snippet(block.content.caption) : null;
    case 'columns':
      // Deleting a row deletes both sides, so both are named.
      return `${blockSummary(block.content.left, t)} + ${blockSummary(block.content.right, t)}`;
    default:
      return null;
  }
}

/**
 * What a block holds, in one line — "Texte (124 mots)", "Galerie (6 photos)".
 *
 * A block has no title to put in a delete prompt the way a trip or a recipe does,
 * and "delete this block?" alone tells the author nothing about the weight of
 * what is about to go. The word count is the point: it is what makes the
 * difference between an empty paragraph and an afternoon's writing visible
 * *before* the click, not after.
 */
export function blockSummary(block: ArticleBlock, t: Translate): string {
  const label = t(`article.types.${block.type}`);
  const extra = detail(block, t);
  return extra ? `${label} (${extra})` : label;
}
