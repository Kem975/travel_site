import { useTranslation } from 'react-i18next';
import type { ArticleLang } from '../api/article';

/**
 * The interface language, narrowed to the two the content is written in. i18next
 * can report regional tags ('en-GB'), which no article or recipe is keyed on.
 */
export function useUiLang(): ArticleLang {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('en') ? 'en' : 'fr';
}
