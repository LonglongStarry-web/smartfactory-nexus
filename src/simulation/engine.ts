import type {
  SimulationState,
  Device,
  Mode,
  Slot,
  ProductionOrder,
  Algorithm,
} from "../domain/types";
import { event, uid } from "./journal";
import { factoryLayout } from "../domain/layout";
import {
  advanceFlow,
  assignFlow,
  createFactoryFlow,
  cncProcessSeconds,
  nextFlowBoundary,
  scheduleFlow,
} from "./flow";
export { event, uid } from "./journal";
export const BASE = Date.parse("2026-11-09T08:00:00+08:00");
export const modes: Record<
  Mode,
  { name: string; rate: number; power: number }
> = {
  standard: { name: "标准模式", rate: 1, power: 1 },
  performance: { name: "高性能模式", rate: 1.3, power: 1.55 },
  eco: { name: "节能模式", rate: 0.75, power: 0.6 },
};
export const defects = [
  "孔位超差",
  "毛刺超限",
  "表面划伤",
  "尺寸异常",
  "孔洞",
  "裂纹",
  "装配偏差",
];
export const statusText = {
  running: "运行中",
  idle: "待机",
  fault: "故障",
  maintenance: "维修中",
};
export function stamp(t: number) {
  return new Date(BASE + t * 1000).toLocaleTimeString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}
export function initialState(): SimulationState {
  const spec: [
    string,
    string,
    Device["kind"],
    string,
    [number, number, number],
    number,
  ][] = [
    ["CNC-01", "精密加工中心 01", "cnc", "A", [-4, 0, -2], 8],
    ["ARM-01", "六轴协作机械臂 01", "robot", "A", [0, 0, -2], 3],
    ["CNC-02", "精密加工中心 02", "cnc", "B", [-4, 0, 3], 8],
    ["ARM-02", "六轴协作机械臂 02", "robot", "B", [0, 0, 3], 3],
    ["QC-01", "视觉检测工作站", "qc", "A", [4, 0, -2], 2],
    ["ASRS-01", "自动化立体仓库", "warehouse", "B", [6.5, 0, 3], 4],
    ["AGV-01", "物流机器人 01", "agv", "A", [1, 0, -5], 1.2],
    ["AGV-02", "物流机器人 02", "agv", "B", [1, 0, 6], 1.2],
  ];
  const s: SimulationState = {
    version: 2,
    time: 0,
    running: false,
    speed: 5,
    mode: "standard",
    algorithm: "PRIORITY",
    seq: 0,
    seed: 42,
    devices: spec.map(([id, name, kind, line, position, power]) => ({
      id,
      name,
      kind,
      line,
      position: factoryLayout[id] ? [...factoryLayout[id]] : position,
      power,
      status: "idle",
      temperature: 36,
      vibration: 0.8,
      load: 0,
      health: 98,
      runtime: 0,
      available: 0,
      energy: 0,
      produced: 0,
      ideal: 0,
      history: [],
    })),
    lines: [
      {
        id: "A",
        name: "A 线 · 精密零件",
        deviceIds: ["CNC-01", "ARM-01", "QC-01", "AGV-01"],
      },
      {
        id: "B",
        name: "B 线 · 柔性装配",
        deviceIds: ["CNC-02", "ARM-02", "ASRS-01", "AGV-02"],
      },
    ],
    orders: [
      {
        id: "ORD-001",
        product: "精密法兰 A-320",
        quantity: 120,
        completed: 0,
        priority: 2,
        created: 0,
        planned: 0,
        due: 7200,
        cancelled: false,
      },
      {
        id: "ORD-002",
        product: "伺服壳体 S-180",
        quantity: 90,
        completed: 0,
        priority: 1,
        created: 1,
        planned: 0,
        due: 3600,
        cancelled: false,
      },
      {
        id: "ORD-003",
        product: "连接组件 C-60",
        quantity: 160,
        completed: 0,
        priority: 2,
        created: 2,
        planned: 120,
        due: 12600,
        cancelled: false,
      },
    ],
    workpieces: [],
    inspections: [],
    alarms: [],
    maintenance: [],
    energy: [],
    events: [],
    carry: {},
    flow: createFactoryFlow(),
  };
  event(s, "初始化", "演示车间已就绪 · 固定种子 42");
  return s;
}
export function schedule(
  s: SimulationState,
  algorithm: Algorithm = s.algorithm,
): Slot[] {
  return scheduleFlow(s, algorithm);
}
export function assign(s: SimulationState) {
  assignFlow(s);
}

