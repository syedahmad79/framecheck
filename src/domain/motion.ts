/**
 * Small pieces of physics for programmatic viewport motion. Pure, so they can be tested
 * without a clock; the viewport store supplies the frame loop.
 */

export interface Spring1D {
  readonly value: number;
  readonly velocity: number;
}

/** Spring response in seconds: roughly how long the value takes to reach its target. */
export const SPRING_RESPONSE = 0.32;

/**
 * Advance a critically damped spring (damping ratio 1, no overshoot) by `dt` seconds.
 * The closed-form solution is exact for any `dt`, so a long frame cannot destabilise it.
 */
export function stepSpring(
  state: Spring1D,
  target: number,
  dt: number,
  response = SPRING_RESPONSE,
): Spring1D {
  const omega = (2 * Math.PI) / response;
  const offset = state.value - target;
  const decay = Math.exp(-omega * dt);
  const k = state.velocity + omega * offset;
  return {
    value: target + (offset + k * dt) * decay,
    velocity: (state.velocity - omega * k * dt) * decay,
  };
}

export function isSettled(state: Spring1D, target: number, epsilon = 0.01): boolean {
  return Math.abs(state.value - target) < epsilon && Math.abs(state.velocity) < epsilon * 10;
}

/** Per-millisecond velocity retention for inertial panning, matching a normal scroll deceleration. */
export const DECELERATION_RATE = 0.998;

/** Velocity (px/s) after `dt` seconds of exponential deceleration. */
export function decayVelocity(velocity: number, dt: number): number {
  return velocity * Math.pow(DECELERATION_RATE, dt * 1000);
}

/** Total distance a flick at `velocity` (px/s) travels before it stops. */
export function flingDistance(velocity: number): number {
  return ((velocity / 1000) * DECELERATION_RATE) / (1 - DECELERATION_RATE);
}
