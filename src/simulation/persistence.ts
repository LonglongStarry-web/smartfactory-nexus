import type { SimulationState } from "../domain/types";
import { createFactoryFlow, assignFlow } from "./flow";
import { restoreProcessRun } from "./process";
import type { ProcessRecipe, ProcessRun } from "../domain/process";
import { factoryLayout } from "../domain/layout";

/** Deduplicate recipe definitions in storage, retaining per-piece parameters and traces. */
export function serializeFactoryState(s: SimulationState) {
  const recipeCatalog: Record<string, ProcessRecipe> = {};
  const keys = new Map<string, string>();
  const runs: Record<
    string,
    Omit<ProcessRun, "recipe"> & { recipeRef: string }
  > = {};
  for (const [id, run] of Object.entries(s.flow.runs)) {
    const signature = JSON.stringify(run.recipe);
    let recipeRef = keys.get(signature);
    if (!recipeRef) {
      recipeRef = `recipe-${keys.size + 1}`;
      keys.set(signature, recipeRef);
      recipeCatalog[recipeRef] = run.recipe;
    }
    const { recipe: _recipe, ...context } = run;
    runs[id] = { ...context, recipeRef };
  }
  return { ...s, running: false, flow: { ...s.flow, runs, recipeCatalog } };
}

/** Retain legacy business records without inventing process or storage evidence. */
export function restoreFactoryState(input: unknown): SimulationState {
  const s = structuredClone(input) as SimulationState;
  if (
    !s ||
    ![1, 2].includes(s.version) ||
    !Number.isFinite(s.time) ||
    s.time < 0 ||
    !Number.isInteger(s.seq) ||
    !Array.isArray(s.orders) ||
    !Array.isArray(s.devices) ||
    !Array.isArray(s.workpieces) ||
    !Array.isArray(s.inspections) ||
    !Array.isArray(s.events)
  )
    throw new Error("制造存档无效");
  s.running = false;
  for (const device of s.devices)
    if (factoryLayout[device.id])
      device.position = [...factoryLayout[device.id]];
  if (s.version === 1) {
    s.version = 2;
    s.flow = createFactoryFlow();
    s.legacyCarry = structuredClone(s.carry ?? {});
    s.carry = {};
    s.orders.forEach((o) => {
      o.completionBasis = "legacy-machined";
      o.legacyCompleted = o.completed;
    });
    s.workpieces.forEach((w) => {
      w.source = "legacy";
    });
    s.inspections.forEach((q) => {
      q.source = "legacy";
    });
  } else {
    const packed = s.flow as SimulationState["flow"] & {
      recipeCatalog?: Record<string, ProcessRecipe>;
    };
    if (packed?.recipeCatalog) {
      for (const run of Object.values(packed.runs)) {
        const saved = run as ProcessRun & { recipeRef?: string };
        const recipe = saved.recipeRef
          ? packed.recipeCatalog[saved.recipeRef]
          : undefined;
        if (!recipe) throw new Error("工序存档缺少配方定义");
        saved.recipe = structuredClone(recipe);
        delete saved.recipeRef;
      }
      delete packed.recipeCatalog;
    }
    if (
      s.flow?.schema !== 1 ||
      !Array.isArray(s.flow.cells) ||
      !s.flow.runs ||
      !Number.isInteger(s.flow.inputCapacity) ||
      s.flow.inputCapacity < 1 ||
      !Number.isInteger(s.flow.outputCapacity) ||
      s.flow.outputCapacity < 1 ||
      !Number.isFinite(s.flow.transferDuration) ||
      s.flow.transferDuration <= 0
    )
      throw new Error("流转存档无效");
    for (const [id, run] of Object.entries(s.flow.runs)) {
      if (
        id !== run.workpieceId ||
        s.workpieces.filter((w) => w.id === id).length !== 1 ||
        !s.orders.some((o) => o.id === run.orderId)
      )
        throw new Error("工件关联存档无效");
      s.flow.runs[id] = restoreProcessRun(run);
    }
    for (const attempts of Object.values(s.flow.reworkArchive ?? {}))
      for (let i = 0; i < attempts.length; i++)
        attempts[i] = restoreProcessRun(attempts[i]);
    s.flow.warehouseCapacity ??= 480;
    if (
      !Number.isInteger(s.flow.warehouseCapacity) ||
      s.flow.warehouseCapacity < 1
    )
      throw new Error("仓储容量存档无效");
    const locations: string[] = [];
    if (s.flow.reroute) {
      const j = s.flow.reroute;
      if (
        !s.flow.runs[j.workpieceId] ||
        s.flow.runs[j.workpieceId].status !== "ready" ||
        !s.flow.cells.some((c) => c.id === j.from) ||
        !s.flow.cells.some((c) => c.id === j.to) ||
        !Number.isFinite(j.elapsed) ||
        j.elapsed < 0 ||
        j.elapsed >= j.duration
      )
        throw new Error("替代路线存档无效");
      locations.push(j.workpieceId);
    }

    for (const cell of s.flow.cells) {
      if (
        ![
          cell.cncId,
          cell.robotId,
          cell.qcId,
          cell.agvId,
          cell.warehouseId,
        ].every((id) => s.devices.some((d) => d.id === id)) ||
        ![cell.queue, cell.good, cell.reject].every(Array.isArray) ||
        cell.queue.length > s.flow.inputCapacity ||
        cell.good.length > s.flow.outputCapacity ||
        cell.reject.length > s.flow.outputCapacity
      )
        throw new Error("加工单元存档无效");
      cell.capabilities ??= ["flange", "plate"];
      cell.currentFamily ??= "flange";
      if (
        cell.capabilities.some((f) => !["flange", "plate"].includes(f)) ||
        new Set(cell.capabilities).size !== cell.capabilities.length ||
        (cell.setup &&
          (!Number.isFinite(cell.setup.remaining) ||
            cell.setup.remaining < 0 ||
            cell.setup.remaining > 6))
      )
        throw new Error("换型能力存档无效");
      for (const kind of ["good", "reject"] as const)
        cell[kind].forEach((id, i) => {
          const p = s.workpieces.find((w) => w.id === id);
          if (p) p.bufferSlot ??= i;
        });
      locations.push(
        ...cell.queue,
        ...cell.good,
        ...cell.reject,
        ...(cell.activeId ? [cell.activeId] : []),
      );
    }
    if (
      new Set(locations).size !== locations.length ||
      locations.some((id) => !s.flow.runs[id])
    )
      throw new Error("工件位置存档冲突");
    const transfer = s.flow.transfer;
    if (transfer) {
      const cell = s.flow.cells.find((c) => c.id === transfer.cellId);
      if (
        !cell ||
        !["good", "reject"].includes(transfer.kind) ||
        !cell[transfer.kind].includes(transfer.workpieceId) ||
        !Number.isFinite(transfer.elapsed) ||
        transfer.elapsed < 0 ||
        transfer.elapsed >= s.flow.transferDuration
      )
        throw new Error("转运存档无效");
    }
  }
  assignFlow(s);
  return s;
}
