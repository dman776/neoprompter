import type { OutputState } from '../core';
import { createOutputRenderer } from './renderer';
import { fitStage, STAGE_HEIGHT, STAGE_WIDTH } from './stage';

const stage = document.getElementById('stage')!;

// The Output is always a 1920x1080 stage, scaled to the window (see stage.ts).
const render = createOutputRenderer({
  surface: document.body,
  text: document.getElementById('text')!,
  readingLine: document.getElementById('reading-line')!,
  progress: document.getElementById('progress')!,
  size: () => ({ width: STAGE_WIDTH, height: STAGE_HEIGHT }),
  report: (command) => window.neoprompter.dispatch(command),
});

function fit() {
  const { scale, left, top } = fitStage({ width: window.innerWidth, height: window.innerHeight });
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
}

let lastState: OutputState | null = null;
const draw = (state: OutputState) => render((lastState = state));

fit();
window.addEventListener('resize', fit);
// Esc takes the Output out of full screen (the main process decides whether it is full screen).
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.neoprompter.exitOutputFullscreen();
});
window.neoprompter.onState(draw);
window.neoprompter.getState().then(draw);