/** A sample reuses an existing finished workpiece; it never creates production. */
export function inspect(s: SimulationState, orderId: string, deviceId: string) {
  const device = s.devices.find((d) => d.id === deviceId);
  const part = s.workpieces
    .slice()
    .reverse()
    .find(
      (w) =>
        w.orderId === orderId &&
        w.result &&
        (device?.kind === "qc" || w.deviceId === deviceId),
    );
  if (!part) return;
  const original = s.inspections.find(
    (q) => q.workpieceId === part.id && q.source !== "sample",
  );
  if (!original) return;
  const q = {
    ...structuredClone(original),
    id: uid(s, "QI"),
    time: s.time,
    source: "sample" as const,
  };
  s.inspections.unshift(q);
  event(
    s,
    "工件抽检",
    `${part.id} 复用已有工件的测量记录，不增加生产产量`,
    deviceId,
    orderId,
  );
  return q;
}

export function tick(s: SimulationState, seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("模拟时间必须是非负有限数");
  if (!s.running || seconds === 0) return;
  let left = seconds;
  while (left > 1e-8) {
    assign(s);
    const nextSample = (Math.floor((s.time + 1e-7) / 10) + 1) * 10;
    const dt = Math.min(left, nextFlowBoundary(s), nextSample - s.time);
    s.time += dt;
    left -= dt;
    for (const d of s.devices) {
      const operating = d.status === "running";
      const power =
        d.status === "fault" || d.status === "maintenance"
          ? 0
          : operating
            ? d.power * modes[s.mode].power
            : d.power * 0.12;
      d.energy += (power * dt) / 3600;
      if (d.kind === "cnc") {
        d.available +=
          d.status === "fault" || d.status === "maintenance" ? 0 : dt;
        d.ideal += operating
          ? (dt * modes[s.mode].rate) / cncProcessSeconds
          : 0;
      }
      if (operating) {
        d.runtime += dt;
        d.load = 72 + Math.sin(s.time / 15 + d.power) * 8;
        d.temperature = 43 + d.load * 0.12 + Math.sin(s.time / 30);
        d.vibration = 1.1 + Math.abs(Math.sin(s.time / 10)) * 0.5;
      } else if (d.status === "idle") {
        d.load = 0;
        d.temperature = Math.max(30, d.temperature - dt * 0.03);
      }
    }
    advanceFlow(s, dt);
    if (Math.abs(s.time - nextSample) < 1e-7) {
      s.time = nextSample;
      for (const d of s.devices) {
        d.history.push({
          time: s.time,
          temperature: d.temperature,
          vibration: d.vibration,
        });
        d.history = d.history.slice(-180);
      }
      const prev = s.energy.at(-1);
      const total = s.devices.reduce((sum, d) => sum + d.energy, 0);
      const m = metrics(s);
      s.energy.push({
        id: uid(s, "EN"),
        time: s.time,
        delta: total - (prev?.total || 0),
        total,
        output: m.output,
        good: m.good,
        lineA: s.devices
          .filter((d) => d.line === "A")
          .reduce((sum, d) => sum + d.energy, 0),
        lineB: s.devices
          .filter((d) => d.line === "B")
          .reduce((sum, d) => sum + d.energy, 0),
      });
      if (s.time % 60 === 0)
        event(s, "能耗记录", `累计耗电 ${total.toFixed(3)} kWh`);
    }
  }
  assign(s);
}
export function inject(s: SimulationState, id: string, kind: string) {
  const d = s.devices.find((d) => d.id === id);
  if (!d || d.status === "fault" || d.status === "maintenance") return;
  d.status = "fault";
  d.health = kind === "设备故障" ? 25 : 45;
  d.load = 0;
  if (kind === "温度异常") d.temperature = 92;
  if (kind === "振动异常") d.vibration = 8.4;
  const message =
    kind === "温度异常"
      ? "温度超过 80°C 演示阈值，检查冷却液及散热回路"
      : kind === "振动异常"
        ? "振动超过 5 mm/s 演示阈值，检查轴承及紧固件"
        : "设备异常停机，执行隔离与电气复位检查";
  s.alarms.unshift({
    id: uid(s, "AL"),
    deviceId: id,
    kind,
    message,
    time: s.time,
    resolved: false,
  });
  event(s, "设备报警", `${id} ${kind} · ${message}`, id);
  event(s, "设备停止", `${id} 已停止，规则调度重新计算`, id);
  s.carry[id] = 0;
  assign(s);
}
export function createMaintenance(s: SimulationState, id: string) {
  const a = s.alarms.find((a) => a.deviceId === id && !a.resolved);
  if (
    !a ||
    s.maintenance.some((w) => w.deviceId === id && w.completed === undefined)
  )
    return;
  const d = s.devices.find((d) => d.id === id)!;
  d.status = "maintenance";
  s.maintenance.unshift({
    id: uid(s, "MW"),
    deviceId: id,
    alarmId: a.id,
    created: s.time,
    steps: [false, false, false],
  });
  event(s, "设备维修", `${id} 已创建维修工单`, id);
  assign(s);
}
export function restore(s: SimulationState, id: string) {
  const d = s.devices.find((d) => d.id === id);
  if (!d) return;
  const w = s.maintenance.find(
    (w) => w.deviceId === id && w.completed === undefined,
  );
  if (w && !w.steps.every(Boolean)) throw Error("请先完成三项维修确认");
  if (w) w.completed = s.time;
  d.status = "idle";
  d.temperature = 38;
  d.vibration = 0.8;
  d.health = 98;
  s.alarms
    .filter((a) => a.deviceId === id && !a.resolved)
    .forEach((a) => (a.resolved = true));
  event(s, "设备恢复", `${id} 维修完成，报警解除并恢复生产`, id);
  assign(s);
}
export function addOrder(
  s: SimulationState,
  input: Pick<
    ProductionOrder,
    "product" | "quantity" | "priority" | "planned" | "due"
  >,
) {
  if (
    !input.product.trim() ||
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > 10000 ||
    input.due <= Math.max(input.planned, s.time) ||
    input.planned < 0
  )
    throw Error("请输入产品名称、1–10000 的整数数量，以及晚于开始时间的交期");
  const o = {
    ...input,
    id: uid(s, "ORD"),
    completed: 0,
    created: s.time,
    cancelled: false,
  };
  s.orders.push({ ...o, completionBasis: "good-stored" });
  event(
    s,
    "创建订单",
    `${o.id} ${o.product} × ${o.quantity}${o.priority === 0 ? " · 紧急插单" : ""}`,
    undefined,
    o.id,
  );
  assign(s);
  return o.id;
}
export function metrics(s: SimulationState, line = "all") {
  const ds = s.devices.filter((d) => line === "all" || d.line === line);
  const cncs = ds.filter((d) => d.kind === "cnc");
  const qs = s.inspections.filter(
    (q) =>
      q.source !== "sample" &&
      q.source !== "rework" &&
      ds.some((d) => d.id === q.deviceId),
  );
  const output = ds
    .filter((d) => d.kind === "cnc")
    .reduce((a, d) => a + d.produced, 0);
  const good = qs.filter((q) => q.result === "pass").length;
  const total = qs.length;
  const energy = ds.reduce((a, d) => a + d.energy, 0);
  const runtime = cncs.reduce((a, d) => a + d.runtime, 0);
  const availability =
    s.time && cncs.length ? runtime / (s.time * cncs.length) : 0;
  const ideal = cncs.reduce((a, d) => a + d.ideal, 0);
  const performance = ideal ? Math.min(1, output / ideal) : 0;
  const quality = total ? good / total : 0;
  return {
    output,
    stored: s.workpieces.filter(
      (w) => w.storedAt !== undefined && ds.some((d) => d.id === w.deviceId),
    ).length,
    wip: Object.values(s.flow.runs).filter(
      (r) =>
        r.status !== "complete" &&
        r.status !== "cancelled" &&
        ds.some((d) => d.id === r.devices.cnc),
    ).length,
    good,
    total,
    energy,
    availability,
    performance,
    quality,
    oee: availability * performance * quality,
    runRate: ds.filter((d) => d.status === "running").length / (ds.length || 1),
    alarms: s.alarms.filter(
      (a) => !a.resolved && ds.some((d) => d.id === a.deviceId),
    ).length,
    unit: output ? energy / output : 0,
    plan: s.orders
      .filter((o) => !o.cancelled)
      .reduce((a, o) => a + o.quantity, 0),
    completion:
      s.orders.filter((o) => !o.cancelled && o.completed >= o.quantity).length /
      Math.max(1, s.orders.filter((o) => !o.cancelled).length),
  };
}
