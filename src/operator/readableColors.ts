import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { displayColor } from '../core';

/** What the editor's text sits on and the color it is normally drawn in. */
export interface EditorPalette {
  surface: string;
  text: string;
}

/** The dark look's colors, used when the stylesheet's own are not available (a test). */
const FALLBACK: EditorPalette = { surface: '#11161c', text: '#dfe5ee' };

const isHex = (value: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);

/** The editor panel's surface and text colors, read from the colors now in use. */
export function readEditorPalette(): EditorPalette {
  const style = getComputedStyle(document.documentElement);
  const surface = style.getPropertyValue('--surface').trim();
  const text = style.getPropertyValue('--text').trim();
  return {
    surface: isHex(surface) ? surface : FALLBACK.surface,
    text: isHex(text) ? text : FALLBACK.text,
  };
}

/** Send a transaction with this meta to look at the colors again (after a theme change). */
export const REFRESH_READABLE_COLORS = 'readable-colors-refresh';

const key = new PluginKey<DecorationSet>('readableColors');

function build(doc: PMNode, palette: EditorPalette): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const source = node.marks.find((m) => m.type.name === 'color')?.attrs.color as
      string | undefined;
    if (!source) return;
    const shown = displayColor(source, palette.surface, palette.text);
    if (shown.toLowerCase() !== source.toLowerCase()) {
      decorations.push(Decoration.inline(pos, pos + node.nodeSize, { style: `color: ${shown}` }));
    }
  });
  return DecorationSet.create(doc, decorations);
}

/**
 * The readable-color rule for the editor, as the Output has it: a color too hard to read on the
 * editor's own background is shown in the editor's text color instead (black text is never shown
 * black on the dark theme). It is a view-only decoration: the Script, the saved colors and what
 * is copied all keep the source color (ADR 0003).
 */
export const ReadableColors = Extension.create<{ palette: () => EditorPalette }>({
  name: 'readableColors',
  addOptions() {
    return { palette: readEditorPalette };
  },
  addProseMirrorPlugins() {
    const palette = this.options.palette;
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state: EditorState) => build(state.doc, palette()),
          apply: (tr, old, _before, state) =>
            tr.docChanged || tr.getMeta(REFRESH_READABLE_COLORS)
              ? build(state.doc, palette())
              : old,
        },
        props: {
          decorations: (state) => key.getState(state),
        },
      }),
    ];
  },
});
