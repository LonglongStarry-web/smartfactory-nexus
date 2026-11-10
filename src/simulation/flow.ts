import type { FactoryFlow, Workcell } from "../domain/flow";
import type { ProcessRun, ProcessMeasurement } from "../domain/process";
import type { Algorithm, SimulationState, Slot } from "../domain/types";
import {
  advanceProcess,
  commandProcess,
  createProcessRun,
  defaultProcessParameters,
  flangeRecipe,
  recordProcessInspection,
} from "./process";
import { event, rng, uid } from "./journal";

export const cycleSeconds = flangeRecipe.steps.reduce(
  (sum, step) => sum + step.duration,
  0,
);
export const cncProcessSeconds = flangeRecipe.steps
  .filter((step) => step.role === "cnc")
  .reduce((sum, step) => sum + step.duration, 0);
export const modeRate = { standard: 1, performance: 1.3, eco: 0.75 };
const epsilon = 1e-7;

export function createFactoryFlow(): FactoryFlow {
  return {
    schema: 1,
    cells: [1, 2].map((n) => ({
      id: `CELL-0${n}`,
      line: n === 1 ? "A" : "B",
      cncId: `CNC-0${n}`,
      robotId: `ARM-0${n}`,
      qcId: "QC-01",
      agvId: `AGV-0${n}`,
      warehouseId: "ASRS-01",
      queue: [],
      activeId: null,
      good: [],
      reject: [],
      waitingReason: "",
    })),
    runs: {},
    occupancy: {},
    inputCapacity: 2,
    outputCapacity: 2,
    transferDuration: 3,
    transfer: null,
    parameters: { ...defaultProcessParameters },
    demoVariations: true,
  };
}

function offline(s: SimulationState, id: string) {
  const d = s.devices.find((d) => d.id === id);
  return !d || d.status === "fault" || d.status === "maintenance";
}

function rankedOrders(s: SimulationState, algorithm = s.algorithm) {
  return s.orders
    .filter((o) => !o.cancelled && o.completed < o.quantity)
    .slice()
    .sort(
      (a, b) =>
        (algorithm === "PRIORITY" ? a.priority - b.priority : 0) ||
        a.created - b.created,
    );
}

export function reservedForOrder(s: SimulationState, orderId: string) {
  return s.workpieces.filter(
    (w) =>
      w.orderId === orderId &&
      w.source === "production" &&
      w.storedAt === undefined &&
      w.scrappedAt === undefined &&
      w.cancelledAt === undefined &&
      w.result !== "fail",
  ).length;
}

function release(s: SimulationState, cell: Workcell): string | undefined {
  const order = rankedOrders(s).find(
    (o) =>
      o.planned <= s.time + epsilon &&
      o.completed + reservedForOrder(s, o.id) < o.quantity,
  );
  if (!order) return;
  const id = uid(s, "WP");
  const parameters = { ...s.flow.parameters };
  if (s.flow.demoVariations && rng(s) < 0.06)
    parameters.fixtureOffsetXmm += 0.08;
  const recipe = structuredClone(flangeRecipe);
  recipe.product = order.product;
  s.flow.runs[id] = createProcessRun({
    workpieceId: id,
    orderId: order.id,
    recipe,
    parameters,
    time: s.time,
    devices: { cnc: cell.cncId, robot: cell.robotId, qc: cell.qcId },
  });
  s.workpieces.push({
    id,
    orderId: order.id,
    deviceId: cell.cncId,
    time: s.time,
    batch: `B-${order.id}`,
    source: "production",
  });
  event(
    s,
    "工件投料",
    `${id} · ${order.product} · ${cell.id}`,
    cell.cncId,
    order.id,
  );
  return id;
}

function holds(run: ProcessRun) {
  return run.holder === "fixture"
    ? [run.devices.cnc]
    : run.holder === "gripper"
      ? [run.devices.robot]
      : run.holder === "inspection"
        ? [run.devices.qc]
        : [];
}

