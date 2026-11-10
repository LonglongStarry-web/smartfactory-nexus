import { test, expect } from "@playwright/test";
const nav = (page: any, name: string) =>
  page.getByRole("button", { name, exact: true }).click();
test("版本区不显示或存储更新、发布及检查时间", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("version.json")) requests.push(r.url());
  });
  await page.goto("/#settings");
  await nav(page, "检查更新");
  await expect(page.getByText("当前已是部署清单中的最新版本")).toBeVisible();
  await expect(page.getByText(/本次更新：|发布于|检查于/)).toHaveCount(0);
  const manifest = await (await page.request.get("/version.json")).json();
  expect(manifest).not.toHaveProperty("publishedAt");
  expect(manifest).not.toHaveProperty("checkedAt");
  expect(requests.every((url) => !url.includes("check="))).toBe(true);
  expect(
    await page.evaluate(
      () => localStorage.getItem("nexus-simulation-v1") || "",
    ),
  ).not.toMatch(/publishedAt|checkedAt|updatedAt/);
});
test("主题色实际改变导航、主按钮、排产条和图表像素", async ({ page }) => {
  await page.goto("/#settings");
  await nav(page, "浅色");
  await nav(page, "主题色：琥珀金");
  await expect(page.locator(".version-summary .primary")).toHaveCSS(
    "background-color",
    "rgb(146, 64, 14)",
  );
  await expect(page.locator("nav button.active")).toHaveCSS(
    "color",
    "rgb(146, 64, 14)",
  );
  await expect(page.locator(".appearance-preview b")).toHaveCSS(
    "color",
    "rgb(146, 64, 14)",
  );
  await nav(page, "重置演示");
  await nav(page, "加载紧急订单场景");
  await nav(page, "暂停模拟");
  await page.goto("/#scheduling");
  await expect(page.locator(".gantt-slot").first()).toBeVisible();
  const amberBar = await page
    .locator(".gantt-slot")
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.goto("/#energy");
  const pixels = async (rgb: number[]) =>
    page
      .locator(".chart canvas")
      .last()
      .evaluate((el, rgb) => {
        const canvas = el as HTMLCanvasElement;
        const context = canvas.getContext("2d");
        if (!context) return 0;
        const data = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4)
          if (
            Math.abs(data[i] - rgb[0]) < 3 &&
            Math.abs(data[i + 1] - rgb[1]) < 3 &&
            Math.abs(data[i + 2] - rgb[2]) < 3 &&
            data[i + 3] > 240
          )
            count++;
        return count;
      }, rgb);
  await expect.poll(() => pixels([146, 64, 14])).toBeGreaterThan(100);
  await page.goto("/#settings");
  await nav(page, "主题色：远山蓝");
  await expect(page.locator(".version-summary .primary")).toHaveCSS(
    "background-color",
    "rgb(29, 78, 216)",
  );
  await page.goto("/#scheduling");
  expect(
    await page
      .locator(".gantt-slot")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe(amberBar);
  await page.goto("/#energy");
  await expect.poll(() => pixels([29, 78, 216])).toBeGreaterThan(100);
});
test("字号影响真实文字与图表尺寸，跨页和刷新后保留", async ({ page }) => {
  await page.goto("/#settings");
  const initial = await page
    .locator("nav button.active")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.getByLabel("界面字号", { exact: true }).selectOption("xlarge");
  await expect(page.locator("html")).toHaveAttribute(
    "data-font-size",
    "xlarge",
  );
  await expect
    .poll(() =>
      page
        .locator("nav button.active")
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    )
    .toBeCloseTo(initial * 1.45, 1);
  await page.reload();
  await expect(page.getByLabel("界面字号", { exact: true })).toHaveValue(
    "xlarge",
  );
  await page.goto("/#energy");
  await expect(page.locator(".chart").first()).toHaveCSS("height", "333.5px");
  await page.goto("/#settings");
  await nav(page, "恢复默认设置");
  await nav(page, "确认恢复默认设置");
  await expect(page.getByLabel("界面字号", { exact: true })).toHaveValue(
    "standard",
  );
});
test("最大字号下九页在桌面和手机均无横向溢出", async ({ page }) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#settings");
  await page.getByLabel("界面字号", { exact: true }).selectOption("xlarge");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [hash, title] of [
      ["dashboard", "智能制造驾驶舱"],
      ["twin", "数字孪生车间"],
      ["scheduling", "生产调度"],
      ["quality", "智能质量检测"],
      ["health", "设备健康与维护"],
      ["energy", "能耗与绿色制造"],
      ["ar", "AR 智能设备巡检"],
      ["reports", "数据分析与报告"],
      ["settings", "系统设置"],
    ]) {
      await page.goto("/#" + hash);
      await expect(page.locator("h1")).toHaveText(title);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        `${hash} ${width}`,
      ).toBe(true);
      await page.screenshot({
        path: `deliverables/screenshots/v1.1.1-large-${hash}-${width}.png`,
        fullPage: true,
      });
    }
  }
  expect(errors).toEqual([]);
});
