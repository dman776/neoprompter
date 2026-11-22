import { lineRuns, lineText, PALETTE, type CoreState } from '../core';

const root = document.getElementById('editor')!;
const toolbar = document.createElement('div');
const list = document.createElement('div');
root.append(toolbar, list);

let active: { line: number; input: HTMLInputElement } | null = null;

const note = document.createElement('span');
note.textContent = 'Select text, then pick a color: ';
toolbar.append(note);
const addSwatch = (label: string, color: string | null, bg: string) => {
  const b = document.createElement('button');
  b.textContent = label;
  b.title = label;
  b.style.cssText = `background:${bg};color:#000;font-size:13px;padding:2px 8px;margin-right:4px`;
  // Keep the text selection in the input when the button is pressed.
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (!active) return;
    const { selectionStart, selectionEnd } = active.input;
    if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) return;
    window.neoprompter.dispatch({
      type: 'colorRange',
      line: active.line,
      start: selectionStart,
      end: selectionEnd,
      color,
    });
  });
  toolbar.append(b);
};
for (const p of PALETTE) addSwatch(p.name, p.color, p.color);
addSwatch('No color', null, '#ddd');

let rows: { input: HTMLInputElement; preview: HTMLElement }[] = [];
let renderedKey = '';

function paint(preview: HTMLElement, line: CoreState['script']['lines'][number]): void {
  preview.textContent = '';
  for (const run of lineRuns(line)) {
    const span = document.createElement('span');
    span.textContent = run.text;
    if (run.color) span.style.color = run.color;
    if (run.bold) span.style.fontWeight = 'bold';
    if (run.italic) span.style.fontStyle = 'italic';
    preview.append(span);
  }
}

export function renderEditor(state: CoreState): void {
  const lines = state.script.lines;
  const key = JSON.stringify(lines);
  if (key === renderedKey) return;
  renderedKey = key;
  if (rows.length !== lines.length) {
    list.textContent = '';
    rows = lines.map((_, i) => {
      const row = document.createElement('div');
      const input = document.createElement('input');
      input.size = 60;
      input.addEventListener('focus', () => (active = { line: i, input }));
      input.addEventListener('input', () =>
        window.neoprompter.dispatch({ type: 'editLine', line: i, text: input.value }),
      );
      const preview = document.createElement('span');
      preview.style.cssText = 'margin:0 8px;background:#000;padding:2px 6px';
      const cut = document.createElement('button');
      cut.textContent = 'Cut line';
      cut.addEventListener('click', () =>
        window.neoprompter.dispatch({ type: 'cutLines', from: i, count: 1 }),
      );
      row.append(input, preview, cut);
      list.append(row);
      return { input, preview };
    });
    active = null;
  }
  lines.forEach((line, i) => {
    const { input, preview } = rows[i];
    const text = lineText(line);
    if (input.value !== text) input.value = text;
    paint(preview, line);
  });
}
