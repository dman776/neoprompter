import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { CoreState } from '../core';
import {
  ACTION_LABELS,
  BUTTON_IDS,
  JOG_WRAP,
  defaultButtonMapping,
  wheelToLines,
  type ButtonId,
  type ButtonMappingView,
  type DeviceEvent,
} from '../input';
import { Panel } from '../operator/ui/Panel';

/** The slice of `window.neoprompter` the Virtual shuttle uses; a test passes a fake. */
export interface ShuttleBridge {
  getState(): Promise<CoreState>;
  onState(listener: (state: CoreState) => void): void;
  sendDeviceEvent(event: DeviceEvent): void;
  getButtonMapping(): Promise<ButtonMappingView>;
  onButtonMapping(listener: (view: ButtonMappingView) => void): void;
}

/** Ring travel either side of centre, in degrees; the ring springs back on release. */
export const RING_MAX_DEGREES = 60;
/** The jog wheel counts one step per this many degrees; the count itself is continuous. */
export const JOG_DEGREES_PER_STEP = 15;

const angleOf = (el: HTMLElement, e: { clientX: number; clientY: number }): number => {
  const r = el.getBoundingClientRect();
  return (
    (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) /
    Math.PI
  );
};

/** Shortest signed turn between two angles, in degrees. */
const turn = (from: number, to: number): number => {
  let d = to - from;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

const capture = (el: HTMLElement, id: number) => {
  try {
    el.setPointerCapture?.(id);
  } catch {
    /* a synthetic pointer cannot be captured */
  }
};

const labelOf = (action: string) => ACTION_LABELS[action] ?? action;

/**
 * The Virtual shuttle: a ring that springs back, a continuous jog wheel and five buttons. It sends
 * the same device events the real ShuttleXPress would, and the main process maps them.
 */
export function VirtualShuttle({ bridge }: { bridge: ShuttleBridge }) {
  const [state, setState] = useState<CoreState | null>(null);
  const [mapping, setMapping] = useState<ButtonMappingView>({
    mapping: defaultButtonMapping,
    actions: [],
  });
  const [ring, setRing] = useState(0);
  const [jogDegrees, setJogDegrees] = useState(0);
  const [down, setDown] = useState<ButtonId[]>([]);
  const ringStart = useRef<number | null>(null);
  const jogLast = useRef<number | null>(null);
  const jogCount = useRef(0);

  useEffect(() => {
    let live = true;
    bridge.onState((s) => live && setState(s));
    bridge.onButtonMapping((v) => live && setMapping(v));
    void bridge.getState().then((s) => live && setState((c) => c ?? s));
    void bridge.getButtonMapping().then((v) => live && setMapping(v));
    // A fresh window starts its counter at 0: tell the mapper so it does not see a jump.
    bridge.sendDeviceEvent({ kind: 'jog', position: 0, rebase: true });
    // Closing the window mid-drag must not leave the ring deflected.
    const release = () => bridge.sendDeviceEvent({ kind: 'ring', deflection: 0 });
    window.addEventListener('pagehide', release);
    return () => {
      live = false;
      window.removeEventListener('pagehide', release);
    };
  }, [bridge]);

  const send = (event: DeviceEvent) => bridge.sendDeviceEvent(event);

  const ringDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    capture(e.currentTarget, e.pointerId);
    ringStart.current = angleOf(e.currentTarget, e);
  };
  const ringMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (ringStart.current === null) return;
    const deflection = Math.max(
      -1,
      Math.min(1, turn(ringStart.current, angleOf(e.currentTarget, e)) / RING_MAX_DEGREES),
    );
    setRing(deflection);
    send({ kind: 'ring', deflection });
  };
  const ringUp = () => {
    if (ringStart.current === null) return;
    ringStart.current = null;
    setRing(0);
    send({ kind: 'ring', deflection: 0 });
  };

  const jogDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    capture(e.currentTarget, e.pointerId);
    jogLast.current = angleOf(e.currentTarget, e);
  };
  const jogMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (jogLast.current === null) return;
    const now = angleOf(e.currentTarget, e);
    const d = turn(jogLast.current, now);
    jogLast.current = now;
    if (d === 0) return;
    setJogDegrees((deg) => deg + d);
    jogCount.current =
      (((jogCount.current + d / JOG_DEGREES_PER_STEP) % JOG_WRAP) + JOG_WRAP) % JOG_WRAP;
    send({ kind: 'jog', position: jogCount.current });
  };
  const jogUp = () => {
    jogLast.current = null;
  };

  const press = (button: ButtonId, pressed: boolean) => {
    setDown((d) => (pressed ? [...new Set([...d, button])] : d.filter((b) => b !== button)));
    send({ kind: 'button', button, pressed });
  };

  return (
    <main
      className="shuttle"
      onWheel={(e) => send({ kind: 'scroll', lines: wheelToLines(e.deltaY, e.deltaMode) })}
    >
      <Panel className="shuttle-device">
        <p className="shuttle-cap">Contour ShuttleXPress · virtual</p>
        <div className="shuttle-wheel">
          <div
            className="shuttle-ring"
            data-testid="ring"
            aria-label="Shuttle ring"
            onPointerDown={ringDown}
            onPointerMove={ringMove}
            onPointerUp={ringUp}
            onPointerCancel={ringUp}
          >
            <span
              className="shuttle-ring-mark"
              style={{ transform: `rotate(${ring * RING_MAX_DEGREES}deg)` }}
            />
            <div
              className="shuttle-jog"
              data-testid="jog"
              aria-label="Jog wheel"
              onPointerDown={jogDown}
              onPointerMove={jogMove}
              onPointerUp={jogUp}
              onPointerCancel={jogUp}
            >
              <span
                className="shuttle-jog-mark"
                style={{ transform: `rotate(${jogDegrees}deg)` }}
              />
            </div>
          </div>
        </div>
        <div className="shuttle-buttons">
          {BUTTON_IDS.map((id) => (
            <div key={id} className="shuttle-button-cell">
              <button
                type="button"
                className="shuttle-button"
                data-down={down.includes(id) ? 'true' : undefined}
                aria-label={`Button ${id}, ${labelOf(mapping.mapping[id])}`}
                onPointerDown={() => press(id, true)}
                onPointerUp={() => press(id, false)}
                onPointerCancel={() => press(id, false)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) press(id, true);
                }}
                onKeyUp={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') press(id, false);
                }}
              >
                {id}
              </button>
              <span className="shuttle-button-label">{labelOf(mapping.mapping[id])}</span>
            </div>
          ))}
        </div>
        <div className="shuttle-readout">
          <span>Ring {ring.toFixed(1)}</span>
          <span>{state ? `${state.speed.toFixed(2)} lines/s` : '--'}</span>
          <span>Buttons {down.length ? down.join(' ') : '—'}</span>
        </div>
      </Panel>
    </main>
  );
}
