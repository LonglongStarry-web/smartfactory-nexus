import {
  processStepIds,
  type ActiveProcessStatus,
  type ProcessMeasurement,
  type ProcessParameters,
  type ProcessRecipe,
  type ProcessRun,
  type ProcessStatus,
} from "../domain/process";

export const flangeRecipe: ProcessRecipe = {
  id: "FLANGE-A320",
  revision: 1,
  product: "法兰件 A-320",
  steps: [
    {
      id: "pick",
      label: "抓取毛坯",
      role: "robot",
      duration: 2,
      anchor: "raw-pick",
      holderAfter: "gripper",
    },
    {
      id: "open-load-door",
      label: "打开上料门",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "gripper",
    },
    {
      id: "load",
      label: "工件定位",
      role: "robot",
      duration: 3,
      anchor: "fixture-load",
      holderAfter: "gripper",
    },
    {
      id: "clamp",
      label: "夹具夹紧并接管工件",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "retreat",
      label: "夹爪释放并撤离",
      role: "robot",
      duration: 2,
      anchor: "robot-clear",
      holderAfter: "fixture",
    },
    {
      id: "close-load-door",
      label: "关闭上料门",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "face",
      label: "端面加工",
      role: "cnc",
      duration: 6,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "contour",
      label: "轮廓加工",
      role: "cnc",
      duration: 8,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "drill",
      label: "钻孔",
      role: "cnc",
      duration: 6,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "deburr",
      label: "去毛刺",
      role: "cnc",
      duration: 2,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "tool-clear",
      label: "退刀并停止加工动作",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "open-unload-door",
      label: "打开卸料门",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "grip-finished",
      label: "夹爪夹持成品",
      role: "robot",
      duration: 2,
      anchor: "fixture-load",
      holderAfter: "fixture",
    },
    {
      id: "unclamp",
      label: "夹具松开并移交工件",
      role: "cnc",
      duration: 1,
      anchor: "fixture-load",
      holderAfter: "gripper",
    },
    {
      id: "unload",
      label: "取出工件",
      role: "robot",
      duration: 3,
      anchor: "robot-clear",
      holderAfter: "gripper",
    },
    {
      id: "close-unload-door",
      label: "关闭卸料门",
      role: "cnc",
      duration: 1,
      anchor: "robot-clear",
      holderAfter: "gripper",
    },
    {
      id: "place-inspection",
      label: "放置到检测工位",
      role: "robot",
      duration: 3,
      anchor: "qc-place",
      holderAfter: "inspection",
    },
    {
      id: "inspect",
      label: "检测运动",
      role: "qc",
      duration: 3,
      anchor: "qc-place",
      holderAfter: "inspection",
    },
    {
      id: "sort",
      label: "按检测结果分流",
      role: "qc",
      duration: 2,
      anchor: "output-place",
      holderAfter: "quality-output",
    },
  ],
};

export const defaultProcessParameters: ProcessParameters = {
  spindleRpm: 2400,
  feedMmPerMin: 180,
  fixtureOffsetXmm: 0,
  contourDiameterErrorMm: 0,
};

function finiteNonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${label}必须为非负有限数`);
}

function validateParameters(parameters: ProcessParameters) {
  if (
    !parameters ||
    !Number.isFinite(parameters.spindleRpm) ||
    parameters.spindleRpm <= 0 ||
    !Number.isFinite(parameters.feedMmPerMin) ||
    parameters.feedMmPerMin <= 0 ||
    !Number.isFinite(parameters.fixtureOffsetXmm) ||
    !Number.isFinite(parameters.contourDiameterErrorMm)
  ) {
    throw new Error("加工参数无效");
  }
}

function validateDevices(devices: ProcessRun["devices"]) {
  const ids = [devices?.cnc, devices?.robot, devices?.qc];
  if (
    ids.some((id) => typeof id !== "string" || !id.trim()) ||
    new Set(ids).size !== 3 ||
    Object.keys(devices).length !== 3
  ) {
    throw new Error("必须指定三个不同的加工单元设备");
  }
}

function validateRecipe(recipe: ProcessRecipe) {
  if (
    !recipe?.id ||
    !recipe.product ||
    !Number.isInteger(recipe.revision) ||
    recipe.revision < 1 ||
    recipe.steps?.length !== processStepIds.length
  )
    throw new Error("工艺配方无效");
  const holders = [
    "infeed",
    "gripper",
    "fixture",
    "inspection",
    "good-buffer",
    "reject-buffer",
    "quality-output",
  ];
  const anchors = [
    "raw-pick",
    "fixture-load",
    "robot-clear",
    "qc-place",
    "output-place",
  ];
  recipe.steps.forEach((step, index) => {
    if (
      step.id !== processStepIds[index] ||
      !Number.isFinite(step.duration) ||
      step.duration <= 0 ||
      !["cnc", "robot", "qc"].includes(step.role) ||
      !step.label ||
      !holders.includes(step.holderAfter) ||
      !anchors.includes(step.anchor)
    )
      throw new Error("工序定义或顺序无效");
    if (
      index < recipe.steps.length - 1 &&
      step.holderAfter === "quality-output"
    )
      throw new Error("仅分流阶段可以确定质量去向");
  });
}

export function createProcessRun(input: {
  workpieceId: string;
  orderId: string;
  recipe?: ProcessRecipe;
  parameters?: Partial<ProcessParameters>;
  devices?: ProcessRun["devices"];
  time?: number;
  inspectionTimeout?: number;
}): ProcessRun {
  if (!input.workpieceId.trim() || !input.orderId.trim())
    throw new Error("必须提供工件与订单编号");
  const recipe = structuredClone(input.recipe ?? flangeRecipe);
  validateRecipe(recipe);
  const parameters = { ...defaultProcessParameters, ...input.parameters };
  validateParameters(parameters);
  const time = input.time ?? 0;
  const inspectionTimeout = input.inspectionTimeout ?? 30;
  finiteNonnegative(time, "模拟时间");
  if (!Number.isFinite(inspectionTimeout) || inspectionTimeout <= 0)
    throw new Error("检测等待超时必须大于零");
  const devices = structuredClone(
    input.devices ?? { cnc: "CNC-01", robot: "ARM-01", qc: "QC-01" },
  );
  validateDevices(devices);
  return {
    version: 1,
    workpieceId: input.workpieceId,
    orderId: input.orderId,
    recipe,
    parameters,
    devices,
    status: "ready",
    resumeStatus: "running",
    fault: null,
    time,
    stepIndex: 0,
    stepElapsed: 0,
    stepStartedAt: time,
    inspectionWait: 0,
    inspectionTimeout,
    holder: "infeed",
    trace: [],
    inspection: null,
  };
}

export type ProcessCommand =
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "FAULT"; reason: string }
  | { type: "RECOVER" }
  | { type: "CANCEL" };

/** Commands mutate only this serializable state; repeated terminal commands are no-ops. */
export function commandProcess(run: ProcessRun, command: ProcessCommand): void {
  if (run.status === "complete" || run.status === "cancelled") return;
  if (command.type === "CANCEL") {
    run.status = "cancelled";
    return;
  }
  if (
    command.type === "START" &&
    (run.status === "ready" || run.status === "paused")
  ) {
    if (run.status === "ready") run.stepStartedAt = run.time;
    run.status = run.resumeStatus;
  } else if (
    command.type === "PAUSE" &&
    (run.status === "running" || run.status === "awaiting-inspection")
  ) {
    run.resumeStatus = run.status;
    run.status = "paused";
  } else if (
    command.type === "FAULT" &&
    run.status !== "fault" &&
    run.status !== "ready"
  ) {
    if (!command.reason.trim()) throw new Error("必须说明故障原因");
    if (run.status === "running" || run.status === "awaiting-inspection")
      run.resumeStatus = run.status;
    run.fault = command.reason;
    run.status = "fault";
  } else if (command.type === "RECOVER" && run.status === "fault") {
    run.fault = null;
    run.inspectionWait = 0;
    run.status = "paused";
  }
}

/** Pass simulated seconds, never a browser timer or a frame count. */
export function advanceProcess(run: ProcessRun, seconds: number): void {
  finiteNonnegative(seconds, "推进时间");
  if (
    seconds === 0 ||
    ["ready", "paused", "complete", "cancelled"].includes(run.status)
  )
    return;
  let left = seconds;
  while (left > 0) {
    if (run.status === "fault") {
      run.time += left;
      return;
    }
    if (run.status === "awaiting-inspection") {
      const consumed = Math.min(
        left,
        Math.max(0, run.inspectionTimeout - run.inspectionWait),
      );
      run.time += consumed;
      run.inspectionWait += consumed;
      left -= consumed;
      if (run.inspectionWait >= run.inspectionTimeout)
        commandProcess(run, { type: "FAULT", reason: "检测结果等待超时" });
      if (left === 0) return;
      continue;
    }
    const step = run.recipe.steps[run.stepIndex];
    const remaining = step.duration - run.stepElapsed;
    if (left < remaining - 1e-9) {
      run.stepElapsed += left;
      run.time += left;
      return;
    }
    const consumed = Math.min(left, remaining);
    run.time += consumed;
    left -= consumed;
    run.stepElapsed = step.duration;
    const holderAfter =
      step.holderAfter === "quality-output"
        ? run.inspection?.result === "pass"
          ? "good-buffer"
          : "reject-buffer"
        : step.holderAfter;
    if (step.id === "sort" && !run.inspection)
      throw new Error("没有检测结果，不能分流");
    run.trace.push({
      stepId: step.id,
      deviceId: run.devices[step.role],
      startedAt: run.stepStartedAt,
      completedAt: run.time,
      holderBefore: run.holder,
      holderAfter,
    });
    run.holder = holderAfter;
    if (step.id === "inspect") {
      run.status = "awaiting-inspection";
      run.resumeStatus = "awaiting-inspection";
      continue;
    }
    run.stepIndex++;
    run.stepElapsed = 0;
    run.stepStartedAt = run.time;
    if (run.stepIndex === run.recipe.steps.length) {
      run.status = "complete";
      return;
    }
  }
}

function validateMeasurements(
  run: ProcessRun,
  measurements: ProcessMeasurement[],
) {
  if (
    !measurements.length ||
    new Set(measurements.map((m) => m.featureId)).size !== measurements.length
  )
    throw new Error("检测特征必须非空且唯一");
  for (const measurement of measurements) {
    if (
      !measurement.featureId.trim() ||
      !measurement.label.trim() ||
      measurement.unit !== "mm" ||
      ![
        measurement.nominal,
        measurement.lower,
        measurement.upper,
        measurement.actual,
      ].every(Number.isFinite) ||
      measurement.lower > measurement.nominal ||
      measurement.nominal > measurement.upper ||
      !run.trace.some((entry) => entry.stepId === measurement.sourceStepId)
    )
      throw new Error("检测值、规格或来源工序无效");
  }
}

export function recordProcessInspection(
  run: ProcessRun,
  id: string,
  measurements: ProcessMeasurement[],
): void {
  if (!id.trim()) throw new Error("必须提供检测记录编号");
  validateMeasurements(run, measurements);
  if (run.inspection) {
    if (
      run.inspection.id === id &&
      JSON.stringify(run.inspection.measurements) ===
        JSON.stringify(measurements)
    )
      return;
    throw new Error("已有检测结果不可覆盖");
  }
  if (run.status !== "awaiting-inspection")
    throw new Error("当前阶段不能接收检测结果");
  run.inspection = {
    id,
    time: run.time,
    result: measurements.every(
      (m) => m.actual >= m.lower && m.actual <= m.upper,
    )
      ? "pass"
      : "fail",
    measurements: structuredClone(measurements),
  };
  run.stepIndex++;
  run.stepElapsed = 0;
  run.stepStartedAt = run.time;
  run.inspectionWait = 0;
  run.resumeStatus = "running";
  run.status = "running";
}

/** Counts are derived from records; accepted output is separate from machining. */
export function processCounts(runs: ProcessRun[]) {
  if (new Set(runs.map((run) => run.workpieceId)).size !== runs.length)
    throw new Error("工件编号重复，不能累计统计");
  return {
    released: runs.length,
    inProgress: runs.filter(
      (run) => run.status !== "complete" && run.status !== "cancelled",
    ).length,
    machined: runs.filter((run) =>
      run.trace.some((entry) => entry.stepId === "tool-clear"),
    ).length,
    awaitingInspection: runs.filter(
      (run) =>
        run.status === "awaiting-inspection" ||
        (["paused", "fault"].includes(run.status) &&
          run.resumeStatus === "awaiting-inspection"),
    ).length,
    inspected: runs.filter((run) => run.inspection !== null).length,
    passed: runs.filter((run) => run.inspection?.result === "pass").length,
    failed: runs.filter((run) => run.inspection?.result === "fail").length,
    goodBuffered: runs.filter(
      (run) => run.status === "complete" && run.holder === "good-buffer",
    ).length,
    rejectedBuffered: runs.filter(
      (run) => run.status === "complete" && run.holder === "reject-buffer",
    ).length,
    cancelled: runs.filter((run) => run.status === "cancelled").length,
  };
}

/** Recover only snapshots produced by this version; never auto-resume production. */
export function restoreProcessRun(snapshot: ProcessRun): ProcessRun {
  const run = structuredClone(snapshot);
  const statuses: ProcessStatus[] = [
    "ready",
    "running",
    "paused",
    "fault",
    "awaiting-inspection",
    "complete",
    "cancelled",
  ];
  if (
    run.version !== 1 ||
    !statuses.includes(run.status) ||
    !["running", "awaiting-inspection"].includes(run.resumeStatus)
  )
    throw new Error("工序存档版本或状态无效");
  validateRecipe(run.recipe);
  validateParameters(run.parameters);
  validateDevices(run.devices);
  finiteNonnegative(run.time, "模拟时间");
  finiteNonnegative(run.stepElapsed, "阶段进度");
  finiteNonnegative(run.inspectionWait, "检测等待");
  const step = run.recipe.steps[run.stepIndex];
  if (
    !Number.isInteger(run.stepIndex) ||
    run.stepIndex < 0 ||
    run.stepIndex > run.recipe.steps.length ||
    (run.status === "complete"
      ? run.stepIndex !== run.recipe.steps.length
      : !step) ||
    (step && run.stepElapsed > step.duration) ||
    !Number.isFinite(run.stepStartedAt) ||
    run.stepStartedAt < 0 ||
    run.stepStartedAt > run.time ||
    !Number.isFinite(run.inspectionTimeout) ||
    run.inspectionTimeout <= 0
  )
    throw new Error("工序存档进度无效");
  const waiting =
    step?.id === "inspect" && run.trace.at(-1)?.stepId === "inspect";
  if (
    run.trace.length !== run.stepIndex + (waiting ? 1 : 0) ||
    (waiting &&
      (step?.id !== "inspect" ||
        run.stepElapsed !== step.duration ||
        run.inspection !== null))
  )
    throw new Error("工序存档轨迹不完整");
  let previousHolder: ProcessRun["holder"] = "infeed";
  let previousTime = 0;
  run.trace.forEach((entry, index) => {
    if (
      entry.stepId !== run.recipe.steps[index]?.id ||
      !Number.isFinite(entry.startedAt) ||
      !Number.isFinite(entry.completedAt) ||
      entry.startedAt < previousTime ||
      entry.completedAt < entry.startedAt ||
      entry.completedAt > run.time ||
      entry.deviceId !== run.devices[run.recipe.steps[index].role] ||
      entry.holderBefore !== previousHolder
    )
      throw new Error("工序存档轨迹无效");
    const expectedHolder =
      run.recipe.steps[index].holderAfter === "quality-output"
        ? run.inspection?.result === "pass"
          ? "good-buffer"
          : "reject-buffer"
        : run.recipe.steps[index].holderAfter;
    if (entry.holderAfter !== expectedHolder)
      throw new Error("工件交接记录无效");
    previousHolder = entry.holderAfter;
    previousTime = entry.completedAt;
  });
  if (
    run.holder !== previousHolder ||
    !run.workpieceId?.trim() ||
    !run.orderId?.trim() ||
    (run.status === "fault" &&
      !(typeof run.fault === "string" && run.fault.length > 0)) ||
    (run.fault !== null &&
      run.status !== "fault" &&
      run.status !== "cancelled") ||
    ((run.status === "awaiting-inspection" ||
      run.resumeStatus === "awaiting-inspection") &&
      !waiting) ||
    ((run.status === "complete" || step?.id === "sort") && !run.inspection)
  )
    throw new Error("工序存档上下文不一致");
  if (run.inspection) {
    if (
      !run.inspection.id?.trim() ||
      !Number.isFinite(run.inspection.time) ||
      run.inspection.time < 0 ||
      run.inspection.time > run.time ||
      waiting
    )
      throw new Error("检测记录上下文无效");
    validateMeasurements(run, run.inspection.measurements);
    const expected = run.inspection.measurements.every(
      (m) => m.actual >= m.lower && m.actual <= m.upper,
    )
      ? "pass"
      : "fail";
    if (run.inspection.result !== expected)
      throw new Error("检测结果与检测值不一致");
  }
  if (run.status === "running" || run.status === "awaiting-inspection") {
    run.resumeStatus = run.status as ActiveProcessStatus;
    run.status = "paused";
  }
  return run;
}