function requires(run: ProcessRun) {
  const step = run.recipe.steps[run.stepIndex];
  if (!step) return [];
  return [
    ...new Set([
      ...holds(run),
      run.devices[step.role],
      ...(step.id === "place-inspection" ? [run.devices.qc] : []),
    ]),
  ];
}

function transferResources(cell: Workcell) {
  return [cell.agvId, cell.warehouseId];
}

/** Establish allocations before a time slice. Busy parts retain ownership on faults. */
export function assignFlow(s: SimulationState) {
  const flow = s.flow;
  for (const cell of flow.cells) {
    cell.queue = cell.queue.filter((id) => {
      const run = flow.runs[id];
      if (!s.orders.find((o) => o.id === run.orderId)?.cancelled) return true;
      commandProcess(run, { type: "CANCEL" });
      s.workpieces.find((w) => w.id === id)!.cancelledAt = s.time;
      event(
        s,
        "撤销待加工工件",
        `${id} 对应订单已取消`,
        cell.cncId,
        run.orderId,
      );
      return false;
    });
  }
  if (s.running) {
    const available = flow.cells.filter(
      (cell) => !offline(s, cell.cncId) && !offline(s, cell.robotId),
    );
    for (const cell of available) {
      if (!cell.activeId)
        cell.activeId = cell.queue.shift() ?? release(s, cell) ?? null;
    }
    // Fill one place per cell in each pass so the first cell cannot reserve all small orders.
    for (let slot = 0; slot < flow.inputCapacity; slot++) {
      for (const cell of available) {
        if (cell.queue.length >= flow.inputCapacity) continue;
        const id = release(s, cell);
        if (id) cell.queue.push(id);
      }
    }
    for (const cell of available) {
      const rank = rankedOrders(s).map((o) => o.id);
      cell.queue.sort(
        (a, b) =>
          rank.indexOf(flow.runs[a].orderId) -
          rank.indexOf(flow.runs[b].orderId),
      );
    }
  }
  flow.occupancy = {};
  const reserve = (ids: string[], workpieceId: string) => {
    for (const id of ids) {
      if (flow.occupancy[id] && flow.occupancy[id] !== workpieceId)
        throw new Error(`${id} 存在冲突的工件持有状态`);
      flow.occupancy[id] = workpieceId;
    }
  };
  for (const cell of flow.cells)
    if (cell.activeId) reserve(holds(flow.runs[cell.activeId]), cell.activeId);
  if (flow.transfer) {
    const cell = flow.cells.find((c) => c.id === flow.transfer!.cellId)!;
    reserve(transferResources(cell), flow.transfer.workpieceId);
  }
  if (!flow.transfer && s.running) {
    for (const cell of flow.cells) {
      const kind = cell.good.length ? "good" : "reject";
      const id = cell[kind][0];
      if (
        id &&
        transferResources(cell).every(
          (d) => !offline(s, d) && !flow.occupancy[d],
        )
      ) {
        flow.transfer = { workpieceId: id, cellId: cell.id, kind, elapsed: 0 };
        reserve(transferResources(cell), id);
        break;
      }
    }
  }
  const operating = new Set<string>();
  for (const cell of flow.cells) {
    cell.waitingReason = "";
    if (!cell.activeId) continue;
    const run = flow.runs[cell.activeId];
    const step = run.recipe.steps[run.stepIndex];
    const ids = requires(run);
    const unavailable = ids.find((id) => offline(s, id));
    const taken = ids.find(
      (id) => flow.occupancy[id] && flow.occupancy[id] !== run.workpieceId,
    );
    const full =
      step?.id === "sort" &&
      cell[run.inspection?.result === "pass" ? "good" : "reject"].length >=
        flow.outputCapacity;
    if (unavailable) cell.waitingReason = `${unavailable} 停机，保留当前工件`;
    else if (taken) cell.waitingReason = `等待 ${taken} 释放`;
    else if (full) cell.waitingReason = "出料缓冲区已满，等待物流转运";
    else if (run.status === "fault")
      cell.waitingReason = run.fault ?? "工序故障";
    else {
      reserve(ids, run.workpieceId);
      if (s.running) {
        commandProcess(run, { type: "START" });
        if (step) operating.add(run.devices[step.role]);
      }
    }
    if (cell.waitingReason || !s.running)
      commandProcess(run, { type: "PAUSE" });
  }
  if (s.running && flow.transfer) {
    const cell = flow.cells.find((c) => c.id === flow.transfer!.cellId)!;
    if (transferResources(cell).every((id) => !offline(s, id)))
      transferResources(cell).forEach((id) => operating.add(id));
  }
  for (const d of s.devices) {
    const oldTask = d.task;
    const held = flow.occupancy[d.id];
    const cell = flow.cells.find((c) => c.cncId === d.id || c.robotId === d.id);
    const run = held
      ? flow.runs[held]
      : cell?.activeId
        ? flow.runs[cell.activeId]
        : undefined;
    d.task = run?.orderId;
    if (d.status !== "fault" && d.status !== "maintenance")
      d.status = operating.has(d.id) ? "running" : "idle";
    if (d.task && d.task !== oldTask)
      event(s, "分配任务", `${d.id} 分配至 ${d.task}`, d.id, d.task);
  }
}

