import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { UndoRedo } from '@tiptap/extensions';
import type { CoreState, ScriptLine } from '../core';
import { docToLines, formatReadTime, linesToDoc, scriptStats } from '../editor';
import type { CoreBridge } from './useCoreState';
import { ColorMark } from './colorMark';
import { ColorTool } from './ColorTool';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';
import { BoldIcon, HeadingIcon, ItalicIcon, RedoIcon, UndoIcon } from './ui/icons';

/** How long after the last keystroke the editor sends its content to the core. */
export const SAVE_DELAY_MS = 300;

/** The schema holds only what the Script model can: paragraphs, headings, bold, italic, color. */
const extensions = [
  Document,
  Paragraph,
  Text,
  Heading.configure({ levels: [1, 2, 3, 4, 5, 6] }),
  Bold,
  Italic,
  ColorMark,
  UndoRedo,
];

const sameLines = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface ScriptEditorProps {
  bridge: CoreBridge;
  script: CoreState['script'];
  /** True only in Edit mode (the lock for Run mode comes from the core as well). */
  editable: boolean;
  /** The core's recent colors, newest first. */
  recentColors: readonly string[];
}

/** The full Script editor: formatting bar, word count, Saved state, and the document itself. */
export function ScriptEditor({ bridge, script, editable, recentColors }: ScriptEditorProps) {
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the Operator typed that has not been sent to the core yet. */
  const pending = useRef<ScriptLine[] | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const initial = useMemo(() => linesToDoc(script.lines), []); // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useRef(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    bridgeRef.current.dispatch({ type: 'setScriptLines', lines: pending.current });
    pending.current = null;
    setSaving(false);
  }).current;

  const editor = useEditor({
    extensions,
    content: initial,
    editable,
    editorProps: { attributes: { class: 'script-doc', 'aria-label': 'Script' } },
    onUpdate: ({ editor: e }) => {
      pending.current = docToLines(e.getJSON());
      setSaving(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    onBlur: () => flush(),
  });

  // Leaving Edit mode locks the editor; make sure what was typed has been sent first.
  useEffect(() => {
    if (!editor) return;
    if (!editable) flush();
    editor.setEditable(editable, false);
  }, [editor, editable, flush]);

  // A change that did not come from this editor (loading a Script, the API) replaces the
  // document. While the Operator has unsent typing, an echo of an older save must not overwrite it.
  useEffect(() => {
    if (!editor || editor.isDestroyed || pending.current) return;
    if (sameLines(docToLines(editor.getJSON()), script.lines)) return;
    editor.commands.setContent(linesToDoc(script.lines), { emitUpdate: false });
  }, [editor, script.lines]);

  // Closing the editor (for example switching to Run mode) sends what was typed.
  useEffect(() => flush, [flush]);

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: !!e?.isActive('bold'),
      italic: !!e?.isActive('italic'),
      heading: !!e?.isActive('heading'),
      canUndo: !!e?.can().undo(),
      canRedo: !!e?.can().redo(),
    }),
  });

  const stats = scriptStats(script.lines);
  const chain = () => editor?.chain().focus();

  return (
    <Panel title="Script" meta={saving ? 'Saving…' : 'Saved'} className="script-editor">
      <div className="format-bar" role="toolbar" aria-label="Formatting">
        <Button
          square
          variant="ghost"
          aria-label="Undo"
          disabled={!editable || !active?.canUndo}
          onClick={() => chain()?.undo().run()}
        >
          <UndoIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Redo"
          disabled={!editable || !active?.canRedo}
          onClick={() => chain()?.redo().run()}
        >
          <RedoIcon />
        </Button>
        <span className="format-sep" />
        <Button
          square
          variant="ghost"
          aria-label="Heading"
          aria-pressed={active?.heading}
          lit={active?.heading}
          disabled={!editable}
          onClick={() => chain()?.toggleHeading({ level: 1 }).run()}
        >
          <HeadingIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Bold"
          aria-pressed={active?.bold}
          lit={active?.bold}
          disabled={!editable}
          onClick={() => chain()?.toggleBold().run()}
        >
          <BoldIcon />
        </Button>
        <Button
          square
          variant="ghost"
          aria-label="Italic"
          aria-pressed={active?.italic}
          lit={active?.italic}
          disabled={!editable}
          onClick={() => chain()?.toggleItalic().run()}
        >
          <ItalicIcon />
        </Button>
        <ColorTool
          editor={editor}
          editable={editable}
          recentColors={recentColors}
          onUse={(color) => bridge.dispatch({ type: 'pickColor', color })}
        />
        <span className="word-count" aria-live="polite">
          <b>{stats.words}</b> words · <b>{formatReadTime(stats.readSeconds)}</b>
        </span>
      </div>
      <div className="script-scroll">
        <EditorContent editor={editor} />
      </div>
    </Panel>
  );
}
