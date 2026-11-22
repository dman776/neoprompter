import type { CoreState } from '../core';

const textEl = document.getElementById('text')!;
let renderedScript: string | null = null;

function render(state: CoreState): void {
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
  const lineHeight = textEl.firstElementChild
    ? (textEl.firstElementChild as HTMLElement).getBoundingClientRect().height
    : 0;
  textEl.style.transform = `translateY(${-state.position * lineHeight}px)`;
}

window.neoprompter.onState(render);
window.neoprompter.getState().then(render);
