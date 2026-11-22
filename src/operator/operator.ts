import type { CoreState } from '../core';

const toggle = document.getElementById('toggle') as HTMLButtonElement;
const nameEl = document.getElementById('script-name')!;
const statusEl = document.getElementById('status')!;
let playing = false;

function render(state: CoreState): void {
  playing = state.playing;
  nameEl.textContent = state.script.name;
  toggle.textContent = state.playing ? 'Pause' : 'Play';
  statusEl.textContent = `${state.playing ? 'Playing' : 'Paused'} - line ${state.position.toFixed(1)}`;
}

toggle.addEventListener('click', () => {
  window.neoprompter.dispatch({ type: playing ? 'pause' : 'play' });
});

window.neoprompter.onState(render);
window.neoprompter.getState().then(render);
