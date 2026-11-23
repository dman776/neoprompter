import { useEffect, type ReactNode } from 'react';
import { formatTimeLeft, type Command, type CoreState } from '../core';
import { keyToAction } from '../input';
import { SpeedDial, isTyping } from './Speed';
import { Key } from './ui/Key';
import { BackScreenIcon, ForwardScreenIcon, PauseIcon, PlayIcon, PlayStartIcon } from './ui/icons';

/**
 * Space plays and pauses; Page Up and Page Down go back and forward a Screen (the key table is
 * `keyToAction` in src/input, the same actions the Virtual shuttle's buttons run). The arrow keys
 * are `useSpeedKeys`. A focused button or text field keeps its own keys.
 */
export function useTransportKeys(state: CoreState, dispatch: (command: Command) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      const action = keyToAction(e.key);
      const command: Command | null =
        action === 'playPause'
          ? { type: state.playing ? 'pause' : 'play' }
          : action === 'jumpBack'
            ? { type: 'jumpBack' }
            : action === 'jumpForward'
              ? { type: 'jumpForward' }
              : null;
      if (!command) return;
      e.preventDefault();
      dispatch(command);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.playing, dispatch]);
}

/**
 * The transport: Play and Pause, Back a Screen, Forward a Screen and Play start, with time left
 * and position beside them, and the speed dial in the `speed-dial` slot.
 */
export function Transport({
  state,
  dispatch,
  lock,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
  /** The Script lock, shown here when the right-hand column is collapsed. */
  lock?: ReactNode;
}) {
  return (
    <div className="np-panel run-transport" data-testid="transport">
      <div className="run-slot run-slot-dial" data-slot="speed-dial">
        <SpeedDial state={state} dispatch={dispatch} />
      </div>
      <div className="run-keys">
        <Key
          icon={<PlayStartIcon />}
          caption="Play start"
          onClick={() => dispatch({ type: 'returnToPlayStart' })}
        />
        <Key
          icon={<BackScreenIcon />}
          caption="Back a Screen"
          onClick={() => dispatch({ type: 'jumpBack' })}
        />
        <Key
          big
          icon={state.playing ? <PauseIcon /> : <PlayIcon />}
          caption={state.playing ? 'Pause' : 'Play'}
          onClick={() => dispatch({ type: state.playing ? 'pause' : 'play' })}
        />
        <Key
          icon={<ForwardScreenIcon />}
          caption="Forward a Screen"
          onClick={() => dispatch({ type: 'jumpForward' })}
        />
      </div>
      <div className="run-read">
        <div>
          <b data-testid="time-left">{formatTimeLeft(state.remainingLines, state.speed)}</b>
          <small>Time left</small>
        </div>
        <div>
          <b data-testid="position">{Math.round(state.progress * 100)}%</b>
          <small>Position</small>
        </div>
        <div className="run-size" data-testid="text-size">
          <div className="run-size-keys">
            <button
              type="button"
              aria-label="Smaller text"
              title="Smaller text (Ctrl or Command and minus)"
              onClick={() => dispatch({ type: 'nudgeFontSize', direction: -1 })}
            >
              A<span aria-hidden="true">−</span>
            </button>
            <b data-testid="text-size-value">{state.appearance.fontSize}</b>
            <button
              type="button"
              aria-label="Larger text"
              title="Larger text (Ctrl or Command and plus)"
              onClick={() => dispatch({ type: 'nudgeFontSize', direction: 1 })}
            >
              A<span aria-hidden="true">+</span>
            </button>
          </div>
          <small>Text size</small>
        </div>
      </div>
      {lock}
    </div>
  );
}
