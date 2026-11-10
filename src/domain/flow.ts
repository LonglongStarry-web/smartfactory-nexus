import type { ProcessParameters, ProcessRun } from "./process";

export interface Workcell {
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
  qualityHold?: boolean;
  reworkArchive?: Record<string, ProcessRun[]>;
}