export function nextFlowBoundary(s: SimulationState) {
  let next = 1;
  for (const cell of s.flow.cells) {
    if (!cell.activeId || cell.waitingReason) continue;
    const run = s.flow.runs[cell.activeId];
    if (run.status === "running")
      next = Math.min(
        next,
        (run.recipe.steps[run.stepIndex].duration - run.stepElapsed) /
          modeRate[s.mode],
      );
  }
  if (s.flow.transfer) {
    const cell = s.flow.cells.find((c) => c.id === s.flow.transfer!.cellId)!;
    if (transferResources(cell).every((id) => !offline(s, id)))
      next = Math.min(next, s.flow.transferDuration - s.flow.transfer.elapsed);
  }
  for (const order of s.orders)
    if (order.planned > s.time + epsilon)
      next = Math.min(next, order.planned - s.time);
  return next > epsilon ? next : 1e-6;
}

export function processMeasurements(run: ProcessRun): ProcessMeasurement[] {
  return [
    {
      featureId: "hole-x",
      label: "孔位 X",
      unit: "mm",
      nominal: 20,
      lower: 19.95,
      upper: 20.05,
      actual: Number((20 + run.parameters.fixtureOffsetXmm).toFixed(6)),
      sourceStepId: "drill",
    },
    {
      featureId: "outer-diameter",
      label: "外轮廓直径",
      unit: "mm",
      nominal: 80,
      lower: 79.9,
      upper: 80.1,
      actual: Number((80 + run.parameters.contourDiameterErrorMm).toFixed(6)),
      sourceStepId: "contour",
    },
  ];
}

function finishInspection(s: SimulationState, run: ProcessRun) {
  const id = uid(s, "QI");
  recordProcessInspection(run, id, processMeasurements(run));
  const q = run.inspection!;
  s.workpieces.find((w) => w.id === run.workpieceId)!.result = q.result;
  const defect = q.measurements.find(
    (m) => m.actual < m.lower || m.actual > m.upper,
  );
  s.inspections.unshift({
    id,
    workpieceId: run.workpieceId,
    orderId: run.orderId,
    deviceId: run.devices.cnc,
    inspectorId: run.devices.qc,
    batch: `B-${run.orderId}`,
    time: s.time,
    result: q.result,
    defect: defect
      ? defect.featureId === "hole-x"
        ? "孔位超差"
        : "尺寸异常"
      : undefined,
    x: 50,
    y: 50,
    source: "production",
    measurements: structuredClone(q.measurements),
  });
  event(
    s,
    "质检完成",
    `${run.workpieceId} ${q.result === "pass" ? "检测合格" : "检测超差，隔离后补投"}（工艺规则仿真）`,
    run.devices.qc,
    run.orderId,
  );
}

