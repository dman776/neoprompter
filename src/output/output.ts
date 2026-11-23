import type { OutputState } from '../core';
import { createOutputRenderer } from './renderer';

const render = createOutputRenderer({
  surface: document.body,
  text: document.getElementById('text')!,
  readingLine: document.getElementById('reading-line')!,
  progress: document.getElementById('progress')!,
  size: () => ({ width: window.innerWidth, height: window.innerHeight }),
  report: (command) => window.neoprompter.dispatch(command),
});

let lastState: OutputState | null = null;
const draw = (state: OutputState) => render((lastState = state));

window.addEventListener('resize', () => lastState && draw(lastState));
window.neoprompter.onState(draw);
window.neoprompter.getState().then(draw);
