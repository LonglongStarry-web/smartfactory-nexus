import type { FactoryFlow } from "./flow";
import type { ProcessMeasurement } from "./process";
export type Status = "running" | "idle" | "fault" | "maintenance";
export type Mode = "standard" | "performance" | "eco";
export type Algorithm = "FCFS" | "PRIORITY";
export interface Device {
  id: string;
  name: string;
  kind: "cnc" | "robot" | "qc" | "warehouse" | "agv";
  line: string;
  status: Status;
  temperature: number;
  vibration: number;
  load: number;
  health: number;
  runtime: number;
  available: number;
  power: number;
  energy: number;
  produced: number;
  ideal: number;
  history: { time: number; temperature: number; vibration: number }[];
  task?: string;
  position: [number, number, number];
}
export interface ProductionLine {
  id: string;
  name: string;
  deviceIds: string[];
}
export interface ProductionOrder {
  recipeId?: "flange" | "plate";
  id: string;
  product: string;
  quantity: number;
  completed: number;
  priority: number;
  created: number;
  planned: number;
  due: number;
  cancelled: boolean;
  completedAt?: number;
  completionBasis?: "good-stored" | "legacy-machined";
  legacyCompleted?: number;
}
export interface Workpiece {
  id: string;
  orderId: string;
  deviceId: string;
  time: number;
  batch: string;
  result?: "pass" | "fail";
  source?: "production" | "legacy";
  storedAt?: number;
  dispatchedAt?: number;
  scrappedAt?: number;
  cancelledAt?: number;
  bufferSlot?: number;
}
export interface QualityInspection {
  id: string;
  workpieceId: string;
  orderId: string;
  deviceId: string;
  batch: string;
  time: number;
  result: "pass" | "fail";
  defect?: string;
  x: number;
  y: number;
  source?: "production" | "sample" | "legacy" | "rework";
  inspectorId?: string;
  measurements?: ProcessMeasurement[];
}
export interface Alarm {
  id: string;
  deviceId: string;
  kind: string;
  message: string;
  time: number;
  resolved: boolean;
}
export interface MaintenanceWorkOrder {
  id: string;
  deviceId: string;
  alarmId: string;
  created: number;
  completed?: number;
  steps: boolean[];
}
export interface EnergyRecord {
  id: string;
  time: number;
  delta: number;
  total: number;
  output: number;
  good: number;
  lineA: number;
  lineB: number;
}
export interface SimulationEvent {
  id: string;
  time: number;
  type: string;
  message: string;
  deviceId?: string;
  orderId?: string;
}
export interface SimulationState {
  version: number;
  time: number;
  running: boolean;
  speed: number;
  mode: Mode;
  algorithm: Algorithm;
  seq: number;
  seed: number;
  devices: Device[];
  lines: ProductionLine[];
  orders: ProductionOrder[];
  workpieces: Workpiece[];
  inspections: QualityInspection[];
  alarms: Alarm[];
  maintenance: MaintenanceWorkOrder[];
  energy: EnergyRecord[];
  events: SimulationEvent[];
  carry: Record<string, number>;
  legacyCarry?: Record<string, number>;
  flow: FactoryFlow;
}
export interface Slot {
  orderId: string;
  deviceId: string;
  start: number;
  end: number;
  quantity: number;
  late: boolean;
}