/** Called after the single factory clock has advanced by dt. */
export function advanceFlow(s: SimulationState, dt: number) {
  const flow = s.flow;
  if (flow.transfer) {
    const transfer = flow.transfer;
    const cell = flow.cells.find((c) => c.id === transfer.cellId)!;
    if (transferResources(cell).every((id) => !offline(s, id))) {
      transfer.elapsed += dt;
      if (transfer.elapsed >= flow.transferDuration - epsilon) {
        const part = s.workpieces.find((w) => w.id === transfer.workpieceId)!;
        cell[transfer.kind] = cell[transfer.kind].filter(
          (id) => id !== part.id,
        );
        if (transfer.kind === "good") {
          part.storedAt = s.time;
          const order = s.orders.find((o) => o.id === part.orderId)!;
          if (!order.cancelled) {
            order.completed++;
            if (order.completed === order.quantity) {
              order.completedAt = s.time;
              event(
                s,
                "完成订单",
                `${order.id} 合格入库 ${order.quantity} 件`,
                cell.warehouseId,
                order.id,
              );
            }
          }
          event(
            s,
            "合格入库",
            `${part.id} 已转运入库`,
            cell.warehouseId,
            part.orderId,
          );
        } else {
          part.scrappedAt = s.time;
          event(
            s,
            "不合格品隔离",
            `${part.id} 已隔离报废，订单按合格需求补投`,
            cell.agvId,
            part.orderId,
          );
        }
        flow.transfer = null;
      }
    }
  }
  for (const cell of flow.cells) {
    if (!cell.activeId) continue;
    const run = flow.runs[cell.activeId];
    if (cell.waitingReason || run.status !== "running") {
      run.time = s.time;
      continue;
    }
    run.time = s.time - dt;
    const oldLength = run.trace.length;
    advanceProcess(run, dt, modeRate[s.mode]);
    for (const entry of run.trace.slice(oldLength)) {
      event(
        s,
        "工序流转",
        `${run.workpieceId} · ${run.recipe.steps.find((step) => step.id === entry.stepId)!.label}`,
        entry.deviceId,
        run.orderId,
      );
      if (entry.stepId === "tool-clear") {
        s.devices.find((d) => d.id === cell.cncId)!.produced++;
        event(
          s,
          "加工完成",
          `${run.workpieceId} 等待卸料检测`,
          cell.cncId,
          run.orderId,
        );
      }
    }
    const advancedStatus = flow.runs[run.workpieceId].status;
    if (advancedStatus === "awaiting-inspection") finishInspection(s, run);
    if (advancedStatus === "complete") {
      cell[run.inspection?.result === "pass" ? "good" : "reject"].push(
        run.workpieceId,
      );
      cell.activeId = null;
    }
  }
}

