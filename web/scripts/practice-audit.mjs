import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.AUGUR_AUDIT_URL || "http://localhost:3010";
const output = resolve(process.env.AUGUR_AUDIT_ASSETS || "../docs/images");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const storage = "augur.practice.exchange.v1";
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [], writes = [];
  page.on("pageerror", () => errors.push("Page error"));
  page.on("console", (message) => { if (message.type() === "error") errors.push("Console error"); });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.origin === new URL(base).origin && url.pathname.startsWith("/api/")) writes.push(url.pathname);
  });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  const practice = page.getByRole("region", { name: "Playable demo exchange" });
  await practice.getByRole("button", { name: "Predict BUY", exact: true }).waitFor();
  await page.waitForFunction((storage) => Boolean(localStorage.getItem(storage)), storage);
  await practice.getByRole("button", { name: "Reset practice", exact: true }).click();
  const markets = practice.getByRole("group", { name: "Choose demo market" });
  await markets.getByRole("button", { name: /Turbo/ }).click();
  await practice.getByRole("button", { name: /^SELL/ }).click();
  await practice.getByRole("spinbutton", { name: "Stake · demo credits" }).fill("25");
  await practice.getByRole("button", { name: "Predict SELL", exact: true }).click();
  await markets.getByRole("button", { name: /Pablo/ }).click();
  await practice.getByRole("button", { name: /^HOLD/ }).click();
  await practice.getByRole("button", { name: "Predict HOLD", exact: true }).click();
  await page.waitForFunction((storage) => JSON.parse(localStorage.getItem(storage)).balance === 950, storage);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(output, "playable-exchange-1440.png"), fullPage: true });
  // Real wall-clock round progression, not a mocked contract receipt or timer.
  await practice.getByRole("button", { name: "Claim demo payout", exact: true }).waitFor({ timeout: 40000 });
  const beforeClaim = await page.evaluate((storage) => JSON.parse(localStorage.getItem(storage)), storage);
  const win = beforeClaim.results.find((result) => result.creature === "pablo" && result.stake === 25);
  const loss = beforeClaim.results.find((result) => result.creature === "turbo" && result.stake === 25);
  assert(win?.payout > 25); assert.equal(loss?.payout, 0);
  await practice.getByRole("button", { name: "Claim demo payout", exact: true }).click();
  await page.waitForFunction(({ storage, balance }) => JSON.parse(localStorage.getItem(storage)).balance === balance, { storage, balance: 950 + win.payout });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(({ storage, balance }) => JSON.parse(localStorage.getItem(storage)).balance === balance, { storage, balance: 950 + win.payout });
  await practice.getByText("Claimed", { exact: true }).first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  await page.screenshot({ path: resolve(output, "playable-results-1440.png"), fullPage: true });
  assert.deepEqual(writes, []); assert.deepEqual(errors, []);
  for (const width of [1920, 390, 430]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1080 });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.scrollTo(0, 0));
    await practice.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".wall-panel video")].length === 3 && [...document.querySelectorAll(".wall-panel video")].every((video) => !video.paused && video.readyState >= 2));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `playable-home-${width}.png`), fullPage: true });
  }
  for (const creature of ["pablo", "bubbles", "turbo"]) {
    assert.equal((await page.goto(`${base}/replays/${creature}`, { waitUntil: "domcontentloaded" })).status(), 200);
    await page.getByRole("heading", { name: creature === "pablo" ? "Pablo" : creature === "bubbles" ? "Bubbles" : "Turbo", exact: true }).waitFor();
    await page.getByRole("region", { name: "Playable demo exchange" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: "PASS", win: { payout: win.payout, stake: win.stake }, loss: { payout: loss.payout, stake: loss.stake }, claim: true, refreshPersistence: true, applicationWrites: writes.length, widths: [1440, 1920, 390, 430], creaturePages: 3, consoleErrors: 0, overflow: false }, null, 2));
  await context.close();
} finally { await browser.close(); }
