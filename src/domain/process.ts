export type ProcessRole = "cnc" | "robot" | "qc";
export type PartHolder =
  | "infeed"
  | "gripper"
  | "fixture"
  | "inspection"
  | "good-buffer"
  | "reject-buffer";
export type ProcessStatus =
  | "ready"
  | "running"
  | "paused"
  | "fault"
  | "awaiting-inspection"
  | "complete"
  | "cancelled";
export type ActiveProcessStatus = "running" | "awaiting-inspection";

export const processStepIds = [
  "pick",
  "open-load-door",
  "load",
  "clamp",
  "retreat",
  "close-load-door",
  "face",
  "contour",
  "drill",
  "deburr",
  "tool-clear",
  "open-unload-door",
  "grip-finished",
  "unclamp",
  "unload",
  "close-unload-door",
  "place-inspection",
  "inspect",
  "sort",
] as const;
export type ProcessStepId = (typeof processStepIds)[number];
export type ProcessAnchor =
  "raw-pick" | "fixture-load" | "robot-clear" | "qc-place" | "output-place";

export interface ProcessStep {
  id: ProcessStepId;
  label: string;
  role: ProcessRole;
  duration: number;
  anchor: ProcessAnchor;
  holderAfter: PartHolder | "quality-output";
}

export interface ProcessRecipe {
  id: string;
  revision: number;
  product: string;
  steps: ProcessStep[];
}

export interface ProcessParameters {
  spindleRpm: number;
  feedMmPerMin: number;
  fixtureOffsetXmm: number;
  contourDiameterErrorMm: number;
}

export interface ProcessMeasurement {
  featureId: string;
  label: string;
  unit: "mm";
  nominal: number;
  lower: number;
  upper: number;
  actual: number;
  sourceStepId: ProcessStepId;
}

export interface ProcessInspection {
  id: string;
  time: number;
  result: "pass" | "fail";
  measurements: ProcessMeasurement[];
}

export interface ProcessTraceEntry {
  stepId: ProcessStepId;
  deviceId: string;
  startedAt: number;
  completedAt: number;
  holderBefore: PartHolder;
  holderAfter: PartHolder;
}

/** Serializable process state; the factory adapter will supply simulated time deltas. */
export interface ProcessRun {
  version: 1;
  workpieceId: string;
  orderId: string;
  recipe: ProcessRecipe;
  parameters: ProcessParameters;
  devices: Record<ProcessRole, string>;
  status: ProcessStatus;
  resumeStatus: ActiveProcessStatus;
  fault: string | null;
  time: number;
  stepIndex: number;
  stepElapsed: number;
  stepStartedAt: number;
  inspectionWait: number;
  inspectionTimeout: number;
  holder: PartHolder;
  trace: ProcessTraceEntry[];
  inspection: ProcessInspection | null;
}
