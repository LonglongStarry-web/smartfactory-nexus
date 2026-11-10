import { test, expect } from "@playwright/test";
test("mechanical scene has real contact and freezes while paused", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#twin");
  const id = await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = e.initialState();
    s.orders = [{ ...s.orders[0], quantity: 1 }];
    s.flow.demoVariations = false;
    s.running = true;
    e.tick(s, 4.5);
    s.running = false;
    e.assign(s);
    useFactory.setState({ s });
    return s.flow.cells[0].activeId;
  });
  await expect
    .poll(async () => page.locator(".twin-root").getAttribute("data-scene"))
    .toBeTruthy();
  const cell = () =>
    page
      .locator(".twin-root")
      .evaluate(
        (el) => JSON.parse((el as HTMLElement).dataset.scene!).cells[0],
      );
  await expect
    .poll(async () => (await cell()).contactError)
    .toBeLessThan(0.001);
  const before = await cell();
  expect(before.workpiece).toBe(id);
  expect(before.stage).toBe("load");
  await page.waitForTimeout(350);
  expect((await cell()).part).toEqual(before.part);
  await page.screenshot({
    path: "deliverables/screenshots/v1.2-motion.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
