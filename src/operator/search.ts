import { Extension, type CommandProps, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findInText } from '../editor';

export interface SearchState {
  query: string;
  matchCase: boolean;
  /** Index of the current match, or -1 when there is none. */
  current: number;
}

interface Range {
  from: number;
  to: number;
}

const key = new PluginKey<SearchState>('search');
const empty: SearchState = { query: '', matchCase: false, current: -1 };

/** Every match in the document, in order. A match never spans two paragraphs. */
export function matchRanges(doc: PMNode, query: string, matchCase: boolean): Range[] {
  const ranges: Range[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    for (const at of findInText(node.textContent, query, matchCase)) {
      ranges.push({ from: pos + 1 + at, to: pos + 1 + at + query.length });
    }
    return false;
  });
  return ranges;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      /** Search for text; the first match at or after the caret becomes current. */
      setSearch: (query: string, matchCase?: boolean) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
    };
  }
}

/** Find and replace for the Script editor: highlights, next and previous, replace and replace all. */
export const Search = Extension.create({
  name: 'search',

  addCommands() {
    const withState =
      (next: (s: SearchState, doc: PMNode, caret: number) => SearchState) =>
      ({ tr, state, dispatch }: CommandProps) => {
        const s = key.getState(state) ?? empty;
        if (dispatch) tr.setMeta(key, next(s, state.doc, state.selection.from));
        return true;
      };
    const step = (dir: 1 | -1) =>
      withState((s, doc) => {
        const n = matchRanges(doc, s.query, s.matchCase).length;
        if (n === 0) return { ...s, current: -1 };
        return { ...s, current: (Math.max(s.current, dir === 1 ? -1 : 0) + dir + n) % n };
      });
    return {
      setSearch: (query, matchCase = false) =>
        withState((s, doc, caret) => {
          const ranges = matchRanges(doc, query, matchCase);
          const first = ranges.findIndex((r) => r.from >= caret);
          return {
            query,
            matchCase,
            current: ranges.length === 0 ? -1 : first === -1 ? 0 : first,
          };
        }),
      findNext: () => step(1),
      findPrevious: () => step(-1),
      replaceCurrent:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const s = key.getState(state) ?? empty;
          const ranges = matchRanges(state.doc, s.query, s.matchCase);
          const at = ranges[s.current];
          if (!at) return false;
          if (dispatch) {
            tr.insertText(replacement, at.from, at.to);
            // Move on to the next match after the replacement (wrapping), or none if there are none.
            const after = at.from + replacement.length;
            const rest = matchRanges(tr.doc, s.query, s.matchCase);
            const next = rest.findIndex((r) => r.from >= after);
            tr.setMeta(key, { ...s, current: rest.length === 0 ? -1 : Math.max(next, 0) });
          }
          return true;
        },
      replaceAll:
        (replacement) =>
        ({ tr, state, dispatch }) => {
          const s = key.getState(state) ?? empty;
          const ranges = matchRanges(state.doc, s.query, s.matchCase);
          if (ranges.length === 0) return false;
          if (dispatch) {
            for (const r of [...ranges].reverse()) tr.insertText(replacement, r.from, r.to);
            tr.setMeta(key, { ...s, current: -1 });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key,
        state: {
          init: () => empty,
          apply(tr, value, _old, newState) {
            const meta = tr.getMeta(key) as SearchState | undefined;
            if (meta) return meta;
            if (!tr.docChanged || value.query === '') return value;
            // Typing moved things around: keep the index inside the new match count.
            const n = matchRanges(newState.doc, value.query, value.matchCase).length;
            return {
              ...value,
              current: n === 0 ? -1 : Math.min(Math.max(value.current, 0), n - 1),
            };
          },
        },
        props: {
          decorations(state) {
            const s = key.getState(state);
            if (!s || s.query === '') return DecorationSet.empty;
            const ranges = matchRanges(state.doc, s.query, s.matchCase);
            return DecorationSet.create(
              state.doc,
              ranges.map((r, i) =>
                Decoration.inline(r.from, r.to, {
                  class: i === s.current ? 'find-match find-current' : 'find-match',
                }),
              ),
            );
          },
        },
      }),
    ];
  },
});

/** What the find bar shows: the search, how many matches there are, and where the current one is. */
export function searchSummary(
  editor: Editor,
): SearchState & { count: number; currentRange: Range | null } {
  const s = key.getState(editor.state) ?? empty;
  const ranges = s.query ? matchRanges(editor.state.doc, s.query, s.matchCase) : [];
  return { ...s, count: ranges.length, currentRange: ranges[s.current] ?? null };
}
