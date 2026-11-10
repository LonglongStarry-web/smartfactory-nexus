import { describe, it, expect } from "vitest";
import { initialState, tick, assign, metrics } from "../src/simulation/engine";
import { disposeRejected } from "../src/simulation/flow";
import {
  restoreFactoryState,
  serializeFactoryState,
} from "../src/simulation/persistence";
function lab(parameters: Record<string, number | boolean>) {
  const s = initialState();
  s.orders = [{ ...s.orders[0], quantity: 1 }];
  s.flow.demoVariations = false;
  s.flow.qualityHold = true;
  Object.assign(s.flow.parameters, parameters);
  s.running = true;
  tick(s, 50);
  return s;
}
describe("causal quality experiments", () => {
  for (const [parameters, feature] of [
    [{ fixtureOffsetXmm: 0.08 }, "hole-x"],
    [{ contourDiameterErrorMm: 0.2 }, "outer-diameter"],
    [{ skipDeburr: true }, "burr-height"],
  ] as const)
    it(`isolates ${feature} from the saved input`, () => {
      const s = lab(parameters),
        q = s.inspections[0];
      expect(q.result).toBe("fail");
      expect(
        q
          .measurements!.filter((m) => m.actual < m.lower || m.actual > m.upper)
          .map((m) => m.featureId),
      ).toEqual([feature]);
      expect(s.workpieces).toHaveLength(1);
      expect(s.flow.cells[0].reject).toContain(q.workpieceId);
      expect(s.orders[0].completed).toBe(0);
    });
  it("rework transports the same part back, retains first inspection and counts only one machined product", () => {
    const s = lab({ skipDeburr: true }),
      id = s.workpieces[0].id;
    disposeRejected(s, id, "rework");
    expect(s.flow.transfer?.reworkRun?.workpieceId).toBe(id);
    tick(s, 90);
    expect(s.workpieces).toHaveLength(1);
    expect(s.orders[0].completed).toBe(1);
    expect(metrics(s).output).toBe(1);
    expect(metrics(s).total).toBe(1);
    expect(metrics(s).good).toBe(0);
    expect(s.inspections.map((q) => q.source)).toEqual([
      "rework",
      "production",
    ]);
    expect(s.inspections[0].result).toBe("pass");
    expect(s.inspections[1].result).toBe("fail");
    expect(s.flow.reworkArchive?.[id]).toHaveLength(1);
    expect(
      restoreFactoryState(serializeFactoryState(s)).flow.reworkArchive?.[id][0]
        .inspection?.result,
    ).toBe("fail");
  });
  it("damaged hole cannot be reworked and scrap permits a replacement with corrected parameters", () => {
    const s = lab({ fixtureOffsetXmm: 0.08 }),
      id = s.workpieces[0].id;
    expect(() => disposeRejected(s, id, "rework")).toThrow("仅残余毛刺");
    s.flow.parameters.fixtureOffsetXmm = 0;
    disposeRejected(s, id, "scrap");
    assign(s);
    tick(s, 100);
    expect(s.workpieces).toHaveLength(2);
    expect(s.orders[0].completed).toBe(1);
    expect(s.workpieces[0].scrappedAt).toBeDefined();
  });
});
