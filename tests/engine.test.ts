import { describe, it, expect } from "vitest";
import {
  initialState,
  tick,
  schedule,
  inject,
  createMaintenance,
  restore,
  addOrder,
  metrics,
} from "../src/simulation/engine";
describe("统一制造模拟引擎", () => {
  it("固定种子可重现生产、质量与能耗", () => {
    const a = initialState(),
      b = initialState();
    a.running = b.running = true;
    tick(a, 120);
    tick(b, 120);
    expect(a).toEqual(b);
    expect(metrics(a).output).toBeGreaterThan(0);
    expect(metrics(a).output).toBe(
      Object.values(a.flow.runs).filter((r) =>
        r.trace.some((t) => t.stepId === "tool-clear"),
      ).length,
    );
    expect(metrics(a).energy).toBeGreaterThan(0);
    expect(a.workpieces.length).toBeGreaterThan(metrics(a).output);
    expect(a.inspections.length).toBe(
      Object.values(a.flow.runs).filter((r) => r.inspection).length,
    );
  });
  it("暂停时模拟状态不改变", () => {
    const a = initialState(),
      b = structuredClone(a);
    tick(a, 120);
    expect(a).toEqual(b);
  });
  it("紧急订单在相同约束下改变调度次序", () => {
    const s = initialState();
    const id = addOrder(s, {
      product: "紧急工件",
      quantity: 20,
      priority: 0,
      planned: 0,
      due: 400,
    });
    expect(schedule(s, "PRIORITY")[0].orderId).toBe(id);
    expect(schedule(s, "FCFS")[0].orderId).toBe("ORD-001");
  });
  it("故障停机、生成告警并从调度中移除，另一设备继续生产", () => {
    const s = initialState();
    s.running = true;
    tick(s, 100);
    const output = s.devices[0].produced;
    const other = s.devices[2].produced;
    inject(s, "CNC-01", "温度异常");
    expect(s.devices[0].status).toBe("fault");
    expect(s.alarms.filter((a) => !a.resolved)).toHaveLength(1);
    expect(schedule(s).every((x) => x.deviceId !== "CNC-01")).toBe(true);
    tick(s, 100);
    expect(s.devices[0].produced).toBe(output);
    expect(s.devices[2].produced).toBeGreaterThan(other);
  });
  it("维修步骤不可跳过，完成后恢复且保留历史", () => {
    const s = initialState();
    s.running = true;
    inject(s, "CNC-01", "设备故障");
    createMaintenance(s, "CNC-01");
    expect(() => restore(s, "CNC-01")).toThrow();
    s.maintenance[0].steps = [true, true, true];
    restore(s, "CNC-01");
    expect(["idle", "running"]).toContain(s.devices[0].status);
    expect(s.alarms[0].resolved).toBe(true);
    expect(s.maintenance[0].completed).toBe(0);
    expect(s.events.some((e) => e.type === "设备恢复")).toBe(true);
    tick(s, 40);
    expect(s.devices[0].produced).toBeGreaterThan(0);
  });
  it("能耗积分符合功率与模拟时间；高性能比节能更快且耗电更多", () => {
    const a = initialState(),
      b = initialState();
    a.running = b.running = true;
    a.mode = "performance";
    b.mode = "eco";
    tick(a, 100);
    tick(b, 100);
    expect(metrics(a).output).toBeGreaterThan(metrics(b).output);
    expect(metrics(a).energy).toBeGreaterThan(metrics(b).energy);
    const active = a.devices[0].runtime;
    expect(a.devices[0].energy).toBeCloseTo(
      (8 * 1.55 * active + 8 * 0.12 * (100 - active)) / 3600,
      8,
    );
    expect(a.energy.at(-1)?.total).toBeCloseTo(metrics(a).energy, 8);
  });
  it("订单校验及事件唯一性", () => {
    const s = initialState();
    expect(() =>
      addOrder(s, {
        product: "",
        quantity: 0,
        priority: 1,
        planned: 0,
        due: 0,
      }),
    ).toThrow();
    s.running = true;
    tick(s, 100);
    expect(new Set(s.events.map((e) => e.id)).size).toBe(s.events.length);
    expect(s.events.every((e) => e.time >= 0)).toBe(true);
  });
  it("两个加工中心都故障时停止加工且不产生排产", () => {
    const s = initialState();
    s.running = true;
    inject(s, "CNC-01", "设备故障");
    inject(s, "CNC-02", "设备故障");
    tick(s, 100);
    expect(schedule(s)).toEqual([]);
    expect(metrics(s).output).toBe(0);
  });
});
