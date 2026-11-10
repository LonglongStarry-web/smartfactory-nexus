import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--no-proxy-server", "--enable-unsafe-swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const image = new Image();
    image.src = "/ar-targets/equipment-target.png";
    await image.decode();
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 1280;
    const ctx = c.getContext("2d");
    function draw() {
      ctx.fillStyle = "#b5b5b5";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(image, 130, 190, 700, 900);
      requestAnimationFrame(draw);
    }
    draw();
    const stream = c.captureStream(30);
    parent.__testTracks ??= [];
    parent.__testTracks.push(...stream.getTracks());
    return stream;
  };
});
await p.goto("http://127.0.0.1:4173/#ar");
await p.getByRole("button", { name: "启动 AR 摄像头" }).click();
let recognized = false;
try {
  await p.waitForFunction(
    () => document.body.innerText.includes("已识别目标"),
    {},
    { timeout: 45000 },
  );
  recognized = true;
} catch {}
await p.screenshot({
  path: "deliverables/screenshots/ar-synthetic-desktop.png",
  fullPage: true,
});
const status = await p
  .locator(".ar-layout .panel-head small")
  .first()
  .innerText();
await p.screenshot({path:'deliverables/screenshots/deck-ar-synthetic.png',clip:{x:216,y:70,width:1064,height:760}});
if (await p.getByRole("button", { name: "关闭摄像头" }).isEnabled())
  await p.getByRole("button", { name: "关闭摄像头" }).click();
await p.waitForTimeout(300);
const released = await p.evaluate(
  () => window.__testTracks?.every((t) => t.readyState === "ended") ?? false,
);
const result = {
  method:
    "Desktop Chrome, generated canvas stream of actual target PNG; no physical camera or phone",
  recognized,
  status,
  allTracksReleased: released,
  errors,
};
await fs.writeFile(
  "deliverables/ar-synthetic-result.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
await b.close();
