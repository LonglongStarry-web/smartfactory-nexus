import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto("http://127.0.0.1:5174/");
await p.getByRole("button", { name: "重置演示" }).click();
await p.getByRole("button", { name: "加载紧急订单场景" }).click();
await p.getByRole("button", { name: "暂停模拟", exact: true }).click();
await fs.mkdir("deliverables/screenshots", { recursive: true });
for (const route of [
  "dashboard",
  "twin",
  "scheduling",
  "quality",
  "health",
  "energy",
  "ar",
  "reports",
]) {
  await p.goto("http://127.0.0.1:5174/#" + route);
  await p.locator("h1").waitFor();
  await p.waitForTimeout(700);
  await p.screenshot({
    path: `deliverables/screenshots/demo-${route}.png`,
    fullPage: true,
  });
}
await p.goto("http://127.0.0.1:5174/#health");
await p.getByRole("button", { name: "注入温度异常", exact: true }).click();
await p.goto("http://127.0.0.1:5174/#twin");
await p.waitForTimeout(700);
await p.screenshot({
  path: "deliverables/screenshots/demo-fault.png",
  fullPage: true,
});
await p.goto("http://127.0.0.1:5174/#ar");
await p.getByRole("button", { name: "创建设备维修工单" }).click();
for (const c of await p.locator(".steps input").all()) await c.check();
await p.screenshot({
  path: "deliverables/screenshots/demo-repair.png",
  fullPage: true,
});
await p.getByRole("button", { name: "完成维修并恢复生产" }).click();
await p.goto("http://127.0.0.1:5174/#reports");
const dl = p.waitForEvent("download");
await p.getByRole("button", { name: "导出运行报告" }).click();
await (await dl).saveAs("deliverables/示例运行报告.html");
const json = p.waitForEvent("download");
await p.getByRole("button", { name: "JSON 快照" }).click();
await (await json).saveAs("deliverables/示例状态快照.json");
await p.screenshot({
  path: "deliverables/screenshots/demo-report-history.png",
  fullPage: true,
});
await p.setViewportSize({ width: 390, height: 844 });
await p.goto("http://127.0.0.1:5174/#dashboard");
await p.waitForTimeout(500);
await p.screenshot({
  path: "deliverables/screenshots/demo-mobile.png",
  fullPage: true,
});
await fs.writeFile(
  "deliverables/screenshot-check.json",
  JSON.stringify(
    { errors, widths: [1440, 390], generated: "2026-11-09" },
    null,
    2,
  ),
);
console.log(
  "Populated demo screenshots and example reports captured; page errors:",
  errors.length,
);
await b.close();
