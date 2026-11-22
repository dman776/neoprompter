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
  renderLibrary(state);
  document.getElementById('restore-note')!.hidden = !state.outputBlank;
}

document.getElementById('confirm-output')!.addEventListener('click', () => {
  window.neoprompter.dispatch({ type: 'confirmOutput' });
});

const libraryEl = document.getElementById('library')!;
let libraryKey = '';

function renderLibrary(state: CoreState): void {
  const key = JSON.stringify([state.library, state.loadedScriptId]);
  if (key === libraryKey) return;
  libraryKey = key;
  libraryEl.textContent = '';
  for (const entry of state.library) {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = entry.id === state.loadedScriptId ? `${entry.name} (loaded) ` : `${entry.name} `;
    li.append(label);
    const add = (text: string, onClick: () => void) => {
      const b = document.createElement('button');
      b.textContent = text;
      b.addEventListener('click', onClick);
      li.append(b);
    };
    add('Load', () => window.neoprompter.dispatch({ type: 'loadScript', id: entry.id }));
    add('Rename', () => {
      const name = window.prompt('New name', entry.name);
      if (name) window.neoprompter.dispatch({ type: 'renameScript', id: entry.id, name });
    });
    add('Delete', () => {
      if (window.confirm(`Delete "${entry.name}"?`)) {
        window.neoprompter.dispatch({ type: 'deleteScript', id: entry.id });
      }
    });
    libraryEl.append(li);
  }
}

const newName = document.getElementById('new-name') as HTMLInputElement;
const newText = document.getElementById('new-text') as HTMLTextAreaElement;
document.getElementById('save')!.addEventListener('click', () => {
  if (!newText.value.trim()) return;
  window.neoprompter.dispatch({ type: 'saveScript', name: newName.value.trim() || 'Untitled', text: newText.value });
  newName.value = '';
  newText.value = '';
});

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
