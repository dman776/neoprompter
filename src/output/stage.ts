/**
 * The Output is always laid out as a 1920x1080 stage, whatever size the window or monitor is, and
 * scaled to fit. The Operator's Live view draws the same stage. Wrapping, the number of visible
 * lines, line spacing and the reading position are therefore identical in both: the top line the
 * Talent sees is the top line the Operator sees.
 */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

export interface StageFit {
  /** Multiplier from stage px to window px. */
  scale: number;
  /** Where the scaled stage's top-left corner sits in the window, in window px. */
  left: number;
  top: number;
}

/** Fits the stage inside an available area, keeping its aspect ratio and centering it. */
export function fitStage(available: { width: number; height: number }): StageFit {
  const scale = Math.max(
    0,
    Math.min(available.width / STAGE_WIDTH, available.height / STAGE_HEIGHT),
  );
  return {
    scale,
    left: (available.width - STAGE_WIDTH * scale) / 2,
    top: (available.height - STAGE_HEIGHT * scale) / 2,
  };
}
