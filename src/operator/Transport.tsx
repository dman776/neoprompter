import { useEffect, type ReactNode } from 'react';
import { formatTimeLeft, type Command, type CoreState } from '../core';
import { keyToAction } from '../input';
import { isTyping } from './Speed';
import { Key } from './ui/Key';
import { BackScreenIcon, ForwardScreenIcon, PauseIcon, PlayIcon, PlayStartIcon } from './ui/icons';

/**
 * Space plays forward and Shift+Space plays back (the same key again pauses; the other turns the
 * playing round). The Left arrow and Page Up go back a Screen, the Right arrow and Page Down go
 * forward a Screen (`keyToAction` in src/input). The Up and Down arrows set the speed
 * (`useSpeedKeys`). A focused text field keeps its own keys. Space is the prompter's key whatever
 * else has the focus: a button the Operator just clicked is not pressed again by it.
 */
export function useTransportKeys(state: CoreState, dispatch: (command: Command) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      let command: Command | null = null;
      if (e.key === ' ') {
        // Space plays forward, Shift+Space plays back. The same key again pauses; the other one
        // turns the playing round.
        const reverse = e.shiftKey;
        const playingThisWay = state.playing && (state.direction === 'reverse') === reverse;
        command = playingThisWay
          ? { type: 'pause' }
          : { type: 'play', direction: reverse ? 'reverse' : 'forward' };
      } else {
        const action = keyToAction(e.key);
        command =
          action === 'jumpBack'
            ? { type: 'jumpBack' }
            : action === 'jumpForward'
              ? { type: 'jumpForward' }
              : null;
      }
      if (!command) return;
      e.preventDefault();
      dispatch(command);
    };
    // A button is pressed by Space when the key goes up, so that is stopped as well.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
      }
    };
    // In the capture phase, so a focused control never sees the key first.
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [state.playing, state.direction, dispatch]);
}

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
 * The transport, one short row: the direction, Play and Pause with Play start and the two Screen
 * jumps, time left and position, and the text size.
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
