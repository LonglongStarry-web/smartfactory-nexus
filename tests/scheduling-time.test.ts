import { describe, it, expect } from "vitest";
import {
  initialState,
  schedule,
  tick,
  inject,
  addOrder,
} from "../src/simulation/engine";
import type { Mode } from "../src/domain/types";
describe("排产时间回归", () => {
  it.each<Mode>(["standard", "performance", "eco"])(
    "%s模式下每秒重算不会让预计完工在节拍内循环",
    (mode) => {
      const s = initialState();
      s.mode = mode;
      s.running = true;
      const baseline = schedule(s);
      for (let i = 0; i < 45; i++) {
        tick(s, 1);
        for (const slot of schedule(s)) {
          expect(slot.end).toBeCloseTo(
            baseline.find((x) => x.orderId === slot.orderId)!.end,
            5,
          );
        }
      }
    },
  );
  it("未来计划开始前不消耗加工时间，并记录固定实际完工时间", () => {
    const s = initialState();
    s.orders = [
      {
        id: "FUTURE",
        product: "延后开工件",
        quantity: 1,
        completed: 0,
        priority: 0,
        planned: 5,
        due: 100,
        created: 0,
        cancelled: false,
      },
    ];
    inject(s, "CNC-02", "设备故障");
    s.running = true;
    tick(s, 5);
    expect(s.orders[0].completed).toBe(0);
    expect(s.carry["CNC-01"] || 0).toBe(0);
    expect(schedule(s)[0].end).toBe(15);
    tick(s, 10);
    expect(s.orders[0].completedAt).toBe(15);
    tick(s, 20);
    expect(s.orders[0].completedAt).toBe(15);
  });
  it("插单抢占时旧工件的进度不会转移到新订单", () => {
    const s = initialState();
    inject(s, "CNC-02", "设备故障");
    s.running = true;
    tick(s, 9);
    const urgent = addOrder(s, {
      product: "新紧急件",
      quantity: 1,
      priority: 0,
      planned: 9,
      due: 100,
    });
    expect(schedule(s)[0].orderId).toBe(urgent);
    expect(schedule(s)[0].end).toBe(19);
    tick(s, 1);
    expect(s.orders.find((o) => o.id === urgent)!.completed).toBe(0);
    tick(s, 9);
    expect(s.orders.find((o) => o.id === urgent)!.completedAt).toBe(19);
  });
});
