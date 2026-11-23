import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import { UndoRedo } from '@tiptap/extensions';
import { lineText, sameLine, type CoreState, type ScriptLine } from '../core';
import { cleanPastedHtml, docToLines, formatReadTime, linesToDoc, scriptStats } from '../editor';
import type { CoreBridge } from './useCoreState';
import { ColorMark } from './colorMark';
import { FindBar } from './FindBar';
import { Search } from './search';
import { ColorTool } from './ColorTool';
import { Panel } from './ui/Panel';
import { Button } from './ui/Button';
import { BoldIcon, HeadingIcon, ItalicIcon, RedoIcon, SearchIcon, UndoIcon } from './ui/icons';

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
  Search,
];

const sameLines = (a: ScriptLine[], b: ScriptLine[]) =>
  a.length === b.length && a.every((line, i) => sameLine(line, b[i]));

/** What the Operator view can ask of the editor from outside (menu items, the mode switch). */
export interface EditorHandle {
  /** Send any typing that has not been saved yet; call it before the mode changes. */
  flush(): void;
  undo(): void;
  redo(): void;
  /** Open the find bar (the Edit menu's Find). */
  find(): void;
}

export const SAVE_REJECTED_TEXT =
  'Your last typing could not be saved, because the Script was locked. Switch back to Edit mode and check it.';

interface ScriptEditorProps {
  bridge: CoreBridge;
  script: CoreState['script'];
  /** True only in Edit mode (the lock for Run mode comes from the core as well). */
  editable: boolean;
  /** The core's recent colors, newest first. */
  recentColors: readonly string[];
  /** Filled with the editor's controls while it is mounted. */
  handle?: MutableRefObject<EditorHandle | null>;
  /** Called with a plain message when the core did not keep what the editor sent. */
  onSaveRejected?: (message: string) => void;
}

/** The full Script editor: formatting bar, word count, Saved state, and the document itself. */
export function ScriptEditor({
  bridge,
  script,
  editable,
  recentColors,
  handle,
  onSaveRejected,
}: ScriptEditorProps) {
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** What the Operator typed that has not been sent to the core yet. */
  const pending = useRef<ScriptLine[] | null>(null);
  const bridgeRef = useRef(bridge);
  bridgeRef.current = bridge;
  const initial = useMemo(() => linesToDoc(script.lines), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** The last save sent and the Script lines before it, until the core's echo of it arrives. */
  const inFlight = useRef<{ before: ScriptLine[]; sent: ScriptLine[] } | null>(null);
  const linesRef = useRef(script.lines);
  linesRef.current = script.lines;
  const rejectedRef = useRef(onSaveRejected);
  rejectedRef.current = onSaveRejected;

  const flush = useRef(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!pending.current) return;
    const sent = pending.current;
    inFlight.current = { before: linesRef.current, sent };
    bridgeRef.current.dispatch({ type: 'setScriptLines', lines: sent });
    pending.current = null;
    setSaving(false);
    // The core refuses edits it should not take (the Script is locked in Run mode). Look at what
    // it kept, by text, and say so if the typing is gone, unless more typing has come since.
    void bridgeRef.current.getState().then((s) => {
      if (pending.current) return;
      const kept = s.script.lines.map(lineText).join('\n');
      if (kept !== sent.map(lineText).join('\n')) rejectedRef.current?.(SAVE_REJECTED_TEXT);
    });
  }).current;

  const editor = useEditor({
    extensions,
    content: initial,
    editable,
    editorProps: {
      attributes: { class: 'script-doc', 'aria-label': 'Script' },
      // Clean paste (ADR 0003): structure, emphasis and color stay; fonts, sizes and spacing go.
      transformPastedHTML: cleanPastedHtml,
    },
    onUpdate: ({ editor: e }) => {
      pending.current = docToLines(e.getJSON());
      setSaving(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    onBlur: () => flush(),
  });

  useEffect(() => {
    if (!handle) return;
    handle.current = {
      flush,
      undo: () => void (editor?.isEditable && editor.chain().focus().undo().run()),
      redo: () => void (editor?.isEditable && editor.chain().focus().redo().run()),
      find: () => setFinding(true),
    };
    return () => {
      handle.current = null;
    };
  }, [handle, editor, flush]);

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
    // A state that was sent before our last save reached the core is older than the editor:
    // ignore it, so the typing does not flicker back and the undo history is kept.
    const flight = inFlight.current;
    if (flight) {
      if (sameLines(script.lines, flight.before) && !sameLines(flight.before, flight.sent)) return;
      inFlight.current = null;
    }
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
  const closeFind = () => {
    setFinding(false);
    editor?.commands.focus();
  };
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
        <Button
          square
          variant="ghost"
          aria-label="Find"
          aria-pressed={finding}
          lit={finding}
          onClick={() => setFinding(!finding)}
        >
          <SearchIcon />
        </Button>
        <ColorTool
          editor={editor}
          editable={editable}
          recentColors={recentColors}
          onColorPicked={(color) => bridge.dispatch({ type: 'pickColor', color })}
        />
        <span className="word-count" aria-live="polite">
          <b>{stats.words}</b> words · <b>{formatReadTime(stats.readSeconds)}</b>
        </span>
      </div>
      {finding && editor && <FindBar editor={editor} editable={editable} onClose={closeFind} />}
      <div
        className="script-scroll"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            setFinding(true);
          }
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </Panel>
  );
}
