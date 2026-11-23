import type { ReactNode } from 'react';
import { formatTimeLeft, type Command, type CoreState } from '../core';
import { Key } from './ui/Key';
import {
  BackScreenIcon,
  EndIcon,
  ForwardScreenIcon,
  PauseIcon,
  PlayIcon,
  PlayStartIcon,
  TopIcon,
} from './ui/icons';

/** BACK and FWD: which way the Script is playing; FWD is lit (dimly) while it is paused. */
export function DirectionIndicator({ state }: { state: CoreState }) {
  const reverse = state.direction === 'reverse';
  return (
    <div
      className="run-direction"
      data-testid="direction"
      data-direction={state.direction}
      data-playing={state.playing ? 'true' : undefined}
      role="status"
      aria-label={`Direction: ${reverse ? 'back' : 'forward'}`}
      title="Space plays forward. Shift and Space plays back."
    >
      <div className="run-direction-lamps">
        <span data-active={reverse ? 'true' : undefined}>BACK</span>
        <span data-active={reverse ? undefined : 'true'}>FWD</span>
      </div>
      <small>Direction</small>
    </div>
  );
}

/**
 * The transport, one short row: the direction, Play and Pause with Top, Play start, the two Screen
 * jumps and End, time left and position, and the text size.
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
      <DirectionIndicator state={state} />
      <div className="run-keys">
        <Key
          icon={<TopIcon />}
          caption="Top"
          title="Jump to the top of the Script"
          onClick={() => dispatch({ type: 'setProgress', progress: 0 })}
        />
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
        <Key
          icon={<EndIcon />}
          caption="End"
          title="Jump to the end of the Script"
          onClick={() => dispatch({ type: 'setProgress', progress: 1 })}
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
      {lock}
    </div>
  );
}
