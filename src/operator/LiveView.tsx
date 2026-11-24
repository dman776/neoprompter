import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import {
  lineText,
  outputState,
  READING_LINE_MAX_Y,
  READING_LINE_MIN_Y,
  SPEED_NUDGE_STEP,
  type Command,
  type CoreState,
} from '../core';
import { createOutputRenderer } from '../output/renderer';
import { ScriptScrollbar } from './ScriptScrollbar';
import { STAGE_HEIGHT, STAGE_WIDTH } from '../output/stage';

interface LiveViewProps {
  state: CoreState;
  dispatch: (command: Command) => void;
  /**
   * Whether the real Output is showing. When it is, it measures the Script; when it is not,
   * the Live view measures it so time left and Screen jumps still work.
   */
  outputShowing: boolean;
  /** Show the "Output on or off" badge (the mini Live view leaves it out). Default true. */
  badge?: boolean;
  /** Show a scrollbar down the right edge, to drag through the Script (Run mode). Default false. */
  scrollbar?: boolean;
}

/**
 * Exactly what the Talent sees: the Output's own renderer, drawn at a fixed stage size and scaled
 * to fit. A badge says whether the Output is on.
 */
export function LiveView({
  state,
  dispatch,
  outputShowing,
  badge = true,
  scrollbar = false,
}: LiveViewProps) {
  const fit = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const render = useRef<((state: ReturnType<typeof outputState>) => void) | null>(null);
  const latest = useRef(state);
  latest.current = state;
  const [scale, setScale] = useState(0.3);
  const view = useRef<HTMLDivElement>(null);
  const [fixing, setFixing] = useState<{ line: number; top: number } | null>(null);
  const [fixText, setFixText] = useState('');
  const [dragging, setDragging] = useState(false);

  // Dragging the Reading line: the grab keeps its offset from the pointer, so it does not jump,
  // and the pointer's px become stage fractions through the Live view's scale.
  const drag = useRef<{ offset: number; pending: number | null; frame: number | null } | null>(
    null,
  );
  const moveLine = (readingLineY: number) =>
    dispatch({
      type: 'setAppearance',
      changes: {
        readingLineY: Math.max(READING_LINE_MIN_Y, Math.min(READING_LINE_MAX_Y, readingLineY)),
      },
    });
  const flushDrag = () => {
    const d = drag.current;
    if (!d) return;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    d.frame = null;
    if (d.pending !== null) moveLine(d.pending);
    d.pending = null;
  };
  const stageFraction = (clientY: number) => clientY / (STAGE_HEIGHT * scale);
  const startLineDrag = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // No capture (a test, an old pointer): the drag still follows the move events it gets.
    }
    drag.current = {
      offset: state.appearance.readingLineY - stageFraction(event.clientY),
      pending: null,
      frame: null,
    };
    setDragging(true);
  };
  const dragLine = (event: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.pending = stageFraction(event.clientY) + d.offset;
    // Keep up with the pointer without flooding the core: at most one change per animation frame.
    d.frame ??= requestAnimationFrame(() => {
      d.frame = null;
      flushDrag();
    });
  };
  const endLineDrag = () => {
    flushDrag();
    drag.current = null;
    setDragging(false);
  };
  const nudgeLine = (event: ReactKeyboardEvent) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const direction = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    moveLine(state.appearance.readingLineY + direction * step);
  };

  // Scrolling the Script by hand: dragging the text with the pointer, and the mouse wheel (while a Script plays in Run mode the wheel sets the speed). Screen
  // px become visual lines through the Live view's scale and the Output's line height.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const linesPerPx = () =>
    1 /
    (scaleRef.current * latest.current.appearance.fontSize * latest.current.appearance.lineSpacing);
  const handDrag = useRef<{
    startY: number;
    lastY: number;
    moved: boolean;
    wasPlaying: boolean;
    wasDirection: CoreState['direction'];
    pending: number;
    frame: number | null;
  } | null>(null);
  const [handling, setHandling] = useState(false);
  const flushHand = () => {
    const d = handDrag.current;
    if (!d) return;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    d.frame = null;
    if (d.pending !== 0) dispatch({ type: 'scrollBy', lines: d.pending });
    d.pending = 0;
  };
  const startHandDrag = (event: ReactPointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('.live-fix')) return;
    handDrag.current = {
      startY: event.clientY,
      lastY: event.clientY,
      moved: false,
      wasPlaying: false,
      wasDirection: 'forward',
      pending: 0,
      frame: null,
    };
  };
  const moveHandDrag = (event: ReactPointerEvent) => {
    const d = handDrag.current;
    if (!d) return;
    if (!d.moved) {
      // A click, or a double-click that opens a live fix, is not a drag.
      if (Math.abs(event.clientY - d.startY) < 4) return;
      d.moved = true;
      d.lastY = d.startY;
      setHandling(true);
      // Hold a playing Script still under the pointer; it carries on when the drag ends.
      d.wasPlaying = latest.current.playing;
      d.wasDirection = latest.current.direction;
      if (d.wasPlaying) dispatch({ type: 'pause' });
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // No capture (a test): the drag still follows the move events it gets.
      }
    }
    // The text follows the pointer: dragging up moves forward, dragging down moves back.
    d.pending += (d.lastY - event.clientY) * linesPerPx();
    d.lastY = event.clientY;
    d.frame ??= requestAnimationFrame(() => {
      d.frame = null;
      flushHand();
    });
  };
  const endHandDrag = (event: ReactPointerEvent) => {
    const d = handDrag.current;
    if (!d) return;
    flushHand();
    handDrag.current = null;
    setHandling(false);
    if (d.moved) {
      if (d.wasPlaying) dispatch({ type: 'play', direction: d.wasDirection });
      return;
    }
    // A plain left click in Run mode toggles stop and play. Unlocked, a double-click opens a live
    // fix instead, so a click does nothing there.
    const now = latest.current;
    if (event.type === 'pointerup' && now.mode === 'run' && !now.unlocked) {
      dispatch(now.playing ? { type: 'pause' } : { type: 'play', direction: now.direction });
    }
  };

  // The middle button (a wheel click) toggles the direction: a playing Script turns round, like
  // Shift+Space, and a stopped one is set so the next click plays that way. Run mode only. The
  // press itself is cancelled so Windows does not start its middle-click autoscroll.
  const isOwnControl = (target: EventTarget) =>
    (target as HTMLElement).closest('.live-scrollbar, .live-line, .live-fix') !== null;
  const noAutoscroll = (event: ReactMouseEvent) => {
    if (event.button === 1) event.preventDefault();
  };
  const turnRound = (event: ReactMouseEvent) => {
    const now = latest.current;
    if (event.button !== 1 || now.mode !== 'run' || isOwnControl(event.target)) return;
    event.preventDefault();
    dispatch({
      type: 'setDirection',
      direction: now.direction === 'reverse' ? 'forward' : 'reverse',
    });
  };

  useEffect(() => {
    const box = view.current;
    if (!box) return;
    const onWheel = (event: WheelEvent) => {
      // Not passive, so the page behind never scrolls with it.
      event.preventDefault();
      const px =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * box.clientHeight
            : event.deltaY;
      // Run mode: the wheel sets the speed (down is faster), one notch (100 px, or 3 lines) is one
      // nudge step, and a trackpad's small deltas add up. A paused Script (and Edit mode's mini Live view) scrolls.
      if (latest.current.mode === 'run' && latest.current.playing) {
        const notches = event.deltaMode === 1 ? event.deltaY / 3 : px / 100;
        dispatch({ type: 'adjustSpeed', levels: notches * SPEED_NUDGE_STEP });
        return;
      }
      dispatch({ type: 'scrollBy', lines: px * linesPerPx() });
    };
    box.addEventListener('wheel', onWheel, { passive: false });
    return () => box.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  // Locking again (a mode change) closes any open fix.
  useEffect(() => {
    if (!state.unlocked) setFixing(null);
  }, [state.unlocked]);

  // Unlocked live fix: double-click a paragraph to correct just that paragraph.
  const startFix = (event: ReactMouseEvent) => {
    if (!state.unlocked || !text.current || !view.current) return;
    const paragraph = (event.target as HTMLElement).closest('.live-text > div');
    if (!paragraph) return;
    const line = Array.from(text.current.children).indexOf(paragraph);
    const source = state.script.lines[line];
    if (source === undefined) return;
    const top = paragraph.getBoundingClientRect().top - view.current.getBoundingClientRect().top;
    setFixText(lineText(source));
    setFixing({ line, top: Math.max(8, Math.min(top - 8, view.current.clientHeight - 130)) });
  };
  const applyFix = () => {
    if (fixing) dispatch({ type: 'liveFix', line: fixing.line, text: fixText });
    setFixing(null);
  };

  // A new renderer (and so a fresh measurement) whenever the job of measuring changes hands.
  useLayoutEffect(() => {
    render.current = createOutputRenderer({
      surface: surface.current!,
      text: text.current!,
      readingLine: line.current!,
      progress: progress.current!,
      size: () => ({ width: STAGE_WIDTH, height: STAGE_HEIGHT }),
      // With the Output showing it measures the Script; the Live view still measures after a
      // live fix, so time left and the Progress bar follow the fix at once.
      report: outputShowing
        ? (command) => {
            if (command.type === 'setLineExtents' && latest.current.unlocked) dispatch(command);
          }
        : dispatch,
    });
    render.current(outputState(latest.current));
  }, [outputShowing, dispatch]);

  useLayoutEffect(() => {
    render.current?.(outputState(state));
  }, [state]);

  useEffect(() => {
    const box = fit.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const { clientWidth, clientHeight } = box;
      if (clientWidth > 0 && clientHeight > 0) {
        setScale(Math.min(clientWidth / STAGE_WIDTH, clientHeight / STAGE_HEIGHT));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="live-fit" ref={fit}>
      <div
        className="live-view"
        data-testid="live-view"
        data-output={state.outputOn ? 'on' : 'off'}
        data-unlocked={state.unlocked ? 'true' : undefined}
        data-handling={handling ? 'true' : undefined}
        ref={view}
        onDoubleClick={startFix}
        onMouseDown={noAutoscroll}
        onAuxClick={turnRound}
        onPointerDown={startHandDrag}
        onPointerMove={moveHandDrag}
        onPointerUp={endHandDrag}
        onPointerCancel={endHandDrag}
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
      >
        <div
          className="live-scaler"
          style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
        >
          <div className="live-surface" data-live="surface" ref={surface}>
            <div className="live-text" data-live="text" ref={text} />
            <div
              className="live-line"
              data-live="reading-line"
              data-dragging={dragging ? 'true' : undefined}
              ref={line}
              role="slider"
              tabIndex={0}
              aria-label="Reading line position"
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(state.appearance.readingLineY * 100)}
              aria-valuetext={`${Math.round(state.appearance.readingLineY * 100)}% down the Output`}
              onPointerDown={startLineDrag}
              onPointerMove={dragLine}
              onPointerUp={endLineDrag}
              onPointerCancel={endLineDrag}
              data-keeps-arrows
              onKeyDown={nudgeLine}
              onDoubleClick={(e) => e.stopPropagation()}
            />
            <div className="live-progress" data-live="progress" ref={progress} />
          </div>
        </div>
        {fixing && (
          <div className="live-fix" style={{ top: fixing.top }} data-testid="live-fix">
            <textarea
              autoFocus
              aria-label="Fix this paragraph"
              value={fixText}
              onChange={(e) => setFixText(e.target.value)}
              onBlur={() => setFixing(null)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setFixing(null);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyFix();
                }
              }}
            />
            <small>Enter updates the Output now. Esc cancels.</small>
          </div>
        )}
        {scrollbar && <ScriptScrollbar state={state} dispatch={dispatch} />}
        {badge && (
          <span className="live-badge" data-testid="live-badge">
            {state.outputOn ? 'Output on' : 'Output off'}
          </span>
        )}
      </div>
    </div>
  );
}
