import { test, expect } from "@playwright/test";
test("quality cause, controlled rework and first pass yield remain traceable", async ({
  page,
}) => {
  await page.goto("/#quality");
  await page.getByLabel("质量实验场景").selectOption("burr");
  await page
    .getByRole("button", { name: "应用后续投料参数", exact: true })
    .click();
  expect(
    await page.evaluate(async () => {
      const { useFactory } = await import("/src/store/useFactory.ts");
      return useFactory.getState().s.flow.parameters.skipDeburr;
    }),
  ).toBe(true);
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = e.initialState();
    s.orders = [{ ...s.orders[0], quantity: 1 }];
    s.flow.demoVariations = false;
    s.flow.parameters.skipDeburr = true;
    s.flow.qualityHold = true;
    s.running = true;
    e.tick(s, 50);
    s.running = false;
    e.assign(s);
    useFactory.setState({ s });
  });
  await page
    .getByRole("button", { name: "查看产品", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("工艺因果追溯")).toContainText("跳过去毛刺");
  await expect(page.getByLabel("工艺因果追溯")).toContainText("0.12");
  await page.screenshot({
    path: "deliverables/screenshots/v1.2-quality-cause.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "关闭对话框", exact: true }).click();
  await page.getByRole("button", { name: "去毛刺返工", exact: true }).click();
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    useFactory.getState().update((s) => {
      s.running = true;
      e.tick(s, 100);
      s.running = false;
      e.assign(s);
    });
  });
  await expect(page.getByText("返工复测", { exact: true })).toBeVisible();
  const r = await page.evaluate(async () => {
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = useFactory.getState().s;
    return {
      pieces: s.workpieces.length,
      stored: s.orders[0].completed,
      results: s.inspections.map((q) => q.result),
    };
  });
  expect(r).toEqual({ pieces: 1, stored: 1, results: ["pass", "fail"] });
  await page
    .getByRole("button", { name: "查看产品", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("工艺因果追溯")).toContainText("跳过去毛刺");
});