export function scheduleFlow(s: SimulationState, algorithm: Algorithm): Slot[] {
  const rate = modeRate[s.mode];
  const transferCell = s.flow.transfer
    ? s.flow.cells.find((c) => c.id === s.flow.transfer!.cellId)
    : undefined;
  const stalledWarehouse =
    transferCell && transferResources(transferCell).some((id) => offline(s, id))
      ? transferCell.warehouseId
      : undefined;
  const cells = s.flow.cells.filter(
    (c) =>
      c.warehouseId !== stalledWarehouse &&
      [c.cncId, c.robotId, c.qcId, c.agvId, c.warehouseId].every(
        (id) => !offline(s, id),
      ),
  );
  type Job = {
    orderId: string;
    planned: number;
    preQc: number;
    qc: number;
    failed: boolean;
  };
  const jobs: Record<string, Job[]> = Object.fromEntries(
    cells.map((c) => [c.id, []]),
  );
  const nominalFree = Object.fromEntries(cells.map((c) => [c.id, s.time]));
  const actualFree = { ...nominalFree };
  const result: Slot[] = [];
  const qcStart = flangeRecipe.steps.findIndex(
    (step) => step.id === "place-inspection",
  );
  const qcSeconds =
    flangeRecipe.steps
      .slice(qcStart)
      .reduce((sum, step) => sum + step.duration, 0) / rate;
  const add = (orderId: string, cell: Workcell, start: number, end: number) => {
    const order = s.orders.find((o) => o.id === orderId);
    if (!order || order.cancelled) return;
    const found = result.find(
      (slot) => slot.orderId === orderId && slot.deviceId === cell.cncId,
    );
    if (found) {
      found.start = Math.min(found.start, start);
      found.end = Math.max(found.end, end);
      found.quantity++;
      found.late = found.end > order.due;
    } else
      result.push({
        orderId,
        deviceId: cell.cncId,
        start,
        end,
        quantity: 1,
        late: end > order.due,
      });
  };
  for (const cell of cells) {
    for (const id of [
      ...(cell.activeId ? [cell.activeId] : []),
      ...cell.queue,
    ]) {
      const run = s.flow.runs[id];
      const preQc =
        run.stepIndex < qcStart
          ? Math.max(
              0,
              run.recipe.steps
                .slice(run.stepIndex, qcStart)
                .reduce((sum, step) => sum + step.duration, 0) -
                run.stepElapsed,
            ) / rate
          : 0;
      const qc =
        (run.recipe.steps
          .slice(Math.max(qcStart, run.stepIndex))
          .reduce((sum, step) => sum + step.duration, 0) -
          (run.stepIndex >= qcStart ? run.stepElapsed : 0)) /
        rate;
      jobs[cell.id].push({
        orderId: run.orderId,
        planned: s.time,
        preQc,
        qc,
        failed: run.inspection?.result === "fail",
      });
      nominalFree[cell.id] += preQc + qc;
    }
  }
  for (const order of rankedOrders(s, algorithm)) {
    const count = Math.max(
      0,
      order.quantity - order.completed - reservedForOrder(s, order.id),
    );
    for (let n = 0; n < count && cells.length; n++) {
      const cell = cells.reduce((a, b) =>
        nominalFree[a.id] <= nominalFree[b.id] ? a : b,
      );
      jobs[cell.id].push({
        orderId: order.id,
        planned: order.planned,
        preQc: cycleSeconds / rate - qcSeconds,
        qc: qcSeconds,
        failed: false,
      });
      nominalFree[cell.id] =
        Math.max(nominalFree[cell.id], order.planned) + cycleSeconds / rate;
    }
  }
  let qcFree = s.time;
  let warehouseFree = s.time;
  if (s.flow.transfer)
    warehouseFree += Math.max(
      0,
      s.flow.transferDuration - s.flow.transfer.elapsed,
    );
  for (const cell of cells) {
    for (const id of [...cell.good, ...cell.reject]) {
      if (s.flow.transfer?.workpieceId === id) {
        if (s.flow.transfer.kind === "good")
          add(s.flow.runs[id].orderId, cell, s.time, warehouseFree);
        continue;
      }
      warehouseFree += s.flow.transferDuration;
      if (cell.good.includes(id))
        add(s.flow.runs[id].orderId, cell, s.time, warehouseFree);
    }
  }
  while (cells.some((cell) => jobs[cell.id].length)) {
    const ready = cells.filter((cell) => jobs[cell.id].length);
    const arrives = (cell: Workcell) =>
      Math.max(actualFree[cell.id], jobs[cell.id][0].planned) +
      jobs[cell.id][0].preQc;
    const cell = ready.reduce((a, b) => (arrives(a) <= arrives(b) ? a : b));
    const job = jobs[cell.id].shift()!;
    const start = Math.max(actualFree[cell.id], job.planned);
    qcFree = Math.max(start + job.preQc, qcFree) + job.qc;
    actualFree[cell.id] = qcFree;
    warehouseFree = Math.max(qcFree, warehouseFree) + s.flow.transferDuration;
    if (!job.failed) add(job.orderId, cell, start, warehouseFree);
  }
  return result.map((slot) => ({
    ...slot,
    start: Math.round(slot.start * 1e6) / 1e6,
    end: Math.round(slot.end * 1e6) / 1e6,
  }));
}
