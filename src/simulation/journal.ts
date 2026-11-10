import type { SimulationState } from "../domain/types";

export function uid(s: SimulationState, prefix: string) {
  return `${prefix}-${String(++s.seq).padStart(6, "0")}`;
}

export function event(
  s: SimulationState,
  type: string,
  message: string,
  deviceId?: string,
  orderId?: string,
) {
  s.events.unshift({
    id: uid(s, "EV"),
    time: s.time,
    type,
    message,
    deviceId,
    orderId,
  });
  s.events = s.events.slice(0, 2000);
}

export function rng(s: SimulationState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
