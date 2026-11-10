import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: [
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("ERROR", e.message));
await page.goto("http://127.0.0.1:5174/ar/compiler.html");
await page.waitForFunction(() => window.targetPNG, { timeout: 30000 });
await fs.writeFile(
  "public/ar-targets/equipment-target.png",
  Buffer.from(
    (await page.evaluate(() => window.targetPNG)).split(",")[1],
    "base64",
  ),
);
console.log("Target image saved");
await page.waitForFunction(() => window.compiled || window.compileError, {
  timeout: 180000,
});
const error = await page.evaluate(() => window.compileError);
if (error) throw Error(error);
const bytes = await page.evaluate(() => window.targetMind);
await fs.writeFile("public/ar-targets/equipment.mind", Buffer.from(bytes));
console.log("Compiled .mind:", bytes.length, "bytes");
await browser.close();
