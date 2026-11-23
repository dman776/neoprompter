import { describe, expect, it } from 'vitest';
import { fitStage, STAGE_HEIGHT, STAGE_WIDTH } from './stage';

describe('fitStage', () => {
  it('is 1:1 at 1920x1080', () => {
    expect(fitStage({ width: 1920, height: 1080 })).toEqual({ scale: 1, left: 0, top: 0 });
  });

  it('scales a 16:9 window down to fit', () => {
    expect(fitStage({ width: 1280, height: 720 })).toEqual({ scale: 2 / 3, left: 0, top: 0 });
  });

  it('letterboxes a taller window: width limits, centered vertically', () => {
    const fit = fitStage({ width: 960, height: 900 });
    expect(fit.scale).toBe(0.5);
    expect(fit.left).toBe(0);
    expect(fit.top).toBe((900 - STAGE_HEIGHT * 0.5) / 2);
  });

  it('pillarboxes a wider window: height limits, centered horizontally', () => {
    const fit = fitStage({ width: 2560, height: 1080 });
    expect(fit.scale).toBe(1);
    expect(fit.left).toBe((2560 - STAGE_WIDTH) / 2);
    expect(fit.top).toBe(0);
  });

  it('scales up on a bigger display', () => {
    expect(fitStage({ width: 3840, height: 2160 }).scale).toBe(2);
  });

  it('never goes negative for an empty window', () => {
    expect(fitStage({ width: 0, height: 0 }).scale).toBe(0);
  });
});
