import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.AUGUR_AUDIT_URL || "http://localhost:3010";
const output = resolve("../docs/images");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], writes = [];
  page.on("pageerror", () => errors.push("Page error"));
  page.on("console", message => { if (message.type() === "error") errors.push("Console error"); });
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).origin === new URL(base).origin && new URL(request.url()).pathname.startsWith("/api/")) writes.push("Application write");
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => [...document.querySelectorAll(".wall-panel video")].length === 3 && [...document.querySelectorAll(".wall-panel video")].every(video => !video.paused && video.readyState >= 2));
  for (const width of [1440, 1920, 390, 430]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => [...document.querySelectorAll(".wall-panel")].map(panel => {
      const screen = panel.querySelector(".media-screen").getBoundingClientRect();
      const link = panel.querySelector(".wall-chamber-link").getBoundingClientRect();
      return { ratio: screen.width / screen.height, uncovered: link.top >= screen.bottom, fit: getComputedStyle(panel.querySelector("video")).objectFit };
    }));
    assert(geometry.every(item => Math.abs(item.ratio - 16 / 9) < .02 && item.uncovered && item.fit === "contain"));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: resolve(output, `clean-media-home-${width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const practice = page.getByRole("region", { name: "Playable demo exchange" });
  await practice.getByRole("button", { name: "Reset practice", exact: true }).click();
  await practice.getByRole("button", { name: "Predict BUY", exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("augur.practice.exchange.v1")).rounds.pablo.samples.length >= 5);
  const chart = page.locator(".pool-chart-canvas");
  assert(await chart.locator("canvas").count() >= 2);
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * .75, box.y + box.height * .4);
  await page.waitForFunction(() => /BUY .*%/.test(document.querySelector(".pool-chart-footer > span").textContent));
  const chartReadout = await page.locator(".pool-chart-footer > span").textContent();
  await page.locator(".practice-layout").screenshot({ path: resolve(output, "clean-market-1440.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.locator(".practice-market").screenshot({ path: resolve(output, "clean-market-390.png") });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const name of ["pablo", "bubbles", "turbo"]) {
    assert.equal((await page.goto(`${base}/replays/${name}`, { waitUntil: "domcontentloaded" })).status(), 200);
    await page.locator(".media-stage video").first().waitFor();
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  console.log(JSON.stringify({ status: "PASS", cleanVideos: 3, ratio: "16:9", fit: "contain", textOverAnimal: false, chartReadout, timestampedChart: true, widths: [1440, 1920, 390, 430], replayRoutes: 3, applicationWrites: 0, errors: 0 }, null, 2));
} finally { await browser.close(); }
