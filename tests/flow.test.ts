import { describe, expect, it } from "vitest";
import {
  initialState,
  tick,
  metrics,
  inject,
  restore,
  inspect,
  schedule,
  addOrder,
  assign,
} from "../src/simulation/engine";
import { cycleSeconds } from "../src/simulation/flow";
import {
  restoreFactoryState,
  serializeFactoryState,
} from "../src/simulation/persistence";

function factory(quantity = 6) {
  const s = initialState();
  s.flow.demoVariations = false;
  s.orders = [
    {
      id: "TEST-ORDER",
      product: "法兰件",
      quantity,
      completed: 0,
      priority: 1,
      created: 0,
      planned: 0,
      due: 5000,
      cancelled: false,
    },
  ];
  s.running = true;
  return s;
}

describe("工序与制造引擎接入", () => {
  it("完整默认批次的存档在本地配额内，恢复后保留全部配方、参数、轨迹与质量记录", () => {
    const s = initialState();
    s.running = true;
    tick(s, 12000);
    expect(s.orders.every((o) => o.completed === o.quantity)).toBe(true);
    const packed = JSON.stringify(serializeFactoryState(s));
    expect(packed.length * 2).toBeLessThan(5 * 1024 * 1024);
    expect(packed.length).toBeLessThan(JSON.stringify(s).length * 0.8);
    const restored = restoreFactoryState(JSON.parse(packed));
    expect(restored.flow.runs).toEqual(s.flow.runs);
    expect(restored.workpieces).toEqual(s.workpieces);
    expect(restored.inspections).toEqual(s.inspections);
    const runs = Object.values(restored.flow.runs);
    const originalSecond = runs[1].recipe.steps[0].duration;
    runs[0].recipe.steps[0].duration = 999;
    expect(runs[1].recipe.steps[0].duration).toBe(originalSecond);
  });
  it("半途停机的 AGV 持有共享仓储资源时，其他单元也不能得到确定入库预测", () => {
    const s = factory(8);
    tick(s, 50);
    expect(s.flow.transfer?.cellId).toBe("CELL-01");
    inject(s, "AGV-01", "设备故障");
    expect(schedule(s)).toEqual([]);
    tick(s, 100);
    expect(s.orders[0].completed).toBe(0);
    restore(s, "AGV-01");
    tick(s, 700);
    expect(s.orders[0].completed).toBe(8);
  });
  it("投料数量有界且每个编号唯一，加工、检测和合格入库分开计数", () => {
    const s = factory(1);
    tick(s, 33);
    expect(s.workpieces).toHaveLength(1);
    expect(metrics(s).output).toBe(1);
    expect(metrics(s).good).toBe(0);
    expect(s.orders[0].completed).toBe(0);
    tick(s, 14);
    expect(metrics(s).good).toBe(1);
    expect(metrics(s).stored).toBe(0);
    expect(s.orders[0].completed).toBe(0);
    tick(s, 5);
    expect(s.orders[0].completed).toBe(1);
    expect(s.orders[0].completedAt).toBe(cycleSeconds + 3);
    const count = s.workpieces.length;
    tick(s, 1000);
    expect(s.workpieces).toHaveLength(count);
    expect(s.orders[0].completed).toBe(1);
  });

  it("两个单元共享 QC，检测轨迹无重叠；资源同一时刻只能属于一个工件", () => {
    const s = factory(8);
    for (let i = 0; i < 500; i++) {
      tick(s, 1);
      for (const c of s.flow.cells) {
        expect(c.queue.length).toBeLessThanOrEqual(s.flow.inputCapacity);
        expect(c.good.length).toBeLessThanOrEqual(s.flow.outputCapacity);
        expect(c.reject.length).toBeLessThanOrEqual(s.flow.outputCapacity);
      }
      const heldQc = Object.values(s.flow.runs).filter(
        (r) => r.holder === "inspection" && r.status !== "complete",
      );
      expect(heldQc.length).toBeLessThanOrEqual(1);
    }
    const scans = Object.values(s.flow.runs)
      .flatMap((r) => r.trace.filter((t) => t.stepId === "inspect"))
      .sort((a, b) => a.startedAt - b.startedAt);
    expect(scans.length).toBe(8);
    scans
      .slice(1)
      .forEach((scan, i) =>
        expect(scan.startedAt).toBeGreaterThanOrEqual(scans[i].completedAt),
      );
    expect(s.orders[0].completed).toBe(8);
  });

  it("物流停机后缓冲区满会反压，恢复后继续入库，工件没有复制或丢失", () => {
    const s = factory(15);
    inject(s, "ASRS-01", "设备故障");
    tick(s, 600);
    expect(s.orders[0].completed).toBe(0);
    expect(schedule(s)).toEqual([]);
    expect(s.flow.cells.some((c) => c.waitingReason.includes("缓冲"))).toBe(
      true,
    );
    const stopped = metrics(s).output;
    tick(s, 200);
    expect(metrics(s).output).toBe(stopped);
    restore(s, "ASRS-01");
    tick(s, 1000);
    expect(s.orders[0].completed).toBe(15);
    expect(s.workpieces).toHaveLength(15);
    expect(new Set(s.workpieces.map((w) => w.id)).size).toBe(15);
  });

  it("异常参数在投料时快照，超差件隔离补投，抽检复用同一工件且不增加良品率", () => {
    const s = factory(2);
    s.flow.parameters.fixtureOffsetXmm = 0.08;
    tick(s, 1);
    const firstIds = s.workpieces.map((w) => w.id);
    s.flow.parameters.fixtureOffsetXmm = 0;
    tick(s, 60);
    expect(
      s.inspections
        .filter((q) => q.source === "production")
        .every((q) => q.result === "fail"),
    ).toBe(true);
    expect(s.orders[0].completed).toBe(0);
    expect(
      firstIds.every(
        (id) => s.flow.runs[id].parameters.fixtureOffsetXmm === 0.08,
      ),
    ).toBe(true);
    tick(s, 300);
    expect(s.orders[0].completed).toBe(2);
    expect(s.workpieces.some((w) => w.scrappedAt !== undefined)).toBe(true);
    const before = metrics(s);
    const count = s.workpieces.length;
    const part = s.workpieces.find((w) => w.result === "pass")!;
    inspect(s, part.orderId, part.deviceId);
    inspect(s, part.orderId, part.deviceId);
    expect(s.workpieces).toHaveLength(count);
    expect(metrics(s)).toEqual(before);
    expect(s.inspections.filter((q) => q.source === "sample")).toHaveLength(2);
  });

  it("故障不丢失在制工件或将其进度挪给紧急订单", () => {
    const s = factory(5);
    tick(s, 12);
    const cell = s.flow.cells[0];
    const id = cell.activeId!;
    const elapsed = s.flow.runs[id].stepElapsed;
    inject(s, cell.cncId, "温度异常");
    addOrder(s, {
      product: "急件",
      quantity: 1,
      priority: 0,
      planned: s.time,
      due: 1000,
    });
    tick(s, 20);
    expect(cell.activeId).toBe(id);
    expect(s.flow.runs[id].stepElapsed).toBe(elapsed);
    expect(s.flow.runs[id].orderId).toBe("TEST-ORDER");
    restore(s, cell.cncId);
    tick(s, 600);
    expect(s.workpieces.find((w) => w.id === id)?.storedAt).toBeDefined();
    expect(s.orders.every((o) => o.completed === o.quantity)).toBe(true);
  });

  it("大小时间步一致推进工序、质量、库存和能耗采样，不重复写同一采样时刻", () => {
    const a = factory(8),
      b = factory(8);
    a.mode = b.mode = "performance";
    tick(a, 300);
    for (let n = 0; n < 300; n++) tick(b, 1);
    expect(a.orders[0].completed).toBe(b.orders[0].completed);
    expect(a.orders[0].completedAt).toBeCloseTo(b.orders[0].completedAt!, 8);
    expect(a.workpieces.map((w) => [w.id, w.result])).toEqual(
      b.workpieces.map((w) => [w.id, w.result]),
    );
    expect(metrics(a).stored).toBe(metrics(b).stored);
    expect(metrics(a).energy).toBeCloseTo(metrics(b).energy, 8);
    expect(new Set(a.energy.map((e) => e.time)).size).toBe(a.energy.length);
    expect(a.energy).toHaveLength(30);
  });

  it("刷新恢复暂停并保留半途转运、工件和偏好之外的业务记录", () => {
    const s = factory(1);
    tick(s, 50);
    expect(s.flow.transfer).not.toBeNull();
    const restored = restoreFactoryState(JSON.parse(JSON.stringify(s)));
    expect(restored.running).toBe(false);
    expect(restored.flow.transfer).toEqual(s.flow.transfer);
    expect(restored.workpieces).toEqual(s.workpieces);
    restored.running = true;
    tick(restored, 2);
    expect(restored.orders[0].completed).toBe(1);
    expect(restored.workpieces).toHaveLength(1);
  });

  it("旧存档保留旧完成数和记录，不伪造加工轨迹与入库证据", () => {
    const old = factory(10);
    old.version = 1;
    old.orders[0].completed = 4;
    old.time = 123;
    old.carry = { "CNC-01": 0.6 };
    delete (old as Partial<typeof old>).flow;
    const restored = restoreFactoryState(old);
    expect(restored.version).toBe(2);
    expect(restored.time).toBe(123);
    expect(restored.orders[0].completed).toBe(4);
    expect(restored.orders[0].completionBasis).toBe("legacy-machined");
    expect(restored.orders[0].legacyCompleted).toBe(4);
    expect(restored.legacyCarry).toEqual({ "CNC-01": 0.6 });
    expect(Object.keys(restored.flow.runs)).toHaveLength(0);
    expect(metrics(restored).stored).toBe(0);
  });

  it("取消订单撤销待加工队列，正在夹持的工件完成处置且不计订单履约", () => {
    const s = factory(8);
    tick(s, 10);
    const queued = s.flow.cells.flatMap((c) => c.queue);
    s.orders[0].cancelled = true;
    assign(s);
    expect(s.flow.cells.every((c) => c.queue.length === 0)).toBe(true);
    expect(queued.every((id) => s.flow.runs[id].status === "cancelled")).toBe(
      true,
    );
    tick(s, 100);
    expect(s.orders[0].completed).toBe(0);
    expect(s.orders[0].completedAt).toBeUndefined();
    expect(() => restoreFactoryState(s)).not.toThrow();
  });
});
