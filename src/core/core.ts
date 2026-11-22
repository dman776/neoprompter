import { systemClock, type Clock } from './clock';
import { sampleScript } from './sampleScript';
import {
  LEAD_IN_LINES,
  LINES_PER_SECOND_PER_LEVEL,
  MAX_SPEED_LEVEL,
  type Command,
  type CoreState,
  type Script,
} from './types';

export interface CoreOptions {
  clock?: Clock;
  script?: Script;
  /** Lines per second. */
  speed?: number;
}

export interface Core {
  dispatch(command: Command): void;
  /** Current state, with position brought up to date from the clock. */
  getState(): CoreState;
  /** Called after every command that changes state. Returns an unsubscribe function. */
  subscribe(listener: (state: CoreState) => void): () => void;
}

export function createCore(options: CoreOptions = {}): Core {
  const clock = options.clock ?? systemClock;
  const script = options.script ?? sampleScript;
  const clampLevel = (l: number) => Math.max(0, Math.min(MAX_SPEED_LEVEL, Math.round(l)));
  let speedLevel = clampLevel((options.speed ?? 3) / LINES_PER_SECOND_PER_LEVEL);
  let viewportLines = 10;

  const minPosition = -LEAD_IN_LINES;
  /** Furthest the Script scrolls: last line at the bottom of the Output. */
  const maxPosition = () => Math.max(minPosition, script.lines.length - viewportLines);
  const clampPosition = (p: number) => Math.max(minPosition, Math.min(maxPosition(), p));

  let position = minPosition;
  let playStart = minPosition;
  let playing = false;
  let lastTick = clock.now();
  const listeners = new Set<(state: CoreState) => void>();

  function tick(): void {
    const now = clock.now();
    if (playing) {
      position = clampPosition(
        position + ((now - lastTick) / 1000) * speedLevel * LINES_PER_SECOND_PER_LEVEL,
      );
      if (position >= maxPosition()) playing = false;
    }
    lastTick = now;
  }

  function snapshot(): CoreState {
    const range = maxPosition() - minPosition;
    const progress = range > 0 ? Math.min(1, Math.max(0, (position - minPosition) / range)) : 0;
    return {
      script,
      position,
      progress,
      speed: speedLevel * LINES_PER_SECOND_PER_LEVEL,
      speedLevel,
      playing,
      viewportLines,
      leadIn: LEAD_IN_LINES,
    };
  }

  return {
    dispatch(command) {
      tick();
      switch (command.type) {
        case 'play':
          if (!playing) playStart = position;
          playing = position < maxPosition();
          break;
        case 'pause':
          playing = false;
          break;
        case 'setSpeed':
          speedLevel = clampLevel(command.level);
          break;
        case 'setViewport':
          viewportLines = Math.max(1, Math.round(command.lines));
          position = clampPosition(position);
          break;
        case 'jumpBack':
          position = clampPosition(position - (viewportLines - 1));
          break;
        case 'jumpForward':
          position = clampPosition(position + (viewportLines - 1));
          break;
        case 'returnToPlayStart':
          position = clampPosition(playStart);
          break;
      }
      const state = snapshot();
      listeners.forEach((l) => l(state));
    },
    getState() {
      tick();
      return snapshot();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
