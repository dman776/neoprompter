import { displayColor, lineHeading, lineRuns, lineText, type CoreState } from '../core';

const textEl = document.getElementById('text')!;
const lineEl = document.getElementById('reading-line')!;
const progressEl = document.getElementById('progress')!;
let renderedRevision: number | null = null;
let measuredKey = '';
let reportedViewport = 0;
let lastState: CoreState | null = null;

function render(state: CoreState): void {
  lastState = state;
  const a = state.appearance;
  document.body.style.visibility = state.outputBlank ? 'hidden' : 'visible';
  if (renderedRevision !== state.scriptRevision) {
    textEl.replaceChildren(
      ...state.script.lines.map((line) => {
        const p = document.createElement('div');
        // A heading is bold; its size stays the Preset's so line spacing and scrolling hold.
        if (lineHeading(line) !== undefined) p.style.fontWeight = 'bold';
        for (const run of lineRuns(line)) {
          const span = document.createElement('span');
          span.textContent = run.text;
          if (run.bold) span.style.fontWeight = 'bold';
          if (run.italic) span.style.fontStyle = 'italic';
          // Source color is kept on the span; the readable-color guard runs every render.
          if (run.color) span.dataset.sourceColor = run.color;
          p.append(span);
        }
        // Keep empty lines one line tall.
        if (!p.hasChildNodes() || lineText(line) === '') p.append(document.createTextNode(' '));
        return p;
      }),
    );
    renderedRevision = state.scriptRevision;
    measuredKey = '';
  }
  document.body.style.background = a.backgroundColor;
  document.body.style.color = a.textColor;
  for (const span of textEl.querySelectorAll<HTMLElement>('span[data-source-color]')) {
    span.style.color = displayColor(span.dataset.sourceColor, a.backgroundColor, a.textColor);
  }
  document.body.style.transform = a.mirror ? 'scaleX(-1)' : '';
  textEl.style.font = `${a.fontSize}px/${a.lineSpacing} system-ui, sans-serif`;
  const side = Math.max(a.margin, (100 - a.textWidth) / 2);
  textEl.style.left = `${side}%`;
  textEl.style.right = `${side}%`;
  lineEl.style.display = a.readingLine ? 'block' : 'none';
  // One visual line, in px. Position, speed and the viewport are in these units; a Script line
  // (paragraph) that wraps occupies several, which the core learns from the measurement below.
  const lineHeight = a.fontSize * a.lineSpacing;
  textEl.style.transform = `translateY(${-state.position * lineHeight}px)`;
  const key = [state.scriptRevision, a.fontSize, a.lineSpacing, a.textWidth, a.margin, window.innerWidth].join('|');
  if (key !== measuredKey && lineHeight > 0) {
    measuredKey = key;
    const extents = Array.from(textEl.children, (el) =>
      Math.max(1, Math.round((el as HTMLElement).offsetHeight / lineHeight)),
    );
    window.neoprompter.dispatch({ type: 'setLineExtents', extents, revision: state.scriptRevision });
  }
  const lines = Math.max(1, Math.floor(window.innerHeight / lineHeight));
  if (lines !== reportedViewport) {
    reportedViewport = lines;
    window.neoprompter.dispatch({ type: 'setViewport', lines });
  }
  progressEl.style.transform = `scaleX(${state.progress})`;
}

window.addEventListener('resize', () => lastState && render(lastState));
window.neoprompter.onState(render);
window.neoprompter.getState().then(render);
