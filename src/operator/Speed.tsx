import { useEffect, useRef } from 'react';
import { MAX_SPEED_LEVEL, type Command, type CoreState } from '../core';
import { levelFromDrag } from './speedDrag';
import './speed.css';

/** Dial travel: it sweeps 270 degrees from the lower left to the lower right. */
const SWEEP_DEGREES = 270;
const SEGMENTS = MAX_SPEED_LEVEL;

/** Lines per second to two decimals, as the dial and the Operator read it. */
export function formatLinesPerSecond(linesPerSecond: number): string {
  return linesPerSecond.toFixed(2);
}

/**
 * The speed meter: one segment per level, lit from the bottom. The last lit segment shows a
 * partial level through `data-fill` (0 to 1), which the stylesheet turns into brightness.
 */
export function SpeedMeter({ level }: { level: number }) {
  return (
    <section className="np-panel speed-meter" aria-label="Speed meter">
      <small>Speed</small>
      <div className="speed-meter-leds">
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
      <small>{level.toFixed(1)}</small>
    </section>
  );
}

/**
 * The speed dial: drag it up or down to set the speed like a fader. The marker and the readout
 * (lines per second) follow the core's speed. Arrow keys are handled by `useSpeedKeys`.
 */
export function SpeedDial({
  state,
  dispatch,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
}) {
  const drag = useRef<{ y: number; level: number } | null>(null);
  const level = state.speedLevel;
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = (-135 + i * (SWEEP_DEGREES / 10)) * (Math.PI / 180);
    const p = (r: number) => [(66 + Math.sin(a) * r).toFixed(1), (66 - Math.cos(a) * r).toFixed(1)];
    const [x1, y1] = p(52);
    const [x2, y2] = p(60);
    return (
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--muted)"
        strokeWidth={i % 5 === 0 ? 2.4 : 1.4}
        strokeLinecap="round"
      />
    );
  });
  return (
    <div
      className="speed-dial"
      role="slider"
      tabIndex={0}
      aria-label="Speed"
      aria-valuemin={0}
      aria-valuemax={MAX_SPEED_LEVEL}
      aria-valuenow={level}
      aria-valuetext={`${formatLinesPerSecond(state.speed)} lines per second`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        drag.current = { y: e.clientY, level };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (d) dispatch({ type: 'setSpeed', level: levelFromDrag(d.level, d.y, e.clientY) });
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <defs>
          <radialGradient id="speed-knob" cx="40%" cy="30%">
            <stop offset="0" stopColor="var(--raised)" />
            <stop offset="1" stopColor="var(--surface)" />
          </radialGradient>
        </defs>
        {ticks}
        <circle
          cx="66"
          cy="66"
          r="44"
          fill="url(#speed-knob)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <g
          data-testid="dial-marker"
          style={{
            transformOrigin: '66px 66px',
            transform: `rotate(${-135 + (level / MAX_SPEED_LEVEL) * SWEEP_DEGREES}deg)`,
          }}
        >
          <rect x="63.5" y="26" width="5" height="15" rx="2.5" fill="var(--accent)" />
        </g>
      </svg>
      <div className="speed-dial-cap">
        <div>
          <b data-testid="speed-readout">{formatLinesPerSecond(state.speed)}</b>
          <small>lines / s</small>
        </div>
      </div>
    </div>
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
