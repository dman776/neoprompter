// @vitest-environment jsdom
// Renderer seam: the real Output page code, driven by a real core, in a DOM. jsdom does no layout,
// so `offsetHeight` is simulated from text length (see `charsPerLine`); the real layout is covered
// by the Electron smoke test in `e2e/`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PALETTE_COLORS,
  createCore,
  createFakeClock,
  defaultAppearance,
  outputState,
  type Command,
  type OutputState,
  type Script,
} from '../core';

const html = readFileSync(join(process.cwd(), 'src/output/index.html'), 'utf8');
const bodyHtml = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script'));

interface Mount {
  core: ReturnType<typeof createCore>;
  dispatched: Command[];
  text: HTMLElement;
  lineHeight: () => number;
}

async function mountOutput(
  script: Script,
  { charsPerLine = 1000, width = 1000, height = 700 } = {},
): Promise<Mount> {
  vi.resetModules();
  document.body.innerHTML = bodyHtml;
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  const core = createCore({ clock: createFakeClock(), script });
  const lineHeight = () =>
    core.getState().appearance.fontSize * core.getState().appearance.lineSpacing;
  // A paragraph is as tall as the visual lines its text wraps to.
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return this.id === 'text'
        ? 0
        : Math.max(1, Math.ceil((this.textContent ?? '').length / charsPerLine)) * lineHeight();
    },
  });
  const dispatched: Command[] = [];
  let listener: (state: OutputState) => void = () => {};
  const push = () => listener(outputState(core.getState()));
  // Like main.ts: every core change is broadcast to the Output.
  core.subscribe(push);
  window.neoprompter = {
    getState: async () => outputState(core.getState()),
    dispatch: (command: Command) => {
      dispatched.push(command);
      core.dispatch(command);
    },
    onState: (l: (state: OutputState) => void) => {
      listener = l;
    },
  } as unknown as typeof window.neoprompter;
  await import('./output');
  await Promise.resolve();
  push();
  return { core, dispatched, text: document.getElementById('text')!, lineHeight };
}

const lines = (m: Mount) => Array.from(m.text.children, (el) => el.textContent?.trim());
const script = (...text: string[]): Script => ({ name: 'Sunday', lines: text });

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('Output renderer', () => {
  it('shows each Script line as its own paragraph', async () => {
    const m = await mountOutput(script('one', 'two', 'three'));
    expect(lines(m)).toEqual(['one', 'two', 'three']);
  });

  it('shows live edits, cuts and colors immediately even though the Script name is unchanged', async () => {
    const m = await mountOutput(script('one', 'two', 'three'));
    m.core.dispatch({ type: 'saveScript', name: 'Sunday', text: 'one\ntwo\nthree' });
    m.core.dispatch({ type: 'loadScript', id: m.core.getState().library[0].id });
    m.core.dispatch({ type: 'editLine', line: 1, text: 'too' });
    expect(lines(m)).toEqual(['one', 'too', 'three']);

    m.core.dispatch({ type: 'cutLines', from: 0, count: 1 });
    expect(lines(m)).toEqual(['too', 'three']);

    m.core.dispatch({ type: 'colorRange', line: 0, start: 0, end: 3, color: PALETTE_COLORS[0] });
    const span = m.text.querySelector<HTMLElement>('span[data-source-color]');
    expect(span?.dataset.sourceColor).toBe(PALETTE_COLORS[0]);
  });

  it('never shows imported black text on a black background', async () => {
    const m = await mountOutput({
      name: 'Imported',
      lines: [{ runs: [{ text: 'stray black', color: '#000000' }] }],
    });
    const span = m.text.querySelector<HTMLElement>('span')!;
    const { backgroundColor, textColor } = m.core.getState().appearance;
    expect(backgroundColor).toBe(defaultAppearance.backgroundColor);
    // jsdom normalises colors to rgb(); compare against the theme color it must fall back to.
    const probe = document.createElement('span');
    probe.style.color = textColor;
    expect(span.style.color).toBe(probe.style.color);
    expect(span.style.color).not.toBe('rgb(0, 0, 0)');
  });

  it('re-evaluates every color when the background changes', async () => {
    const m = await mountOutput({
      name: 'Imported',
      lines: [{ runs: [{ text: 'dark red', color: '#8b0000' }] }],
    });
    const span = m.text.querySelector<HTMLElement>('span')!;
    const onBlack = span.style.color;
    m.core.dispatch({ type: 'setAppearance', changes: { backgroundColor: '#ffffff' } });
    window.neoprompter.dispatch({ type: 'setViewport', lines: 10 });
    expect(span.style.color).not.toBe(onBlack);
  });

  it('reports the viewport height in visual lines', async () => {
    const m = await mountOutput(script('one'), { height: 700 });
    const expected = Math.floor(700 / m.lineHeight());
    expect(m.dispatched).toContainEqual({ type: 'setViewport', lines: expected });
  });

  it('reports how many visual lines each wrapped paragraph occupies', async () => {
    const m = await mountOutput(script('short', 'x'.repeat(45), 'short'), { charsPerLine: 20 });
    const reported = m.dispatched.find((c) => c.type === 'setLineExtents');
    expect(reported).toMatchObject({ type: 'setLineExtents', extents: [1, 3, 1] });
    expect((reported as { revision: number }).revision).toBe(m.core.getState().scriptRevision);
  });

  it('measures again when the Script changes or the text width changes', async () => {
    const m = await mountOutput(script('x'.repeat(45)), { charsPerLine: 20 });
    const before = m.dispatched.filter((c) => c.type === 'setLineExtents').length;
    m.core.dispatch({ type: 'editLine', line: 0, text: 'x'.repeat(90) });
    window.neoprompter.dispatch({ type: 'setViewport', lines: 10 });
    const measurements = m.dispatched.filter((c) => c.type === 'setLineExtents');
    expect(measurements.length).toBeGreaterThan(before);
    expect(measurements.at(-1)).toMatchObject({ extents: [5] });
  });

  it('moves the text by the reading position in visual lines', async () => {
    const m = await mountOutput(script(...Array.from({ length: 40 }, (_, i) => `line ${i}`)));
    m.core.dispatch({ type: 'scrollBy', lines: 5 });
    window.neoprompter.dispatch({ type: 'setViewport', lines: 10 });
    const position = m.core.getState().position;
    expect(position).toBeGreaterThan(0);
    const shift = Number(/translateY\((.+)px\)/.exec(m.text.style.transform)![1]);
    expect(shift).toBeCloseTo(-position * m.lineHeight(), 2);
  });

  it('mirrors the whole Output and fills the Progress bar from core state', async () => {
    const m = await mountOutput(script(...Array.from({ length: 40 }, (_, i) => `line ${i}`)));
    m.core.dispatch({ type: 'toggleMirror' });
    m.core.dispatch({ type: 'scrollBy', lines: 10 });
    window.neoprompter.dispatch({ type: 'setViewport', lines: 10 });
    expect(document.body.style.transform).toBe('scaleX(-1)');
    const fill = Number(
      /scaleX\((.+)\)/.exec(document.getElementById('progress')!.style.transform)![1],
    );
    expect(fill).toBeCloseTo(m.core.getState().progress, 4);
  });
});
