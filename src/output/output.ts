import type { CoreState } from '../core';

const textEl = document.getElementById('text')!;
const lineEl = document.getElementById('reading-line')!;
const progressEl = document.getElementById('progress')!;
let renderedScript: string | null = null;

function render(state: CoreState): void {
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
  progressEl.style.transform = `scaleX(${state.progress})`;
}

window.neoprompter.onState(render);
window.neoprompter.getState().then(render);
