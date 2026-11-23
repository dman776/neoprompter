import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { MAX_SPEED_LEVEL, type Command, type CoreState } from '../core';
import { levelFromMeter } from './speedMeter';
import './speed.css';

const SEGMENTS = MAX_SPEED_LEVEL;

/** Lines per second to two decimals, as the Operator reads it. */
export function formatLinesPerSecond(linesPerSecond: number): string {
  return linesPerSecond.toFixed(2);
}

/**
 * The speed meter, and the Operator's mouse control for speed: one segment per level, lit from
 * the bottom, the last lit segment showing a partial level through `data-fill` (0 to 1). Press or
 * drag anywhere on it to set the speed like a fader (top is fastest, bottom is stopped); the
 * readout under it is lines per second. Arrow keys are handled by `useSpeedKeys`.
 */
export function SpeedMeter({
  state,
  dispatch,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
}) {
  const level = state.speedLevel;
  const dragging = useRef(false);
  const setFrom = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    dispatch({ type: 'setSpeed', level: levelFromMeter(event.clientY, box.top, box.height) });
  };
  return (
    <section className="np-panel speed-meter" aria-label="Speed meter">
      <small>Speed</small>
      <div
        className="speed-meter-leds"
        role="slider"
        tabIndex={0}
        aria-label="Speed"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={MAX_SPEED_LEVEL}
        aria-valuenow={level}
        aria-valuetext={`${formatLinesPerSecond(state.speed)} lines per second`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragging.current = true;
          setFrom(e);
        }}
        onPointerMove={(e) => dragging.current && setFrom(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const fill = Math.max(0, Math.min(1, level - i));
          return (
            <i
              key={i}
              data-fill={fill}
              data-hot={i >= SEGMENTS - 2 ? 'true' : undefined}
              style={{ '--fill': fill } as React.CSSProperties}
            />
          );
        })}
      </div>
      <div className="speed-readout">
        <b data-testid="speed-readout">{formatLinesPerSecond(state.speed)}</b>
        <small>lines/s</small>
      </div>
    </section>
  );
}

/** True when the key press is going to a place where arrow keys mean something else. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (el.isContentEditable || /^(TEXTAREA|SELECT)$/.test(el.tagName)) return true;
  return el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range';
}

/**
 * Up and down arrows nudge the speed (Shift for a larger step), also while playing, and never
 * while the Operator types in a text field.
 */
export function useSpeedKeys(dispatch: (command: Command) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      dispatch({ type: 'nudgeSpeed', direction: e.key === 'ArrowUp' ? 1 : -1, big: e.shiftKey });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
}
