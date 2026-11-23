import type { Command, CoreState } from '../core';
import { SpeedDial } from './Speed';
import { Key } from './ui/Key';
import { BackScreenIcon, ForwardScreenIcon, PauseIcon, PlayIcon, PlayStartIcon } from './ui/icons';

/** Time left at the current speed as m:ss, or `--:--` when the speed is zero. */
export function formatTimeLeft(remainingLines: number, linesPerSecond: number): string {
  if (linesPerSecond <= 0) return '--:--';
  const seconds = Math.round(remainingLines / linesPerSecond);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The transport: Play and Pause, Back a Screen, Forward a Screen and Play start, with time left
 * and position beside them, and the speed dial in the `speed-dial` slot.
 */
export function Transport({
  state,
  dispatch,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
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
      </div>
    </div>
  );
}
