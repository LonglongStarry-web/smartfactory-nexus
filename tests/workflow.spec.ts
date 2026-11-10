import { test, expect } from "@playwright/test";
test("生产、紧急插单、故障、维修、恢复、报告与重置闭环", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "智能制造驾驶舱", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始生产", exact: true }).click();
  await page.getByLabel("模拟倍速").selectOption("20");
  await page.waitForTimeout(2200);
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "生产调度", exact: true }).click();
  await page.getByRole("button", { name: "新增订单", exact: true }).click();
  await page.getByLabel("产品名称").fill("课堂紧急法兰");
  await page.getByLabel("数量 / 件").fill("12");
  await page.getByRole("button", { name: "保存订单并排产" }).click();
  await expect(page.getByText("课堂紧急法兰")).toBeVisible();
  await page.getByLabel("调度规则").selectOption("FCFS");
  await page.getByLabel("调度规则").selectOption("PRIORITY");
  const firstPriority = page.locator("tbody tr").last().locator("select");
  await firstPriority.selectOption("1");
  await firstPriority.selectOption("0");
  await page.getByRole("button", { name: "设备健康", exact: true }).click();
  await page.getByRole("button", { name: "注入温度异常", exact: true }).click();
  await expect(
    page.getByText("温度超过 80°C 演示阈值，检查冷却液及散热回路").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "数字孪生车间", exact: true }).click();
  await expect(page.locator("aside .badge").last()).toHaveText("故障");
  await page.getByRole("button", { name: "生产调度", exact: true }).click();
  await expect(page.getByText("停机 · 不参与排产")).toBeVisible();
  await page.getByRole("button", { name: "AR 智能巡检", exact: true }).click();
  await expect(
    page.getByText("普通三维维修演示（无摄像头、无图像识别）"),
  ).toBeVisible();
  await page.getByRole("button", { name: "创建设备维修工单" }).click();
  await expect(
    page.getByRole("button", { name: "完成维修并恢复生产" }),
  ).toBeDisabled();
  for (const checkbox of await page.locator(".steps input").all())
    await checkbox.check();
  await page.getByRole("button", { name: "完成维修并恢复生产" }).click();
  await expect(page.locator(".ar-layout .badge").first()).toHaveText("待机");
  await page.getByRole("button", { name: "开始生产", exact: true }).click();
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
  await page
    .getByRole("button", { name: "数据分析与报告", exact: true })
    .click();
  await expect(
    page.getByText("设备恢复", { exact: true }).first(),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出运行报告" }).click();
  expect((await download).suggestedFilename()).toBe("nexus-report.html");
  await page.getByRole("button", { name: "重置演示" }).click();
  await page.getByRole("button", { name: "初始化正常生产（暂停）" }).click();
  await expect(page.locator(".clock time")).toHaveText("08:00:00");
  expect(errors).toEqual([]);
});
test("所有页面在桌面和手机可访问，无页面横向溢出", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const hash of [
      "dashboard",
      "twin",
      "scheduling",
      "quality",
      "health",
      "energy",
      "ar",
      "reports",
    ]) {
      await page.goto("/#" + hash);
      await expect(page.locator("h1")).toBeVisible();
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        hash + " " + width,
      ).toBe(true);
      await page.screenshot({
        path: `deliverables/screenshots/${hash}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
test("AR 摄像头权限错误及明确三维降级", async ({ browser }) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("permission denied", "NotAllowedError");
    };
  });
  await page.goto("/#ar");
  await page.getByRole("button", { name: "启动 AR 摄像头" }).click();
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 60000 });
  await page
    .getByRole("button", { name: "普通三维维修演示", exact: true })
    .click();
  await expect(page.locator(".notice").first()).toContainText("无图像识别");
  await expect(page.locator("canvas")).toBeVisible();
  await context.close();
});
test("刷新可恢复订单、故障与模拟时间，默认暂停", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "重置演示" }).click();
  await page.getByRole("button", { name: "加载温度故障场景" }).click();
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
  const time = await page.locator(".clock time").textContent();
  await page.reload();
  await expect(page.locator(".clock time")).toHaveText(time!);
  await expect(
    page.getByRole("button", { name: "开始生产", exact: true }),
  ).toBeVisible();
  await page.goto("/#health");
  await expect(page.locator(".badge.fault").first()).toBeVisible();
});
