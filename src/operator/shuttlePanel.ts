import type { Command, CoreState } from '../core';
import {
  BUTTON_IDS,
  JOG_WRAP,
  createInputMapper,
  keyToAction,
  wheelToLines,
  type ButtonId,
  type ButtonMapping,
} from '../input';

const root = document.getElementById('shuttle')!;
const STORAGE_KEY = 'neoprompter.buttonMapping';

let state: CoreState | null = null;

/** The mapper's view of the core: commands go over IPC, state is the last broadcast. */
const operatorCoreProxy = {
  dispatch(command: Command) {
    // Keep rapid repeated actions (jog turns, key repeat) from reading stale state.
    if (state && command.type === 'setSpeed') {
      state = { ...state, speedLevel: Math.max(0, Math.min(10, Math.round(command.level))) };
    }
    window.neoprompter.dispatch(command);
  },
  getState: () => state!,
};

function loadMapping(): Partial<ButtonMapping> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function saveMapping(mapping: ButtonMapping): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
  } catch {
    /* mapping just will not persist */
  }
}

export const mapper = createInputMapper(operatorCoreProxy, loadMapping());

const label: Record<string, string> = {
  none: 'Unassigned',
  playPause: 'Play / pause',
  jumpBack: 'Back a Screen',
  jumpForward: 'Forward a Screen',
  returnToPlayStart: 'Return to play start',
  speedUp: 'Speed up',
  speedDown: 'Speed down',
  dismissNotification: 'Dismiss Notification',
};

// ---- Layout: ring around a jog wheel, five buttons below ----
const style = document.createElement('style');
style.textContent = `
  #shuttle .device { display: inline-block; padding: 12px; background: #333; border-radius: 16px; user-select: none; }
  #shuttle .ring { position: relative; width: 200px; height: 200px; border-radius: 50%; background: #111; border: 4px solid #555; touch-action: none; }
  #shuttle .ring-mark { position: absolute; left: 50%; top: 4px; width: 8px; height: 20px; margin-left: -4px; background: #f5a623; border-radius: 4px; transform-origin: 4px 96px; }
  #shuttle .jog { position: absolute; left: 50px; top: 50px; width: 100px; height: 100px; border-radius: 50%; background: #444; border: 3px solid #777; touch-action: none; }
  #shuttle .jog-mark { position: absolute; left: 50%; top: 4px; width: 6px; height: 16px; margin-left: -3px; background: #eee; border-radius: 3px; transform-origin: 3px 46px; }
  #shuttle .buttons { display: flex; gap: 6px; margin-top: 10px; }
  #shuttle .buttons div { text-align: center; font-size: 11px; }
  #shuttle .buttons button { width: 44px; height: 44px; border-radius: 50%; font-size: 16px; padding: 0; }
  #shuttle select { width: 70px; font-size: 10px; }
`;
document.head.append(style);

const device = document.createElement('div');
device.className = 'device';
const ring = document.createElement('div');
ring.className = 'ring';
const ringMark = document.createElement('div');
ringMark.className = 'ring-mark';
const jog = document.createElement('div');
jog.className = 'jog';
const jogMark = document.createElement('div');
jogMark.className = 'jog-mark';
jog.append(jogMark);
ring.append(ringMark, jog);
const buttonsEl = document.createElement('div');
buttonsEl.className = 'buttons';
device.append(ring, buttonsEl);

const readout = document.createElement('p');
root.append(device, readout);

const RING_MAX_ANGLE = 60; // degrees of ring travel either side of centre
function setRingMark(deflection: number): void {
  ringMark.style.transform = `rotate(${deflection * RING_MAX_ANGLE}deg)`;
}

const angleOf = (el: HTMLElement, e: PointerEvent): number => {
  const r = el.getBoundingClientRect();
  return (
    (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) /
    Math.PI
  );
};

// Ring: drag around the outside; it springs back to centre on release.
let ringStart: number | null = null;
ring.addEventListener('pointerdown', (e) => {
  if (e.target === jog || jog.contains(e.target as Node)) return;
  ring.setPointerCapture(e.pointerId);
  ringStart = angleOf(ring, e);
});
ring.addEventListener('pointermove', (e) => {
  if (ringStart === null) return;
  let d = angleOf(ring, e) - ringStart;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const deflection = Math.max(-1, Math.min(1, d / RING_MAX_ANGLE));
  setRingMark(deflection);
  mapper.handle({ kind: 'ring', deflection });
});
const releaseRing = () => {
  if (ringStart === null) return;
  ringStart = null;
  setRingMark(0);
  mapper.handle({ kind: 'ring', deflection: 0 });
};
ring.addEventListener('pointerup', releaseRing);
ring.addEventListener('pointercancel', releaseRing);

// Jog wheel: turning it by a detent (15 degrees) moves the counter by one.
const DETENT_DEGREES = 15;
let jogLast: number | null = null;
let jogCounter = 0;
let jogAngle = 0;
jog.addEventListener('pointerdown', (e) => {
  jog.setPointerCapture(e.pointerId);
  jogLast = angleOf(jog, e);
});
jog.addEventListener('pointermove', (e) => {
  if (jogLast === null) return;
  const a = angleOf(jog, e);
  let d = a - jogLast;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  const steps = Math.trunc(d / DETENT_DEGREES);
  if (steps === 0) return;
  jogLast += steps * DETENT_DEGREES;
  jogAngle += steps * DETENT_DEGREES;
  jogMark.style.transform = `rotate(${jogAngle}deg)`;
  jogCounter = (((jogCounter + steps) % JOG_WRAP) + JOG_WRAP) % JOG_WRAP;
  mapper.handle({ kind: 'jog', position: jogCounter });
});
const endJog = () => (jogLast = null);
jog.addEventListener('pointerup', endJog);
jog.addEventListener('pointercancel', endJog);
// Establish the counter baseline so the first turn is a delta.
mapper.handle({ kind: 'jog', position: jogCounter });

// Buttons with a remap selector under each.
for (const id of BUTTON_IDS) {
  const cell = document.createElement('div');
  const btn = document.createElement('button');
  btn.textContent = String(id);
  const sel = document.createElement('select');
  for (const action of mapper.availableActions())
    sel.add(new Option(label[action] ?? action, action));
  sel.value = mapper.getMapping()[id as ButtonId];
  sel.addEventListener('change', () => {
    mapper.setButton(id, sel.value);
    saveMapping(mapper.getMapping());
  });
  btn.addEventListener('pointerdown', () =>
    mapper.handle({ kind: 'button', button: id, pressed: true }),
  );
  btn.addEventListener('pointerup', () =>
    mapper.handle({ kind: 'button', button: id, pressed: false }),
  );
  cell.append(btn, document.createElement('br'), sel);
  buttonsEl.append(cell);
}

// Keyboard and mouse/trackpad go through the same mapper.
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, button') && e.key !== 'PageUp' && e.key !== 'PageDown')
    return;
  const action = keyToAction(e.key);
  if (!action) return;
  e.preventDefault();
  mapper.runAction(action);
});
document.addEventListener(
  'wheel',
  (e) => {
    // Only the Virtual shuttle area repositions; everywhere else the page scrolls normally.
    if (!(e.target as HTMLElement).closest('#shuttle')) return;
    e.preventDefault();
    mapper.handle({ kind: 'scroll', lines: wheelToLines(e.deltaY, e.deltaMode) });
  },
  { passive: false },
);

export function renderShuttle(next: CoreState): void {
  state = next;
  readout.textContent = `Speed ${next.speedLevel} of 10, ${next.speed.toFixed(1)} lines/s`;
}
