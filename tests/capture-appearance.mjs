import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const base = "http://127.0.0.1:4173";
try {
  await p.goto(base + "/#settings");
  await p.getByRole("button", { name: "浅色", exact: true }).click();
  await p.getByRole("button", { name: "主题色：琥珀金" }).click();
  await p.getByLabel("界面字号", { exact: true }).selectOption("medium");
  await p.getByRole("button", { name: "检查更新", exact: true }).click();
  await p.getByText("当前已是部署清单中的最新版本").waitFor();
  await p.waitForTimeout(250);
  await p.screenshot({
    path: "deliverables/screenshots/v1.1.1-amber-light-settings.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "重置演示" }).click();
  await p.getByRole("button", { name: "加载紧急订单场景" }).click();
  await p.getByRole("button", { name: "暂停模拟", exact: true }).click();
  await p.goto(base + "/#scheduling");
  await p.waitForTimeout(3500);
  await p.screenshot({
    path: "deliverables/screenshots/v1.1.1-amber-scheduling.png",
    fullPage: true,
  });
  await p.goto(base + "/#energy");
  await p.waitForTimeout(500);
  await p.screenshot({
    path: "deliverables/screenshots/v1.1.1-amber-charts.png",
    fullPage: true,
  });
  await p.goto(base + "/#settings");
  await p.getByLabel("界面字号", { exact: true }).selectOption("xlarge");
  await p.setViewportSize({ width: 390, height: 1000 });
  await p.waitForTimeout(250);
  await p.screenshot({
    path: "deliverables/screenshots/v1.1.1-amber-large-mobile.png",
    fullPage: true,
  });
  await p.getByRole("button", { name: "展开导航", exact: true }).click();
  await p.waitForTimeout(250);
  await p.screenshot({
    path: "deliverables/screenshots/v1.1.1-large-mobile-navigation.png",
  });
  await fs.writeFile(
    "deliverables/v1.1.1-production-check.json",
    JSON.stringify(
      {
        version: "1.1.1",
        errors,
        theme: "amber",
        scales: [1.15, 1.45],
        widths: [1440, 390],
      },
      null,
      2,
    ),
  );
  console.log(
    "Production theme and font screenshots captured; page errors:",
    errors.length,
  );
} finally {
  await b.close();
}
