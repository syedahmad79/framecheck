import { describe, expect, it } from 'vitest';
import { decayVelocity, flingDistance, isSettled, stepSpring } from './motion';

describe('stepSpring', () => {
  it('converges to the target without overshooting', () => {
    let state = { value: 0, velocity: 0 };
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      state = stepSpring(state, 100, 1 / 60);
      peak = Math.max(peak, state.value);
    }
    expect(peak).toBeLessThanOrEqual(100.0001);
    expect(isSettled(state, 100)).toBe(true);
  });

  it('is exact regardless of step size', () => {
    const fine = Array.from({ length: 60 }).reduce<{ value: number; velocity: number }>(
      (s) => stepSpring(s, 50, 1 / 120),
      { value: 0, velocity: 0 },
    );
    const coarse = stepSpring({ value: 0, velocity: 0 }, 50, 0.5);
    expect(fine.value).toBeCloseTo(coarse.value, 6);
  });

  it('carries the starting velocity so a retarget does not stop dead', () => {
    const moving = stepSpring({ value: 0, velocity: 500 }, 0, 1 / 60);
    expect(moving.value).toBeGreaterThan(0);
    expect(moving.velocity).toBeGreaterThan(0);
  });
});

describe('deceleration', () => {
  it('decays velocity exponentially and matches the closed-form travel distance', () => {
    const v0 = 1000;
    let v = v0;
    let travelled = 0;
    const dt = 1 / 1000;
    for (let i = 0; i < 20000; i++) {
      travelled += v * dt;
      v = decayVelocity(v, dt);
    }
    expect(Math.abs(v)).toBeLessThan(1e-3);
    // The loop sums from t=0 and the closed form from t=1ms, so they differ by about v0/2000.
    expect(Math.abs(travelled - flingDistance(v0))).toBeLessThan(1.5);
  });
});
