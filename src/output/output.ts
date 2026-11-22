import type { CoreState } from '../core';

const textEl = document.getElementById('text')!;
const lineEl = document.getElementById('reading-line')!;
const progressEl = document.getElementById('progress')!;
let renderedScript: string | null = null;
let reportedViewport = 0;
let lastState: CoreState | null = null;

function render(state: CoreState): void {
  lastState = state;
  const a = state.appearance;
  if (renderedScript !== state.script.name) {
    textEl.replaceChildren(
      ...state.script.lines.map((line) => {
        const p = document.createElement('div');
        p.textContent = line;
        return p;
      }),
    );
    renderedScript = state.script.name;
  }
  document.body.style.background = a.backgroundColor;
  document.body.style.color = a.textColor;
  document.body.style.transform = a.mirror ? 'scaleX(-1)' : '';
  textEl.style.font = `${a.fontSize}px/${a.lineSpacing} system-ui, sans-serif`;
  const side = Math.max(a.margin, (100 - a.textWidth) / 2);
  textEl.style.left = `${side}%`;
  textEl.style.right = `${side}%`;
  lineEl.style.display = a.readingLine ? 'block' : 'none';
  const lineHeight = textEl.firstElementChild
    ? (textEl.firstElementChild as HTMLElement).getBoundingClientRect().height
    : 0;
  textEl.style.transform = `translateY(${-state.position * lineHeight}px)`;
  // Tell the core how many lines fit, so Screen jumps and end-of-Script stop are right.
  if (lineHeight > 0) {
    const lines = Math.max(1, Math.floor(window.innerHeight / lineHeight));
    if (lines !== reportedViewport) {
      reportedViewport = lines;
      window.neoprompter.dispatch({ type: 'setViewport', lines });
    }
  }
  progressEl.style.transform = `scaleX(${state.progress})`;
}

window.addEventListener('resize', () => lastState && render(lastState));
window.neoprompter.onState(render);
window.neoprompter.getState().then(render);
