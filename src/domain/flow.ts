import type { ProcessParameters, ProcessRun } from "./process";

export interface Workcell {
  capabilities?: ("flange" | "plate")[];
  currentFamily?: "flange" | "plate";
  setup?: { family: "flange" | "plate"; remaining: number } | null;
  id: string;
  line: string;
  cncId: string;
  robotId: string;
  qcId: string;
  agvId: string;
  warehouseId: string;
  queue: string[];
  activeId: string | null;
  good: string[];
  reject: string[];
  waitingReason: string;
}

export interface FactoryFlow {
  schema: 1;
  cells: Workcell[];
  runs: Record<string, ProcessRun>;
  occupancy: Record<string, string>;
  inputCapacity: number;
  outputCapacity: number;
  warehouseCapacity?: number;
  transferDuration: number;
  transfer: {
    workpieceId: string;
    cellId: string;
    kind: "good" | "reject";
    elapsed: number;
    reworkRun?: ProcessRun;
  } | null;
  parameters: ProcessParameters;
  demoVariations: boolean;
  reroute?: {
    workpieceId: string;
    from: string;
    to: string;
    elapsed: number;
    duration: number;
    startedAt: number;
    inputSlot: number;
  } | null;
  qualityHold?: boolean;
  reworkArchive?: Record<string, ProcessRun[]>;
}
