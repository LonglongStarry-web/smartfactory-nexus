import type { SimulationState } from "../../domain/types";
import { cellAnchors, factoryLayout, type Vec3 } from "../../domain/layout";
import { mix, clamp01 } from "./motion";
export function transportPose(s: SimulationState) {
  if (s.flow.reroute) {
    const j = s.flow.reroute,
      c = s.flow.cells.find((c) => c.id === j.from)!,
      to = s.flow.cells.find((c) => c.id === j.to)!,
      a = cellAnchors(c.line),
      b = cellAnchors(to.line);
    const p = clamp01(j.elapsed / j.duration),
      source: Vec3 = [a.raw[0] + 0.65 * (j.inputSlot + 1), 1.16, a.raw[2]],
      target: Vec3 = [b.raw[0] + 0.65 * (to.queue.length + 1), 1.16, b.raw[2]],
      home = factoryLayout[c.agvId];
    const pick: Vec3 = [source[0], 0, source[2]],
      drop: Vec3 = [target[0], 0, target[2]];
    // Travel around the cell fronts, rather than through the arm bases.
    const lane: Vec3 = [3, 0, source[2]],
      lane2: Vec3 = [3, 0, target[2]];
    const progress = clamp01((p - 0.25) / 0.45),
      span = progress * 3,
      index = Math.min(2, Math.floor(span)),
      points = [pick, lane, lane2, drop];
    const vehicle =
      p < 0.15
        ? mix(home, pick, p / 0.15)
        : p < 0.25
          ? pick
          : p < 0.7
            ? mix(points[index], points[index + 1], span - index)
            : p < 0.82
              ? drop
              : mix(drop, home, (p - 0.82) / 0.18);
    const part =
      p < 0.25
        ? source
        : p < 0.7
          ? ([vehicle[0], 1.16, vehicle[2]] as Vec3)
          : target;
    return {
      vehicle,
      part,
      lift: p < 0.15 || p > 0.82 ? 0.15 : 0.39,
      cell: c,
      progress: p,
      loaded: p >= 0.25 && p < 0.7,
      stacker: false,
      phase:
        p < 0.15
          ? "前往待加工毛坯"
          : p < 0.25
            ? "顶升接料"
            : p < 0.7
              ? "替代路线转运"
              : p < 0.82
                ? "送达上料位"
                : "空车返回",
    };
  }
  const t = s.flow.transfer;
  if (!t) return null;
  const c = s.flow.cells.find((c) => c.id === t.cellId)!;
  const p = clamp01(t.elapsed / s.flow.transferDuration),
    a = cellAnchors(c.line),
    part = s.workpieces.find((w) => w.id === t.workpieceId)!;
  const source = a.output(t.kind, part.bufferSlot ?? 0),
    home = factoryLayout[c.agvId],
    pickup: Vec3 = [source[0], 0, source[2]],
    sign = c.line === "A" ? -1 : 1;
  const raw: Vec3 = [a.raw[0] + 0.65, 1.14, a.raw[2]],
    dock: Vec3 = t.reworkRun ? [raw[0], 0, raw[2]] : [5.1, 0, sign * 1.35];
  let vehicle: Vec3 =
    p < 0.18
      ? mix(home, pickup, p / 0.18)
      : p < 0.28
        ? pickup
        : p < 0.62
          ? mix(pickup, dock, (p - 0.28) / 0.34)
          : p < 0.82
            ? dock
            : mix(dock, home, (p - 0.82) / 0.18);
  const count = s.workpieces.filter(
      (w) => w.storedAt !== undefined && w.dispatchedAt === undefined,
    ).length,
    bin = Math.min(11, Math.floor(count / 40));
  const shelf: Vec3 = [
    factoryLayout[c.warehouseId][0] + (bin % 2 ? 0.66 : -0.66),
    0.47 + Math.floor(bin / 2) * 0.55,
    0,
  ];
  const target: Vec3 = t.reworkRun
    ? raw
    : t.kind === "reject"
      ? [5.1, 1.14, sign * 2.45]
      : shelf;
  const load: Vec3 = [vehicle[0], 1.14, vehicle[2]];
  let position = source;
  if (p >= 0.28 && p < 0.62) position = load;
  if (p >= 0.62) {
    const start: Vec3 = [dock[0], 1.14, dock[2]];
    const above: Vec3 = [target[0], Math.max(1.14, target[1] + 0.4), dock[2]];
    if (p < 0.7) position = mix(start, above, (p - 0.62) / 0.08);
    else if (p < 0.78) position = mix(above, target, (p - 0.7) / 0.08);
    else position = target;
  }
  const lift =
    p < 0.18
      ? 0.15
      : p < 0.28
        ? 0.15 + 0.22 * clamp01((p - 0.18) / 0.1)
        : p < 0.62
          ? 0.37
          : p < 0.7
            ? 0.37 - 0.22 * clamp01((p - 0.62) / 0.08)
            : 0.15;
  return {
    vehicle,
    part: position,
    lift,
    cell: c,
    progress: p,
    loaded: p >= 0.28 && p <= 0.62,
    stacker: p >= 0.62 && p < 0.78 && !t.reworkRun,
    phase:
      p < 0.18
        ? "前往取货"
        : p < 0.28
          ? "顶升接料"
          : p < 0.62
            ? "载货行驶"
            : p < 0.78
              ? t.reworkRun
                ? "回送上料"
                : t.kind === "good"
                  ? "堆垛入库"
                  : "隔离下料"
              : "空车返回",
  };
}
