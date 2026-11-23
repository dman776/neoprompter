import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Command, CoreState } from '../core';

/** The thumb never gets smaller than this fraction of the track, so it stays easy to grab. */
const MIN_THUMB = 0.08;

/**
 * A scrollbar down the right edge of the Run mode Live view (the Operator's copy only; the Output
 * never shows it). The thumb sits at the reading position and its size is one Screen out of the
 * whole Script. Drag it, or press on the track to put the thumb there. A playing Script is held
 * still while it is dragged and carries on when the pointer is released, like dragging the text.
 */
export function ScriptScrollbar({
  state,
  dispatch,
}: {
  state: CoreState;
  dispatch: (command: Command) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    grab: number;
    wasPlaying: boolean;
    wasDirection: CoreState['direction'];
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  // The scrollable distance is the reading position's range plus the Screen the thumb stands for.
  const range = state.position + state.remainingLines + state.leadIn;
  const thumb = Math.min(
    1,
    Math.max(MIN_THUMB, state.viewportLines / (range + state.viewportLines)),
  );
  const thumbTop = state.progress * (1 - thumb);

  const goTo = (clientY: number) => {
    const box = track.current;
    const d = drag.current;
    if (!box || !d) return;
    const rect = box.getBoundingClientRect();
    const free = rect.height * (1 - thumb);
    if (free <= 0) return;
    dispatch({ type: 'setProgress', progress: (clientY - rect.top - d.grab) / free });
  };

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    // The Live view behind drags the text; the scrollbar is its own control.
    event.stopPropagation();
    if (event.button !== 0 || !track.current) return;
    const rect = track.current.getBoundingClientRect();
    const top = rect.top + thumbTop * rect.height;
    const onThumb = event.clientY >= top && event.clientY <= top + thumb * rect.height;
    drag.current = {
      // Grab the thumb where it was pressed; pressing the track puts the thumb's middle there.
      grab: onThumb ? event.clientY - top : (thumb * rect.height) / 2,
      wasPlaying: state.playing,
      wasDirection: state.direction,
    };
    if (state.playing) dispatch({ type: 'pause' });
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // No capture (a test): the drag still follows the move events it gets.
    }
    goTo(event.clientY);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    goTo(event.clientY);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    if (d.wasPlaying) dispatch({ type: 'play', direction: d.wasDirection });
  };

  return (
    <div
      className="live-scrollbar"
      data-testid="script-scrollbar"
      data-dragging={dragging ? 'true' : undefined}
      ref={track}
      role="scrollbar"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(state.progress * 100)}
      aria-label="Script position"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="live-scrollbar-thumb"
        style={{ height: `${thumb * 100}%`, top: `${thumbTop * 100}%` }}
      />
    </div>
  );
}
