import type { ProcessRun, ProcessStepId } from "../../domain/process";
import { armLengths, cellAnchors, type Vec3 } from "../../domain/layout";

export const clamp01 = (p: number) => Math.max(0, Math.min(1, p));
const smooth = (p: number) => {
  p = clamp01(p);
  return p * p * (3 - 2 * p);
};
export function mix(a: Vec3, b: Vec3, p: number): Vec3 {
  p = smooth(p);
  return a.map((v, i) => v + (b[i] - v) * p) as Vec3;
}
function path(points: Vec3[], p: number): Vec3 {
  const span = clamp01(p) * (points.length - 1),
    i = Math.min(points.length - 2, Math.floor(span));
  return mix(points[i], points[i + 1], span - i);
}
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

export interface MotionPose {
  tcp: Vec3;
  part: Vec3;
  tool: Vec3;
  door: number;
  clamp: number;
  grip: number;
  radius: number;
  height: number;
  holes: number;
  deburred: boolean;
  spindle: boolean;
  stage: ProcessStepId;
  progress: number;
}

export function solveArm(base: Vec3, tcp: Vec3) {
  const shoulder = add(base, [0, armLengths.shoulderHeight, 0]);
  const wrist = add(tcp, [0, armLengths.wristOffset, 0]);
  const dx = wrist[0] - shoulder[0],
    dz = wrist[2] - shoulder[2],
    dy = wrist[1] - shoulder[1];
  const r = Math.hypot(dx, dz),
    distance = Math.hypot(r, dy);
  const { upper, lower } = armLengths;
  const reachable =
    distance < upper + lower - 0.005 &&
    distance > Math.abs(upper - lower) + 0.005;
  const d = Math.max(0.01, Math.min(upper + lower - 0.001, distance));
  const angle =
    Math.atan2(dy, r) +
    Math.acos(
      Math.max(
        -1,
        Math.min(1, (upper * upper + d * d - lower * lower) / (2 * upper * d)),
      ),
    );
  const unitX = r ? dx / r : 1,
    unitZ = r ? dz / r : 0;
  const elbow: Vec3 = [
    shoulder[0] + unitX * upper * Math.cos(angle),
    shoulder[1] + upper * Math.sin(angle),
    shoulder[2] + unitZ * upper * Math.cos(angle),
  ];
  return { shoulder, elbow, wrist, reachable, yaw: Math.atan2(dx, dz) };
}

