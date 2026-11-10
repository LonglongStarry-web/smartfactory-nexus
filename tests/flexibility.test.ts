import { describe, it, expect } from "vitest";
import {
  initialState,
  tick,
  assign,
  inject,
  restore,
  schedule,
} from "../src/simulation/engine";
import { recipeSeconds } from "../src/simulation/process";
import {
  restoreFactoryState,
  serializeFactoryState,
} from "../src/simulation/persistence";
import { dispatchInventory } from "../src/simulation/flow";
import { transportPose } from "../src/features/digital-twin/logistics";
function factory(family: "flange" | "plate" = "plate", quantity = 1) {
  const s = initialState();
  s.orders = [{ ...s.orders[0], quantity, recipeId: family }];
  s.flow.demoVariations = false;
  s.running = true;
  return s;
}
describe("flexible manufacturing", () => {
  it("a plate recipe changes fixtures before starting and has a distinct cycle and measurements", () => {
    const s = factory();
    assign(s);
    expect(s.flow.cells[0].setup?.remaining).toBe(6);
    tick(s, 5);
    expect(s.flow.runs[s.flow.cells[0].activeId!].trace).toHaveLength(0);
    tick(s, 1);
    expect(s.flow.cells[0].currentFamily).toBe("plate");
    tick(s, recipeSeconds("plate") + s.flow.transferDuration);
    expect(s.orders[0].completed).toBe(1);
    expect(s.orders[0].completedAt).toBe(
      6 + recipeSeconds("plate") + s.flow.transferDuration,
    );
    expect(
      s.inspections[0].measurements?.find(
        (m) => m.featureId === "outer-diameter",
      )?.nominal,
    ).toBe(100);
  });
  it("incompatible cells never receive jobs or forecasts", () => {
    const s = factory("plate", 3);
    s.flow.cells[0].capabilities = ["flange"];
    s.flow.cells[1].capabilities = ["plate"];
    assign(s);
    expect(s.flow.cells[0].activeId).toBeNull();
    expect(schedule(s).every((x) => x.deviceId === "CNC-02")).toBe(true);
    tick(s, 500);
    expect(s.orders[0].completed).toBe(3);
    expect(
      Object.values(s.flow.runs).every((r) => r.devices.cnc === "CNC-02"),
    ).toBe(true);
  });
  it("fault rerouting moves only unstarted blanks and retains an active held part", () => {
    const s = factory("flange", 12);
    tick(s, 4);
    const active = s.flow.cells[0].activeId!,
      before = structuredClone(s.flow.runs[active]);
    const queued = [...s.flow.cells[0].queue];
    inject(s, "CNC-01", "设备故障");
    tick(s, 80);
    const id = queued.find((id) => s.flow.runs[id].moves?.length)!;
    expect(id).toBeTruthy();
    expect(s.flow.runs[id].devices.cnc).toBe("CNC-02");
    expect(s.flow.runs[id].moves).toHaveLength(1);
    expect(s.flow.runs[active].devices).toEqual(before.devices);
    expect(s.flow.runs[active].stepElapsed).toBe(before.stepElapsed);
    const restored = restoreFactoryState(serializeFactoryState(s));
    expect(restored.workpieces).toHaveLength(s.workpieces.length);
    restore(s, "CNC-01");
    tick(s, 1500);
    expect(s.orders[0].completed).toBe(12);
  });
  it("logistics keeps cargo at its source until pickup and on the deck during transit", () => {
    const s = factory("flange");
    tick(s, 49);
    const t = s.flow.transfer!;
    expect(t).toBeTruthy();
    t.elapsed = 0;
    const a = transportPose(s)!;
    expect(a.phase).toBe("前往取货");
    t.elapsed = s.flow.transferDuration * 0.45;
    const b = transportPose(s)!;
    expect(b.loaded).toBe(true);
    expect(b.part[0]).toBe(b.vehicle[0]);
    expect(b.part[2]).toBe(b.vehicle[2]);
    expect(b.part[1] - (0.68 + b.lift + 0.03 + 0.06)).toBeCloseTo(0);
  });
  it("warehouse saturation backpressures inflow until an explicit shipment frees capacity", () => {
    const s = factory("flange", 3);
    s.flow.warehouseCapacity = 1;
    tick(s, 300);
    expect(s.orders[0].completed).toBe(1);
    expect(schedule(s)).toEqual([]);
    dispatchInventory(s);
    tick(s, 100);
    expect(s.orders[0].completed).toBe(2);
    expect(
      s.workpieces.filter((w) => w.dispatchedAt !== undefined),
    ).toHaveLength(1);
  });
  it("refresh in the middle of a reroute preserves the moving blank and reservations", () => {
    const s = factory("flange", 12);
    tick(s, 4);
    inject(s, "CNC-01", "设备故障");
    tick(s, 47);
    expect(s.flow.reroute).toBeTruthy();
    const saved = structuredClone(s.flow.reroute),
      r = restoreFactoryState(serializeFactoryState(s));
    expect(r.flow.reroute).toEqual(saved);
    expect(r.running).toBe(false);
    r.running = true;
    tick(r, 10);
    expect(r.flow.runs[saved!.workpieceId].moves?.[0].to).toBe("CELL-02");
  });
});
