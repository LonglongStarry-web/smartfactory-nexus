import { describe, expect, it } from "vitest";
import {
  processStepIds,
  type ProcessMeasurement,
  type ProcessRun,
} from "../src/domain/process";
import {
  advanceProcess,
  commandProcess,
  createProcessRun,
  flangeRecipe,
  processCounts,
  recordProcessInspection,
  restoreProcessRun,
} from "../src/simulation/process";

function measurement(actual = 20): ProcessMeasurement[] {
  return [
    {
      featureId: "hole-x",
      label: "孔位 X",
      unit: "mm",
      nominal: 20,
      lower: 19.95,
      upper: 20.05,
      actual,
      sourceStepId: "drill",
    },
  ];
}

function create(id = "WP-001") {
  return createProcessRun({ workpieceId: id, orderId: "ORD-001" });
}

function toInspection(run = create()) {
  commandProcess(run, { type: "START" });
  advanceProcess(
    run,
    run.recipe.steps.slice(0, -1).reduce((sum, step) => sum + step.duration, 0),
  );
  expect(run.status).toBe("awaiting-inspection");
  return run;
}

describe("v1.2 工序基础", () => {
  it("投料时固定工件身份、工艺版本与参数，不受后续配方修改影响", () => {
    const recipe = structuredClone(flangeRecipe);
    const parameters = { spindleRpm: 2200, fixtureOffsetXmm: 0.08 };
    const run = createProcessRun({
      workpieceId: "WP-001",
      orderId: "ORD-001",
      recipe,
      parameters,
    });
    recipe.steps[0].duration = 99;
    parameters.fixtureOffsetXmm = 0;
    expect(run.recipe.steps[0].duration).toBe(2);
    expect(run.parameters.fixtureOffsetXmm).toBe(0.08);
    expect(run.holder).toBe("infeed");
    expect(run.workpieceId).toBe("WP-001");
  });

  it("大时间步与细时间步得到相同工序、交接和检测等待状态", () => {
    const single = toInspection();
    const small = create();
    commandProcess(small, { type: "START" });
    for (let i = 0; i < single.time * 8; i++) advanceProcess(small, 0.125);
    expect(small).toEqual(single);
    expect(single.trace.map((entry) => entry.stepId)).toEqual(
      processStepIds.slice(0, -1),
    );
    expect(single.holder).toBe("inspection");
  });

  it("夹具夹紧后才接管工件，松开夹具时移交夹爪", () => {
    const run = toInspection();
    expect(run.trace.find((t) => t.stepId === "load")?.holderAfter).toBe(
      "gripper",
    );
    expect(run.trace.find((t) => t.stepId === "clamp")?.holderAfter).toBe(
      "fixture",
    );
    expect(
      run.trace.find((t) => t.stepId === "grip-finished")?.holderAfter,
    ).toBe("fixture");
    expect(run.trace.find((t) => t.stepId === "unclamp")?.holderAfter).toBe(
      "gripper",
    );
    expect(
      run.trace.every(
        (entry, i) =>
          i === 0 || entry.holderBefore === run.trace[i - 1].holderAfter,
      ),
    ).toBe(true);
    expect(run.trace.find((t) => t.stepId === "drill")?.deviceId).toBe(
      "CNC-01",
    );
  });

  it("未检测的已加工工件不能计为合格产出", () => {
    const run = toInspection();
    expect(processCounts([run])).toMatchObject({
      released: 1,
      machined: 1,
      awaitingInspection: 1,
      inspected: 0,
      passed: 0,
      goodBuffered: 0,
    });
    expect(() =>
      recordProcessInspection(create(), "QI-1", measurement()),
    ).toThrow();
    expect(run.trace.some((entry) => entry.stepId === "sort")).toBe(false);
  });

  it("超差件依据测量值进入不合格区，与合格缓冲分开统计", () => {
    const failed = toInspection(create("WP-001"));
    const passed = toInspection(create("WP-002"));
    recordProcessInspection(failed, "QI-1", measurement(20.08));
    recordProcessInspection(passed, "QI-2", measurement());
    advanceProcess(failed, 10);
    advanceProcess(passed, 10);
    expect(failed.holder).toBe("reject-buffer");
    expect(passed.holder).toBe("good-buffer");
    expect(processCounts([passed, failed])).toMatchObject({
      released: 2,
      machined: 2,
      inspected: 2,
      passed: 1,
      failed: 1,
      goodBuffered: 1,
      rejectedBuffered: 1,
      inProgress: 0,
    });
  });

  it("规格边界包含在合格范围内，边界外判为不合格", () => {
    const edge = toInspection();
    recordProcessInspection(edge, "QI-1", measurement(20.05));
    expect(edge.inspection?.result).toBe("pass");
    const outside = toInspection();
    recordProcessInspection(outside, "QI-1", measurement(20.050001));
    expect(outside.inspection?.result).toBe("fail");
  });

  it("重复检测事件幂等，冲突事件及后续参数修改不能改写历史结果", () => {
    const run = toInspection();
    const values = measurement();
    recordProcessInspection(run, "QI-1", values);
    const saved = structuredClone(run);
    recordProcessInspection(run, "QI-1", values);
    expect(run).toEqual(saved);
    values[0].actual = 99;
    expect(run.inspection?.measurements[0].actual).toBe(20);
    expect(() => recordProcessInspection(run, "QI-1", values)).toThrow(
      "不可覆盖",
    );
    advanceProcess(run, 20);
    advanceProcess(run, 20);
    expect(run.trace).toHaveLength(19);
    expect(processCounts([run]).goodBuffered).toBe(1);
  });

  it("暂停保持状态，故障保持工序进度与工件归属，恢复后显式继续", () => {
    const run = create();
    commandProcess(run, { type: "START" });
    advanceProcess(run, 1);
    commandProcess(run, { type: "PAUSE" });
    const paused = structuredClone(run);
    advanceProcess(run, 100);
    expect(run).toEqual(paused);
    commandProcess(run, { type: "START" });
    commandProcess(run, { type: "FAULT", reason: "夹爪故障" });
    advanceProcess(run, 100);
    expect(run.stepElapsed).toBe(1);
    expect(run.holder).toBe("infeed");
    expect(run.time).toBe(101);
    commandProcess(run, { type: "RECOVER" });
    expect(run.status).toBe("paused");
    commandProcess(run, { type: "START" });
    advanceProcess(run, 1);
    expect(run.holder).toBe("gripper");
    expect(run.trace[0].completedAt).toBe(102);
  });

  it("检测结果缺失会超时故障，恢复后仍等待检测结果", () => {
    const run = toInspection();
    const stage = run.stepIndex;
    advanceProcess(run, 35);
    expect(run.status).toBe("fault");
    expect(run.fault).toBe("检测结果等待超时");
    expect(run.stepIndex).toBe(stage);
    expect(run.inspection).toBeNull();
    expect(() => recordProcessInspection(run, "QI-1", measurement())).toThrow(
      "当前阶段",
    );
    commandProcess(run, { type: "RECOVER" });
    commandProcess(run, { type: "START" });
    expect(run.status).toBe("awaiting-inspection");
    recordProcessInspection(run, "QI-1", measurement());
    advanceProcess(run, 2);
    expect(run.status).toBe("complete");
  });

  it("取消为终态，等待检测时取消也能完整恢复", () => {
    const run = toInspection();
    commandProcess(run, { type: "CANCEL" });
    const saved = structuredClone(run);
    commandProcess(run, { type: "START" });
    advanceProcess(run, 300);
    expect(run).toEqual(saved);
    expect(restoreProcessRun(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(processCounts([run])).toMatchObject({
      cancelled: 1,
      awaitingInspection: 0,
      goodBuffered: 0,
    });
  });

  it("JSON 恢复后暂停，显式继续后仍保留原检测等待和参数快照", () => {
    const source = toInspection();
    const restored = restoreProcessRun(JSON.parse(JSON.stringify(source)));
    expect(restored.status).toBe("paused");
    commandProcess(restored, { type: "START" });
    expect(restored).toEqual(source);
    recordProcessInspection(restored, "QI-1", measurement());
    advanceProcess(restored, 2);
    expect(restoreProcessRun(restored).status).toBe("complete");
  });

  it("故障时取消仍保留原因，恢复存档不会重新启动或重新等待检测", () => {
    const run = toInspection();
    commandProcess(run, { type: "FAULT", reason: "检测设备离线" });
    commandProcess(run, { type: "CANCEL" });
    const restored = restoreProcessRun(JSON.parse(JSON.stringify(run)));
    expect(restored).toEqual(run);
    expect(restored.fault).toBe("检测设备离线");
    expect(restored.status).toBe("cancelled");
    expect(processCounts([restored]).awaitingInspection).toBe(0);
  });

  it("拒绝无效时间、配方、测量与重复工件，损坏存档不进入加工", () => {
    const run = toInspection();
    for (const seconds of [-1, NaN, Infinity])
      expect(() => advanceProcess(run, seconds)).toThrow();
    expect(() =>
      createProcessRun({
        workpieceId: "x",
        orderId: "y",
        parameters: { spindleRpm: 0 },
      }),
    ).toThrow();
    const recipe = structuredClone(flangeRecipe);
    recipe.steps[0].duration = 0;
    expect(() =>
      createProcessRun({ workpieceId: "x", orderId: "y", recipe }),
    ).toThrow();
    expect(() => recordProcessInspection(run, "QI-1", [])).toThrow();
    const invalid = measurement(NaN);
    expect(() => recordProcessInspection(run, "QI-1", invalid)).toThrow();
    expect(() => processCounts([run, run])).toThrow("重复");
    const corrupt = structuredClone(run);
    corrupt.trace[3].holderBefore = "good-buffer";
    expect(() => restoreProcessRun(corrupt)).toThrow();
    const missing = structuredClone(run);
    missing.trace.pop();
    expect(() => restoreProcessRun(missing)).toThrow();
  });
});
