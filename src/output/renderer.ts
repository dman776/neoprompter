import {
  displayColor,
  lineHeading,
  lineRuns,
  lineText,
  READING_LINE_HEIGHT,
  READING_LINE_WIDTH,
  type Command,
  type OutputState,
} from '../core';
import { STAGE_HEIGHT } from './stage';

/** The pieces of a picture of the Output, wherever it is drawn (the Output page or the Live view). */
export interface OutputSurface {
  /** Gets the background, the text color and the mirror flip. */
  surface: HTMLElement;
  text: HTMLElement;
  readingLine: HTMLElement;
  progress: HTMLElement;
  /** The size of the picture in px; the viewport and wrapping follow from it. */
  size(): { width: number; height: number };
  /** Where measurements go (`setLineExtents`, `setViewport`); `false` keeps the picture passive. */
  report: ((command: Command) => void) | false;
}

/**
 * Draws core state as the Talent sees it. The Output page and the Operator's Live view both use
 * this, so the Operator sees exactly the Talent's picture (ADR 0002). Returns the render function.
 */
export function createOutputRenderer(target: OutputSurface): (state: OutputState) => void {
  let renderedRevision: number | null = null;
  let measuredKey = '';
  let reportedViewport = 0;
  const { surface, text: textEl, readingLine: lineEl, progress: progressEl } = target;

  return function render(state) {
    const a = state.appearance;
    const { width, height } = target.size();
    if (renderedRevision !== state.scriptRevision) {
      textEl.replaceChildren(
        ...state.script.lines.map((line) => {
          const p = document.createElement('div');
          // A heading is bold; its size stays the Preset's so line spacing and scrolling hold.
          if (lineHeading(line) !== undefined) p.style.fontWeight = 'bold';
          for (const run of lineRuns(line)) {
            const span = document.createElement('span');
            span.textContent = run.text;
            if (run.bold) span.style.fontWeight = 'bold';
            if (run.italic) span.style.fontStyle = 'italic';
            // Source color is kept on the span; the readable-color guard runs every render.
            if (run.color) span.dataset.sourceColor = run.color;
            p.append(span);
          }
          // Keep empty lines one line tall.
          if (!p.hasChildNodes() || lineText(line) === '') p.append(document.createTextNode(' '));
          return p;
        }),
      );
      renderedRevision = state.scriptRevision;
      measuredKey = '';
    }
    surface.style.background = a.backgroundColor;
    surface.style.color = a.textColor;
    for (const span of textEl.querySelectorAll<HTMLElement>('span[data-source-color]')) {
      span.style.color = displayColor(span.dataset.sourceColor, a.backgroundColor, a.textColor);
    }
    surface.style.transform = a.mirror ? 'scaleX(-1)' : '';
    textEl.style.font = `${a.fontSize}px/${a.lineSpacing} system-ui, sans-serif`;
    const side = Math.max(a.margin, (100 - a.textWidth) / 2);
    textEl.style.left = `${side}%`;
    textEl.style.right = `${side}%`;
    lineEl.style.display = a.readingLine ? 'block' : 'none';
    // Centered on its position; purely a marker, so the text does not scroll with it.
    lineEl.style.top = `${a.readingLineY * STAGE_HEIGHT - READING_LINE_HEIGHT / 2}px`;
    // The triangle is drawn with borders: its size and color are set here, once, for both pictures.
    lineEl.style.borderTop = `${READING_LINE_HEIGHT / 2}px solid transparent`;
    lineEl.style.borderBottom = `${READING_LINE_HEIGHT / 2}px solid transparent`;
    lineEl.style.borderLeft = `${READING_LINE_WIDTH}px solid ${a.readingLineColor}`;
    progressEl.style.background = a.progressColor;
    // One visual line, in px. Position, speed and the viewport are in these units; a Script line
    // (paragraph) that wraps occupies several, which the core learns from the measurement below.
    const lineHeight = a.fontSize * a.lineSpacing;
    textEl.style.transform = `translateY(${-state.position * lineHeight}px)`;
    progressEl.style.transform = `scaleX(${state.progress})`;
    if (!target.report) return;
    const key = [
      state.scriptRevision,
      a.fontSize,
      a.lineSpacing,
      a.textWidth,
      a.margin,
      width,
    ].join('|');
    if (key !== measuredKey && lineHeight > 0) {
      measuredKey = key;
      const extents = Array.from(textEl.children, (el) =>
        Math.max(1, Math.round((el as HTMLElement).offsetHeight / lineHeight)),
      );
      target.report({ type: 'setLineExtents', extents, revision: state.scriptRevision });
    }
    const lines = Math.max(1, Math.floor(height / lineHeight));
    if (lines !== reportedViewport) {
      reportedViewport = lines;
      target.report({ type: 'setViewport', lines });
    }
  };
}
