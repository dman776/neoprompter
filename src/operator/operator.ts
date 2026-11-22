import type { CoreState } from '../core';

const toggle = document.getElementById('toggle') as HTMLButtonElement;
const nameEl = document.getElementById('script-name')!;
const statusEl = document.getElementById('status')!;
import { renderAppearance } from './appearancePanel';
let playing = false;

function render(state: CoreState): void {
  renderAppearance(state);
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

const monitorSel = document.getElementById('output-monitor') as HTMLSelectElement;
const windowedBox = document.getElementById('output-windowed') as HTMLInputElement;
const outputNote = document.getElementById('output-note')!;

function renderOutput(view: Awaited<ReturnType<typeof window.neoprompter.getOutputView>>): void {
  monitorSel.innerHTML = '';
  const none = new Option('(none chosen)', '');
  monitorSel.add(none);
  for (const m of view.monitors) {
    monitorSel.add(new Option(m.label + (m.isOperatorDisplay ? ' - this screen' : ''), m.id));
  }
  monitorSel.value = view.chosenMonitorId ?? '';
  windowedBox.checked = view.windowed;
  outputNote.textContent =
    !view.windowed && view.chosenMonitorId && !view.monitors.some((m) => m.id === view.chosenMonitorId)
      ? 'Chosen monitor is not connected; the Output is closed.'
      : '';
}

monitorSel.addEventListener('change', () => {
  if (monitorSel.value) window.neoprompter.chooseOutputMonitor(monitorSel.value).then(renderOutput);
});
windowedBox.addEventListener('change', () => {
  window.neoprompter.setWindowedOutput(windowedBox.checked).then(renderOutput);
});
window.neoprompter.getOutputView().then(renderOutput);
