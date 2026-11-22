/** Injectable time source (milliseconds). The core never reads real time directly. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

export interface FakeClock extends Clock {
  advance(ms: number): void;
}

export function createFakeClock(start = 0): FakeClock {
  let t = start;
  return {
    now: () => t,
    advance(ms) {
      t += ms;
    },
  };
}
