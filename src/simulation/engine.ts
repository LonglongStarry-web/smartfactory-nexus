import type {
  SimulationState,
  Device,
  Mode,
  Slot,
  ProductionOrder,
  Algorithm,
} from "../domain/types";
export const BASE = Date.parse("2026-11-09T08:00:00+08:00");
export const modes: Record<
  Mode,
  { name: string; rate: number; power: number }
> = {
  standard: { name: "标准模式", rate: 1, power: 1 },
  performance: { name: "高性能模式", rate: 1.3, power: 1.55 },
  eco: { name: "节能模式", rate: 0.75, power: 0.6 },
};
export const defects = ["表面划伤", "尺寸异常", "孔洞", "裂纹", "装配偏差"];
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
function rng(s: SimulationState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
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
    version: 1,
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
      position,
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
        due: 2400,
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
        due: 1800,
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
        due: 4200,
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
  };
  event(s, "初始化", "演示车间已就绪 · 固定种子 42");
  return s;
}
export function schedule(
  s: SimulationState,
  algorithm: Algorithm = s.algorithm,
): Slot[] {
  const devices = s.devices.filter(
    (d) =>
      d.kind === "cnc" &&
      d.status !== "fault" &&
      d.status !== "maintenance" &&
      !s.devices.some(
        (x) =>
          x.line === d.line &&
          (x.status === "fault" || x.status === "maintenance"),
      ),
  );
  if (!devices.length) return [];
  const free = Object.fromEntries(devices.map((d) => [d.id, s.time]));
  const slots: Slot[] = [];
  const orders = s.orders
    .filter((o) => !o.cancelled && o.completed < o.quantity)
    .sort(
      (a, b) =>
        (algorithm === "PRIORITY" ? a.priority - b.priority : 0) ||
        a.created - b.created,
    );
  for (const o of orders) {
    // Preserve an in-progress assignment when the resource is equally available.
    const earliest = Math.min(...devices.map((d) => free[d.id]));
    const d =
      devices.find(
        (d) => d.task === o.id && Math.abs(free[d.id] - earliest) < 1e-6,
      ) ?? devices.reduce((a, b) => (free[a.id] <= free[b.id] ? a : b));
    const start = Math.max(free[d.id], o.planned);
    const qty = o.quantity - o.completed;
    const inProgress =
      d.task === o.id && start <= s.time + 1e-6
        ? Math.min(1, Math.max(0, s.carry[d.id] || 0))
        : 0;
    const end =
      Math.round(
        (start + ((qty - inProgress) * 10) / modes[s.mode].rate) * 1e6,
      ) / 1e6;
    slots.push({
      orderId: o.id,
      deviceId: d.id,
      start,
      end,
      quantity: qty,
      late: end > o.due,
    });
    free[d.id] = end;
  }
  return slots;
}
export function assign(s: SimulationState) {
  const slots = schedule(s);
  for (const d of s.devices) {
    const slot = slots.find(
      (x) => x.deviceId === d.id && x.start <= s.time + 0.001,
    );
    const task =
      d.kind === "cnc"
        ? slot?.orderId
        : slots.find(
            (x) =>
              s.devices.find((y) => y.id === x.deviceId)?.line === d.line &&
              x.start <= s.time + 0.001,
          )?.orderId;
    if (d.task !== task && task)
      event(s, "分配任务", `${d.id} 分配至 ${task}`, d.id, task);
    // Partial work belongs to the old order; it cannot finish a newly assigned one.
    if (d.kind === "cnc" && d.task !== task) s.carry[d.id] = 0;
    d.task = task;
    if (d.status !== "fault" && d.status !== "maintenance")
      d.status = s.running && task ? "running" : "idle";
  }
}
export function inspect(s: SimulationState, orderId: string, deviceId: string) {
  const wp = uid(s, "WP");
  const fail = rng(s) < 0.06;
  const defect = fail
    ? defects[Math.floor(rng(s) * defects.length)]
    : undefined;
  const batch = `B-${orderId}`;
  s.workpieces.push({
    id: wp,
    orderId,
    deviceId,
    time: s.time,
    batch,
    result: fail ? "fail" : "pass",
  });
  const q = {
    id: uid(s, "QI"),
    workpieceId: wp,
    orderId,
    deviceId,
    batch,
    time: s.time,
    result: fail ? ("fail" as const) : ("pass" as const),
    defect,
    x: 25 + rng(s) * 50,
    y: 25 + rng(s) * 50,
  };
  s.inspections.unshift(q);
  event(
    s,
    "质检完成",
    `${wp} ${fail ? defect : "检测合格"}（模拟视觉检测）`,
    deviceId,
    orderId,
  );
}
export function tick(s: SimulationState, seconds: number) {
  if (!s.running) return;
  let left = seconds;
  while (left > 0) {
    const dt = Math.min(1, left);
    left -= dt;
    assign(s);
    s.time += dt;
    let delta = 0;
    for (const d of s.devices) {
      const operating = d.status === "running";
      const power =
        d.status === "fault" || d.status === "maintenance"
          ? 0
          : operating
            ? d.power * modes[s.mode].power
            : d.power * 0.12;
      const kwh = (power * dt) / 3600;
      d.energy += kwh;
      delta += kwh;
      if (d.kind === "cnc") {
        d.available +=
          d.status === "fault" || d.status === "maintenance" ? 0 : dt;
        d.ideal += operating ? (dt * modes[s.mode].rate) / 10 : 0;
      }
      if (operating) {
        d.runtime += dt;
        d.load = 72 + Math.sin(s.time / 15 + d.power) * 8;
        d.temperature = 43 + d.load * 0.12 + Math.sin(s.time / 30);
        d.vibration = 1.1 + Math.abs(Math.sin(s.time / 10)) * 0.5;
        if (d.kind === "cnc" && d.task) {
          s.carry[d.id] = (s.carry[d.id] || 0) + (dt * modes[s.mode].rate) / 10;
          if (s.carry[d.id] >= 1 - 1e-9) {
            s.carry[d.id] = Math.max(0, s.carry[d.id] - 1);
            const order = s.orders.find((o) => o.id === d.task)!;
            if (order.completed < order.quantity) {
              order.completed++;
              d.produced++;
              event(
                s,
                "完成工序",
                `${d.id} 完成 1 件 ${order.product}`,
                d.id,
                order.id,
              );
              inspect(s, order.id, d.id);
              if (order.completed === order.quantity) {
                order.completedAt = s.time;
                event(
                  s,
                  "完成订单",
                  `${order.id} 已完成 ${order.quantity} 件`,
                  undefined,
                  order.id,
                );
              }
            }
          }
        }
      } else if (d.status === "idle") {
        d.load = 0;
        d.temperature = Math.max(30, d.temperature - dt * 0.03);
      }
    }
    const prev = s.energy.at(-1);
    if (Math.floor(s.time) % 10 === 0) {
      for (const d of s.devices) {
        d.history ??= [];
        d.history.push({
          time: s.time,
          temperature: d.temperature,
          vibration: d.vibration,
        });
        d.history = d.history.slice(-180);
      }
      s.energy.push({
        id: uid(s, "EN"),
        time: s.time,
        delta: s.devices.reduce((a, d) => a + d.energy, 0) - (prev?.total || 0),
        total: s.devices.reduce((a, d) => a + d.energy, 0),
        output: s.orders.reduce((a, o) => a + o.completed, 0),
        good: s.inspections.filter((q) => q.result === "pass").length,
        lineA: s.devices
          .filter((d) => d.line === "A")
          .reduce((a, d) => a + d.energy, 0),
        lineB: s.devices
          .filter((d) => d.line === "B")
          .reduce((a, d) => a + d.energy, 0),
      });
      if (s.time % 60 === 0)
        event(
          s,
          "能耗记录",
          `累计耗电 ${s.devices.reduce((a, d) => a + d.energy, 0).toFixed(3)} kWh`,
        );
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
  s.orders.push(o);
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
  const qs = s.inspections.filter((q) => ds.some((d) => d.id === q.deviceId));
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
