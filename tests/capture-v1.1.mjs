import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = "http://127.0.0.1:4173";
await page.goto(base + "/#settings");
await page.getByRole("button", { name: "检查更新", exact: true }).click();
await page.getByText("当前已是部署清单中的最新版本").waitFor();
await page.screenshot({
  path: "deliverables/screenshots/v1.1-settings-checked.png",
  fullPage: true,
});
await page.getByRole("button", { name: "浅色", exact: true }).click();
await page.getByRole("button", { name: "主题色：远山蓝" }).click();
await page.waitForTimeout(250);
await page.screenshot({
  path: "deliverables/screenshots/v1.1-settings-light.png",
  fullPage: true,
});
await page.getByRole("button", { name: "深色", exact: true }).click();
await page.getByRole("button", { name: "主题色：冰川青" }).click();
await page.getByRole("button", { name: "重置演示" }).click();
await page.getByRole("button", { name: "加载紧急订单场景" }).click();
await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
await page.goto(base + "/#scheduling");
await page.getByRole("heading", { name: "生产调度", exact: true }).waitFor();
await page.waitForTimeout(3500);
await page.screenshot({
  path: "deliverables/screenshots/v1.1-scheduling.png",
  fullPage: true,
});
await page.goto(base + "/#twin");
await page.getByRole("button", { name: "隐藏标签", exact: true }).click();
await page.getByRole("button", { name: "聚焦设备", exact: true }).click();
for (const id of ["CNC-01", "QC-01", "ARM-01", "ASRS-01", "AGV-01"]) {
  await page.getByLabel("选择设备", { exact: true }).selectOption(id);
  await page.waitForTimeout(1500);
  await page
    .locator(".full-scene")
    .screenshot({ path: `deliverables/screenshots/v1.1-lamp-${id}.png` });
}
await fs.writeFile(
  "deliverables/v1.1-browser-check.json",
  JSON.stringify(
    {
      errors,
      version: "1.1.0",
      screenshots: [
        "settings-checked",
        "settings-light",
        "scheduling",
        "lamp-CNC-01",
        "lamp-QC-01",
        "lamp-ARM-01",
        "lamp-ASRS-01",
        "lamp-AGV-01",
      ],
    },
    null,
    2,
  ),
);
console.log(
  "Captured revised production UI and all device lamp mounts; page errors:",
  errors.length,
);
await browser.close();
