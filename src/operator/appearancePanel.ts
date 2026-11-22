import type { Appearance, CoreState } from '../core';

const root = document.getElementById('appearance')!;

type NumKey = 'fontSize' | 'lineSpacing' | 'textWidth' | 'margin';
type ColorKey = 'textColor' | 'backgroundColor';
type BoolKey = 'readingLine' | 'mirror';

const dispatchChange = (changes: Partial<Appearance>) =>
  window.neoprompter.dispatch({ type: 'setAppearance', changes });

function input(label: string, type: string, attrs: Record<string, string>): HTMLInputElement {
  const wrap = document.createElement('label');
  wrap.textContent = label + ' ';
  const el = document.createElement('input');
  el.type = type;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  wrap.append(el);
  wrap.style.display = 'block';
  root.append(wrap);
  return el;
}

const nums: Record<NumKey, HTMLInputElement> = {
  fontSize: input('Font size', 'range', { min: '16', max: '160', step: '2' }),
  lineSpacing: input('Line spacing', 'range', { min: '1', max: '3', step: '0.1' }),
  textWidth: input('Text width %', 'range', { min: '30', max: '100', step: '1' }),
  margin: input('Side margin %', 'range', { min: '0', max: '40', step: '1' }),
};
const colors: Record<ColorKey, HTMLInputElement> = {
  textColor: input('Text color', 'color', {}),
  backgroundColor: input('Background', 'color', {}),
};
const bools: Record<BoolKey, HTMLInputElement> = {
  readingLine: input('Reading line', 'checkbox', {}),
  mirror: input('Mirror', 'checkbox', {}),
};

(Object.keys(nums) as NumKey[]).forEach((k) =>
  nums[k].addEventListener('input', () => dispatchChange({ [k]: Number(nums[k].value) })),
);
(Object.keys(colors) as ColorKey[]).forEach((k) =>
  colors[k].addEventListener('input', () => dispatchChange({ [k]: colors[k].value })),
);
bools.readingLine.addEventListener('change', () =>
  dispatchChange({ readingLine: bools.readingLine.checked }),
);
bools.mirror.addEventListener('change', () =>
  window.neoprompter.dispatch({ type: 'toggleMirror' }),
);

const presetSelect = document.createElement('select');
const nameInput = document.createElement('input');
nameInput.placeholder = 'Preset name';
const saveBtn = document.createElement('button');
saveBtn.textContent = 'Save Preset';
const deleteBtn = document.createElement('button');
deleteBtn.textContent = 'Delete';
root.append(presetSelect, nameInput, saveBtn, deleteBtn);

presetSelect.addEventListener('change', () => {
  if (presetSelect.value)
    window.neoprompter.dispatch({ type: 'loadPreset', name: presetSelect.value });
});
saveBtn.addEventListener('click', () => {
  window.neoprompter.dispatch({ type: 'savePreset', name: nameInput.value || presetSelect.value });
  nameInput.value = '';
});
deleteBtn.addEventListener('click', () => {
  if (presetSelect.value)
    window.neoprompter.dispatch({ type: 'deletePreset', name: presetSelect.value });
});

export function renderAppearance(state: CoreState): void {
  const a = state.appearance;
  (Object.keys(nums) as NumKey[]).forEach((k) => (nums[k].value = String(a[k])));
  (Object.keys(colors) as ColorKey[]).forEach((k) => (colors[k].value = a[k]));
  (Object.keys(bools) as BoolKey[]).forEach((k) => (bools[k].checked = a[k]));
  presetSelect.replaceChildren(
    new Option('(no Preset)', ''),
    ...state.presets.map((n) => new Option(n, n, false, n === state.activePreset)),
  );
}
