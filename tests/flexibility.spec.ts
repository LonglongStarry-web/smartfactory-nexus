import { test, expect } from "@playwright/test";
test("create a second recipe, observe setup and inspect the rectangular workpiece", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#scheduling");
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = e.initialState();
    s.orders = [];
    s.flow.demoVariations = false;
    useFactory.setState({ s });
  });
  await page.getByRole("button", { name: "新增订单", exact: true }).click();
  await page.getByLabel("订单工艺配方").selectOption("plate");
  await page.locator('input[name="product"]').fill("安装支架板 B-210");
  await page.locator('input[name="quantity"]').fill("2");
  await page
    .getByRole("button", { name: "保存订单并排产", exact: true })
    .click();
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    useFactory.getState().update((s) => {
      s.running = true;
      e.tick(s, 5);
      s.running = false;
      e.assign(s);
    });
  });
  await expect(page.getByText("换型剩余 1.0 秒").first()).toBeVisible();
  await page.screenshot({
    path: "deliverables/screenshots/v1.3-setup.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    useFactory.getState().update((s) => {
      s.running = true;
      e.tick(s, 21);
      s.running = false;
      e.assign(s);
    });
    useFactory.getState().observe("CNC-01");
  });
  await expect(page.getByTestId("observed-stage")).toContainText(
    "矩形外轮廓加工",
  );
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "deliverables/screenshots/v1.3-plate.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("rerouting is visible and warehouse shipment preserves historical completion", async ({
  page,
}) => {
  await page.goto("/#twin");
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    const s = e.initialState();
    s.orders = [{ ...s.orders[0], quantity: 12 }];
    s.flow.demoVariations = false;
    s.running = true;
    e.tick(s, 4);
    e.inject(s, "CNC-01", "设备故障");
    e.tick(s, 47);
    s.running = false;
    e.assign(s);
    useFactory.setState({ s, selected: "AGV-01" });
  });
  await expect(page.getByText(/物流动作：替代路线转运/)).toBeVisible();
  await page.screenshot({
    path: "deliverables/screenshots/v1.3-reroute.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const e = await import("/src/simulation/engine.ts");
    const { useFactory } = await import("/src/store/useFactory.ts");
    useFactory.getState().update((s) => {
      e.restore(s, "CNC-01");
      s.running = true;
      e.tick(s, 1500);
      s.running = false;
      e.assign(s);
    });
    useFactory.getState().select("ASRS-01");
  });
  await expect(page.getByText("成品库存 12 / 480 件")).toBeVisible();
  await page.getByRole("button", { name: "发运现有库存", exact: true }).click();
  await expect(page.getByText("成品库存 0 / 480 件")).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const { useFactory } = await import("/src/store/useFactory.ts");
      return useFactory.getState().s.orders[0].completed;
    }),
  ).toBe(12);
});
