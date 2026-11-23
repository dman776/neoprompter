import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { lineText, outputState, type Command, type CoreState } from '../core';
import { createOutputRenderer } from '../output/renderer';

/** The size the Live view draws the Output at before scaling it down to fit. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

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
}

/**
 * Exactly what the Talent sees: the Output's own renderer, drawn at a fixed stage size and scaled
 * to fit. A badge says whether the Output is on.
 */
export function LiveView({ state, dispatch, outputShowing, badge = true }: LiveViewProps) {
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
        ref={view}
        onDoubleClick={startFix}
        style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
      >
        <div
          className="live-scaler"
          style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
        >
          <div className="live-surface" data-live="surface" ref={surface}>
            <div className="live-text" data-live="text" ref={text} />
            <div className="live-line" data-live="reading-line" ref={line} />
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
        {badge && (
          <span className="live-badge" data-testid="live-badge">
            {state.outputOn ? 'Output on' : 'Output off'}
          </span>
        )}
      </div>
    </div>
  );
}
