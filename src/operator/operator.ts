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
  renderLibrary(state);
}

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
