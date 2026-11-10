import { describe, it, expect } from "vitest";
import {
  initialState,
  schedule,
  tick,
  inject,
  addOrder,
} from "../src/simulation/engine";
import { cycleSeconds } from "../src/simulation/flow";
import type { Mode } from "../src/domain/types";

describe("排产时间回归", () => {
  it.each<Mode>(["standard", "performance", "eco"])(
    "%s模式下没有资源阻塞时预计完工不会在工序或周期内循环",
    (mode) => {
      const s = initialState();
      s.mode = mode;
      s.flow.demoVariations = false;
      s.orders = [{ ...s.orders[0], quantity: 3 }];
      inject(s, "CNC-02", "设备故障");
      s.running = true;
      const baseline = schedule(s)[0].end;
      for (let i = 0; i < 150; i++) {
        tick(s, 1);
        for (const slot of schedule(s))
          expect(slot.end).toBeCloseTo(baseline, 5);
      }
    },
  );
  it.each<Mode>(["standard", "performance", "eco"])(
    "%s模式的双单元预计时间包含共享检测和入库占用",
    (mode) => {
      const s = initialState();
      s.mode = mode;
      s.flow.demoVariations = false;
      s.orders = [{ ...s.orders[0], quantity: 4 }];
      s.running = true;
      const baseline = schedule(s);
      const expected = Math.max(...baseline.map((slot) => slot.end));
      for (let i = 0; i < 250; i++) {
        tick(s, 1);
        for (const slot of schedule(s)) {
          const original = baseline.find(
            (old) => old.deviceId === slot.deviceId,
          )!;
          expect(slot.end).toBeCloseTo(original.end, 5);
        }
      }
      expect(s.orders[0].completedAt).toBeCloseTo(expected, 5);
    },
  );
  it("未来计划开始前不消耗工序，完整加工与转运后固定实际完工时间", () => {
    const s = initialState();
    s.flow.demoVariations = false;
    s.orders = [
      { ...s.orders[0], id: "FUTURE", quantity: 1, planned: 5, due: 500 },
    ];
    inject(s, "CNC-02", "设备故障");
    s.running = true;
    tick(s, 5);
    expect(s.orders[0].completed).toBe(0);
    expect(Object.values(s.flow.runs)[0].trace).toHaveLength(0);
    const expected = 5 + cycleSeconds + s.flow.transferDuration;
    expect(schedule(s)[0].end).toBe(expected);
    tick(s, cycleSeconds);
    expect(s.orders[0].completed).toBe(0);
    tick(s, s.flow.transferDuration);
    expect(s.orders[0].completedAt).toBe(expected);
    tick(s, 20);
    expect(s.orders[0].completedAt).toBe(expected);
  });
  it("插单保留已投料工件，进度不转移到急件，后续队列遵循优先级", () => {
    const s = initialState();
    s.flow.demoVariations = false;
    inject(s, "CNC-02", "设备故障");
    s.running = true;
    tick(s, 9);
    const cell = s.flow.cells[0];
    const original = cell.activeId!;
    const progress = s.flow.runs[original].stepElapsed;
    const urgent = addOrder(s, {
      product: "新紧急件",
      quantity: 1,
      priority: 0,
      planned: 9,
      due: 500,
    });
    expect(cell.activeId).toBe(original);
    expect(s.flow.runs[original].stepElapsed).toBe(progress);
    expect(
      schedule(s).find((slot) => slot.orderId === urgent)!.start,
    ).toBeGreaterThan(9);
    tick(s, 1);
    expect(s.orders.find((o) => o.id === urgent)!.completed).toBe(0);
    tick(s, 200);
    expect(s.orders.find((o) => o.id === urgent)!.completed).toBe(1);
    expect(s.flow.runs[original].orderId).not.toBe(urgent);
  });
});
