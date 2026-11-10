import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const snapshot = JSON.parse(
  await fs.readFile("deliverables/示例状态快照.json", "utf8"),
);
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.addInitScript(
  (s) =>
    localStorage.setItem(
      "nexus-simulation-v1",
      JSON.stringify({
        state: { s: { ...s, running: false }, theme: "dark" },
        version: 1,
      }),
    ),
  snapshot.state,
);
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
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(700);
  await p.screenshot({
    path: `deliverables/screenshots/deck-${route}.png`,
    clip: { x: 216, y: 70, width: 1224, height: 760 },
  });
}
await p.goto("http://127.0.0.1:5174/#health");
await p.getByRole("button", { name: "注入温度异常", exact: true }).click();
await p.goto("http://127.0.0.1:5174/#twin");
await p.waitForTimeout(600);
await p.screenshot({
  path: "deliverables/screenshots/deck-fault.png",
  clip: { x: 216, y: 70, width: 1224, height: 760 },
});
await b.close();
console.log("Deck screenshots captured");
