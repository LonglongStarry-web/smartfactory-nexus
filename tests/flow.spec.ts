import { expect, test } from "@playwright/test";

test("完整默认批次可以写入本地存档，刷新后订单、质量和工序轨迹完整恢复", async ({
  page,
}) => {
  await page.goto("/#reports");
  const saved = await page.evaluate(async () => {
    const engine = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = engine.initialState();
    s.running = true;
    engine.tick(s, 12000);
    s.running = false;
    engine.assign(s);
    useFactory.setState({ s });
    return {
      pieces: s.workpieces.length,
      completed: s.orders.reduce((sum, o) => sum + o.completed, 0),
      bytes: (localStorage.getItem("nexus-simulation-v1")?.length ?? 0) * 2,
    };
  });
  expect(saved.completed).toBe(370);
  expect(saved.bytes).toBeGreaterThan(0);
  expect(saved.bytes).toBeLessThan(5 * 1024 * 1024);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "数据分析与报告", exact: true }),
  ).toBeVisible();
  const restored = await page.evaluate(async () => {
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = useFactory.getState().s;
    return {
      pieces: s.workpieces.length,
      completed: s.orders.reduce((sum, o) => sum + o.completed, 0),
      completeTraces: Object.values(s.flow.runs).filter(
        (run) => run.trace.length === 19,
      ).length,
      running: s.running,
    };
  });
  expect(restored).toEqual({
    pieces: saved.pieces,
    completed: 370,
    completeTraces: saved.pieces,
    running: false,
  });
});

test("设备详情显示真实工序与工件，刷新保留流转且默认暂停", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#twin");
  const id = await page.evaluate(async () => {
    const engine = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = engine.initialState();
    s.flow.demoVariations = false;
    s.orders = [{ ...s.orders[0], quantity: 1 }];
    s.running = true;
    engine.tick(s, 20);
    s.running = false;
    engine.assign(s);
    useFactory.setState({ s, selected: "CNC-01" });
    return s.flow.cells[0].activeId;
  });
  await expect(page.getByTestId("process-detail")).toContainText(id!);
  await expect(page.getByTestId("process-stage")).toContainText("轮廓加工");
  await expect(page.getByText("工件位置：机床夹具")).toBeVisible();
  const stage = await page.getByTestId("process-stage").textContent();
  await page.reload();
  await expect(page.getByTestId("process-stage")).toHaveText(stage!);
  await expect(
    page.getByRole("button", { name: "开始生产", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "deliverables/screenshots/v1.2-flow-device.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect
    .poll(() =>
      page
        .locator("aside.sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  await expect(page.getByTestId("process-detail")).toContainText(id!);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "deliverables/screenshots/v1.2-flow-device-mobile.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const engine = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    useFactory.getState().update((s) => {
      s.running = true;
      engine.tick(s, 30);
      s.running = false;
      engine.assign(s);
    });
  });
  await page.getByLabel("选择设备").selectOption("AGV-01");
  await expect(page.getByTestId("process-stage")).toContainText("合格入库转运");
  await expect(page.getByTestId("process-detail")).toContainText(id!);
  expect(errors).toEqual([]);
});

test("超差判定有测量依据，复检不生成工件或增加生产良品率", async ({ page }) => {
  await page.goto("/#quality");
  const before = await page.evaluate(async () => {
    const engine = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = engine.initialState();
    s.orders = [{ ...s.orders[0], quantity: 1 }];
    s.flow.demoVariations = false;
    s.flow.parameters.fixtureOffsetXmm = 0.08;
    s.running = true;
    engine.tick(s, 1);
    s.flow.parameters.fixtureOffsetXmm = 0;
    engine.tick(s, 105 + s.flow.transferDuration * 2);
    s.running = false;
    engine.assign(s);
    useFactory.setState({ s });
    const m = engine.metrics(s);
    return {
      pieces: s.workpieces.length,
      total: m.total,
      good: m.good,
      completed: s.orders[0].completed,
    };
  });
  expect(before).toEqual({ pieces: 2, total: 2, good: 1, completed: 1 });
  await page
    .locator("tbody tr")
    .filter({ hasText: "孔位超差" })
    .getByRole("button", { name: "查看产品" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("20.08");
  await expect(page.getByRole("dialog")).toContainText("19.95–20.05");
  await expect(page.getByRole("dialog")).toContainText("钻孔");
  await page.screenshot({
    path: "deliverables/screenshots/v1.2-flow-inspection.png",
    fullPage: true,
  });
  await page.getByLabel("关闭对话框").click();
  await page.getByRole("button", { name: "复检最近工件" }).click();
  await expect(page.getByText("抽检复核", { exact: true })).toBeVisible();
  const after = await page.evaluate(async () => {
    const engine = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = useFactory.getState().s;
    const m = engine.metrics(s);
    return {
      pieces: s.workpieces.length,
      total: m.total,
      good: m.good,
      completed: s.orders[0].completed,
    };
  });
  expect(after).toEqual(before);
});
