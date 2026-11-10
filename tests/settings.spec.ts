import packageInfo from "../package.json" with { type: "json" };
const APP_VERSION = packageInfo.version;
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const legacySnapshot = JSON.parse(
  readFileSync(
    new URL("../deliverables/示例状态快照.json", import.meta.url),
    "utf8",
  ),
);
test("升级保留v1.0本地生产数据并补齐默认设置", async ({ page }) => {
  await page.addInitScript(
    (s) =>
      localStorage.setItem(
        "nexus-simulation-v1",
        JSON.stringify({
          state: { s: { ...s, running: false }, theme: "light" },
          version: 1,
        }),
      ),
    legacySnapshot.state,
  );
  await page.goto("/#settings");
  await expect(page.locator(".clock time")).toHaveText("08:02:00");
  await expect(
    page.getByRole("button", { name: "浅色", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("显示设备标签", { exact: true })).toBeChecked();
  await expect(page.getByLabel("界面字号", { exact: true })).toHaveValue(
    "standard",
  );
  await expect(
    page.getByText("4 个订单 · 85 条事件 · 包含当前偏好。"),
  ).toBeVisible();
});
test("设置保存、系统主题、三维偏好、备份与恢复", async ({ page }) => {
  await page.goto("/#settings");
  await expect(
    page.getByRole("heading", { name: "系统设置", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`v${APP_VERSION}`, { exact: true }).last(),
  ).toBeVisible();
  await page.getByRole("button", { name: "浅色", exact: true }).click();
  await page.getByRole("button", { name: "主题色：远山蓝" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--cyan"),
    ),
  ).toBe("#1d4ed8");
  await page.getByLabel("三维车间画质", { exact: true }).selectOption("low");
  await page.getByLabel("显示设备标签", { exact: true }).uncheck();
  await page.getByLabel("默认模拟倍速", { exact: true }).selectOption("20");
  await page
    .getByLabel("表格密度", { exact: true })
    .selectOption("comfortable");
  await page.getByLabel("减少界面动效", { exact: true }).check();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "主题色：远山蓝" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("模拟倍速", { exact: true })).toHaveValue("20");
  await expect(page.locator("html")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await page.getByRole("button", { name: "数字孪生车间", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "显示标签", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "低画质", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".device-label")).toHaveCount(0);
  await page.getByRole("button", { name: "系统设置", exact: true }).click();
  await page.getByRole("button", { name: "跟随系统", exact: true }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(
    "nexus-workspace-backup.json",
  );
  await page.getByRole("button", { name: "恢复默认设置", exact: true }).click();
  await page
    .getByRole("button", { name: "确认恢复默认设置", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "深色", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("显示设备标签", { exact: true })).toBeChecked();
  await expect(page.getByLabel("模拟倍速", { exact: true })).toHaveValue("5");
});
test("版本检查使用实际清单，能区分新版本与失败", async ({ page }) => {
  await page.goto("/#settings");
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByText("当前已是部署清单中的最新版本")).toBeVisible();
  await page.route("**/version.json", (route) =>
    route.fulfill({
      json: {
        version: "9.0.0",
        notes: ["测试发布清单"],
      },
    }),
  );
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByText("发现新版本 v9.0.0")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "重新载入应用", exact: true }),
  ).toBeVisible();
  await page.unroute("**/version.json");
  await page.route("**/version.json", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.getByRole("button", { name: "检查更新", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("HTTP 503");
});
test("计划、预计与实际完工语义清晰，连续秒数不会循环", async ({ page }) => {
  await page.goto("/#scheduling");
  await expect(
    page.getByRole("columnheader", { name: "计划开始", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "完工时间", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "交付期限", exact: true }),
  ).toBeVisible();
  const before = await page
    .locator("tbody tr")
    .first()
    .locator("td")
    .nth(5)
    .locator("time")
    .textContent();
  await page.getByLabel("模拟倍速", { exact: true }).selectOption("1");
  await page.getByRole("button", { name: "开始生产", exact: true }).click();
  await page.waitForTimeout(2200);
  await expect(
    page.locator("tbody tr").first().locator("td").nth(5).locator("time"),
  ).toHaveText(before!);
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
});
test("设置页面在桌面、平板和手机布局正常", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/#settings");
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `deliverables/screenshots/v1.1-settings-${width}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