export function motionPose(
  run: ProcessRun | undefined,
  line: string,
  progress?: number,
  outputSlot = 0,
): MotionPose {
  const a = cellAnchors(line);
  if (run?.attempt) {
    a.raw[1] = 1.14;
    a.fixture[1] = 1.13;
    a.rawAbove[1] = 1.85;
  }

  const index = run?.stepIndex ?? 0;
  const step = run?.recipe.steps[Math.min(index, run.recipe.steps.length - 1)];
  const stage = step?.id ?? "pick";
  const p = clamp01(
    progress ?? (step ? (run?.stepElapsed ?? 0) / step.duration : 0),
  );
  const at = (id: ProcessStepId) =>
    run?.recipe.steps.findIndex((s) => s.id === id) ?? 0;
  const face = index > at("face") ? 1 : stage === "face" ? p : 0;
  const contour = index > at("contour") ? 1 : stage === "contour" ? p : 0;
  const radius = run?.attempt ? 0.24 : 0.26 - 0.02 * contour;
  const height = run?.attempt ? 0.12 : 0.18 - 0.06 * face;
  const fixture: Vec3 = [
    a.fixture[0],
    a.fixtureFloor + height / 2,
    a.fixture[2],
  ];
  const finished: Vec3 = [a.fixture[0], a.fixtureFloor + 0.06, a.fixture[2]];
  const toolHome: Vec3 = [a.fixture[0], 1.8, a.fixture[2]];
  let tcp = a.clear,
    part = a.raw,
    door = 0,
    clamp = 0,
    grip = 0.4,
    tool = toolHome;
  const closed = radius + 0.035;
  if (!run || run.status === "ready" || run.status === "cancelled")
    return {
      tcp,
      part,
      tool,
      door,
      clamp,
      grip,
      radius,
      height,
      holes: run?.attempt ? 5 : 0,
      deburred: false,
      spindle: false,
      stage,
      progress: p,
    };
  if (stage === "pick") {
    tcp = path([a.clear, a.rawAbove, a.raw], Math.min(1, p / 0.8));
    part = mix(add(a.raw, [0.65, 0, 0]), a.raw, clamp01(p / 0.25));
    grip = 0.4 + (closed - 0.4) * smooth((p - 0.8) / 0.2);
  }
  if (stage === "open-load-door") {
    tcp = path([a.raw, a.rawAbove, a.clear], p);
    grip = closed;
    door = p;
    part = tcp;
  }
  if (stage === "load") {
    tcp = path([a.clear, a.approach, a.fixture], p);
    part = tcp;
    door = 1;
    grip = closed;
  }
  if (stage === "clamp") {
    tcp = a.fixture;
    part = a.fixture;
    door = 1;
    grip = closed;
    clamp = p;
  }
  if (stage === "retreat") {
    tcp = path([a.fixture, a.approach, a.clear], clamp01((p - 0.2) / 0.8));
    part = a.fixture;
    door = 1;
    clamp = 1;
    grip = closed + (0.4 - closed) * smooth(p / 0.2);
  }
  if (stage === "close-load-door") {
    part = fixture;
    door = 1 - p;
    clamp = 1;
  }
  const cutting = ["face", "contour", "drill", "deburr"];
  if (cutting.includes(stage)) {
    part = fixture;
    clamp = 1;
  }
  if (
    cutting.includes(stage) &&
    !(run.attempt && stage !== "deburr") &&
    !(stage === "deburr" && run.parameters.skipDeburr)
  ) {
    part = fixture;
    clamp = 1;
    if (stage === "face") {
      const x = Math.sin(p * Math.PI * 6) * 0.17,
        z = -0.16 + 0.32 * p;
      tool = [fixture[0] + x, fixture[1] + height / 2 + 0.015, fixture[2] + z];
    } else if (stage === "drill") {
      const n = Math.min(4, Math.floor(p * 5)),
        local = p * 5 - n;
      const angle = ((n - 1) * Math.PI) / 2;
      tool = [
        fixture[0] + (n ? Math.cos(angle) * 0.16 : 0),
        fixture[1] + height / 2 + 0.15 * (1 - Math.sin(Math.PI * local)),
        fixture[2] + (n ? Math.sin(angle) * 0.16 : 0),
      ];
    } else {
      tool = [
        fixture[0] + Math.cos(p * Math.PI * 2) * (radius + 0.025),
        fixture[1] + height / 2,
        fixture[2] + Math.sin(p * Math.PI * 2) * (radius + 0.025),
      ];
    }
  }
  if (
    cutting.includes(stage) &&
    !(run.attempt && stage !== "deburr") &&
    !(stage === "deburr" && run.parameters.skipDeburr)
  ) {
    const cutPoint = tool;
    if (p < 0.12) tool = mix(toolHome, cutPoint, p / 0.12);
    if (p > 0.88) tool = mix(cutPoint, toolHome, (p - 0.88) / 0.12);
  }
  if (stage === "tool-clear") {
    part = finished;
    clamp = 1;
    tool = toolHome;
  }
  if (stage === "open-unload-door") {
    part = finished;
    clamp = 1;
    door = p;
  }
  if (stage === "grip-finished") {
    tcp = path([a.clear, a.approach, finished], Math.min(1, p / 0.8));
    part = finished;
    door = 1;
    clamp = 1;
    grip = 0.4 + (closed - 0.4) * smooth((p - 0.8) / 0.2);
  }
  if (stage === "unclamp") {
    tcp = finished;
    part = finished;
    door = 1;
    clamp = 1 - p;
    grip = closed;
  }
  if (stage === "unload") {
    tcp = path([finished, a.approach, a.clear], p);
    part = tcp;
    door = 1;
    grip = closed;
  }
  if (stage === "close-unload-door") {
    tcp = a.clear;
    part = tcp;
    door = 1 - p;
    grip = closed;
  }
  if (stage === "place-inspection") {
    tcp = path([a.clear, [1.1, 1.65, a.base[2] * 0.5], a.qc], p);
    part = tcp;
    grip = closed;
  }
  if (stage === "inspect") {
    tcp = path(
      [a.qc, [1.1, 1.65, a.base[2] * 0.5], a.clear],
      clamp01((p - 0.1) / 0.35),
    );
    grip = closed + (0.4 - closed) * smooth(p / 0.1);
    part = a.qc;
  }
  if (stage === "sort") {
    const dest = a.output(
      run.inspection?.result === "fail" ? "reject" : "good",
      outputSlot,
    );
    part = path([a.qc, [dest[0], a.qc[1], 0], dest], p);
  }
  if (run.status === "complete") {
    part = a.output(
      run.inspection?.result === "fail" ? "reject" : "good",
      outputSlot,
    );
  }
  const holes = run.attempt
    ? 5
    : index > at("drill")
      ? 5
      : stage === "drill"
        ? Math.min(5, Math.floor(p * 5 + 0.5))
        : 0;
  return {
    tcp,
    part,
    tool,
    door: clamp01(door),
    clamp: clamp01(clamp),
    grip,
    radius,
    height,
    holes,
    deburred:
      !run.parameters.skipDeburr &&
      (index > at("deburr") || (stage === "deburr" && p > 0.9)),
    spindle:
      cutting.includes(stage) &&
      !(run.attempt && stage !== "deburr") &&
      !(stage === "deburr" && run.parameters.skipDeburr),
    stage,
    progress: p,
  };
}

/** Historical playback reads recorded completion intervals and never advances the factory. */
export function replayAt(
  run: ProcessRun,
  time: number,
): { stepIndex: number; progress: number } {
  const trace = run.trace;
  if (!trace.length) return { stepIndex: run.stepIndex, progress: 0 };
  const t = Math.max(
    trace[0].startedAt,
    Math.min(time, trace[trace.length - 1].completedAt),
  );
  const i = trace.findIndex((entry) => entry.completedAt > t);
  const index = i === -1 ? trace.length - 1 : i;
  const entry = trace[index];
  return {
    stepIndex: run.recipe.steps.findIndex((step) => step.id === entry.stepId),
    progress: clamp01(
      (t - entry.startedAt) /
        Math.max(0.001, entry.completedAt - entry.startedAt),
    ),
  };
}
