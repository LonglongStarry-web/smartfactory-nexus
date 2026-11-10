import { describe, expect, it } from "vitest";
import { plateRecipe, createProcessRun } from "../src/simulation/process";
import { motionPose, solveArm } from "../src/features/digital-twin/motion";
import { cellAnchors, armLengths } from "../src/domain/layout";
const distance = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]));
describe("mechanical paths", () => {
  it("both cells can reach all commanded positions with fixed link lengths", () => {
    const run = createProcessRun({ workpieceId: "P", orderId: "O" });
    run.status = "running";
    for (const recipe of [undefined, plateRecipe])
      for (const attempt of [0, 1]) {
        run.recipe =
          recipe ?? createProcessRun({ workpieceId: "P", orderId: "O" }).recipe;
        run.attempt = attempt;
        for (const line of ["A", "B"])
          for (let step = 0; step < run.recipe.steps.length; step++) {
            run.stepIndex = step;
            for (let n = 0; n <= 20; n++) {
              const p = motionPose(run, line, n / 20),
                ik = solveArm(cellAnchors(line).base, p.tcp);
              expect(ik.reachable, `${line}/${p.stage}/${n}`).toBe(true);
              expect(distance(ik.shoulder, ik.elbow)).toBeCloseTo(
                armLengths.upper,
                7,
              );
              expect(distance(ik.elbow, ik.wrist)).toBeCloseTo(
                armLengths.lower,
                7,
              );
            }
          }
      }
  });
  it("stage handoffs preserve position and clamped parts stay in the fixture", () => {
    const run = createProcessRun({ workpieceId: "P", orderId: "O" });
    run.status = "running";
    for (const recipe of [undefined, plateRecipe])
      for (const attempt of [0, 1]) {
        run.recipe =
          recipe ?? createProcessRun({ workpieceId: "P", orderId: "O" }).recipe;
        run.attempt = attempt;
        for (const line of ["A", "B"])
          for (let i = 0; i < run.recipe.steps.length - 1; i++) {
            run.stepIndex = i;
            const end = motionPose(run, line, 1);
            run.stepIndex = i + 1;
            const start = motionPose(run, line, 0);
            expect(distance(end.tcp, start.tcp), `tcp ${i}`).toBeLessThan(
              0.001,
            );
            expect(distance(end.part, start.part), `part ${i}`).toBeLessThan(
              0.001,
            );
            expect(distance(end.tool, start.tool), `tool ${i}`).toBeLessThan(
              0.001,
            );
          }
      }
  });
  it("carried parts coincide with the TCP and closed jaws contact their sides", () => {
    const run = createProcessRun({ workpieceId: "P", orderId: "O" });
    run.status = "running";
    for (const id of [
      "open-load-door",
      "load",
      "unclamp",
      "unload",
      "close-unload-door",
      "place-inspection",
    ]) {
      run.stepIndex = run.recipe.steps.findIndex((s) => s.id === id);
      for (const p of [0, 0.2, 0.5, 0.8, 1]) {
        const pose = motionPose(run, "A", p);
        expect(distance(pose.part, pose.tcp)).toBeLessThan(0.001);
        expect(pose.grip - 0.035).toBeCloseTo(pose.radius);
        if (id === "load" || id === "unload") expect(pose.door).toBe(1);
      }
    }
  });
});
