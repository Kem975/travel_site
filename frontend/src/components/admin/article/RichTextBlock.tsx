import { useRef } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { RichTextEditor } from '@mantine/tiptap';
import { Group, SegmentedControl, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { TextAlign, TextSize } from '../../../api/article';

type Content = { html: string; align?: TextAlign; size?: TextSize };

// TipTap edits only this block's HTML (DECISIONS D6). Toolbar is limited to what
// the server sanitizer allows (PLAN_REVIEW A3). Alignment and type size are block
// properties rather than markup: the sanitizer strips every attribute, so they
// would not survive a round-trip if they lived inside the html.
export function RichTextBlock({ content, onChange }: { content: Content; onChange: (content: Content) => void }) {
  const { t } = useTranslation();

  // useEditor builds the editor once, so its onUpdate closure would keep whichever
  // align/size were set at that moment and quietly undo any later change on the
  // next keystroke. The ref always holds the current values.
  const latest = useRef(content);
  latest.current = content;

  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: content.html,
    onUpdate: ({ editor }) => onChange({ ...latest.current, html: editor.getHTML() }),
  });

  return (
    <>
      <RichTextEditor editor={editor}>
        {/* Not sticky: an article is a list of blocks, so a sticky toolbar would stick
            every block's toolbar at the same offset — each one floating over its own
            first line of text, and over the neighbouring blocks. In flow it can't
            overlap anything. */}
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Strikethrough />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H2 />
            <RichTextEditor.H3 />
            <RichTextEditor.H4 />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Blockquote />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content />
      </RichTextEditor>

      <Group gap="lg" mt="xs" wrap="wrap">
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            {t('article.blocks.text.align')}
          </Text>
          <SegmentedControl
            size="xs"
            value={content.align ?? 'left'}
            onChange={(value) => onChange({ ...content, align: value as TextAlign })}
            data={[
              { value: 'left', label: t('article.aligns.left') },
              { value: 'center', label: t('article.aligns.center') },
            ]}
          />
        </Group>
        <Group gap={6}>
          <Text size="xs" c="dimmed">
            {t('article.blocks.text.size')}
          </Text>
          <SegmentedControl
            size="xs"
            value={content.size ?? 'normal'}
            onChange={(value) => onChange({ ...content, size: value as TextSize })}
            data={[
              { value: 'normal', label: t('article.sizes.normal') },
              { value: 'small', label: t('article.sizes.small') },
            ]}
          />
        </Group>
      </Group>
    </>
  );
}
