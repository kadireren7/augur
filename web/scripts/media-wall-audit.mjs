import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const base = process.env.AUGUR_AUDIT_URL || "http://localhost:3010";
const output = resolve(process.env.AUGUR_AUDIT_ASSETS || "../docs/images");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1920, 1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1080 } });
    const page = await context.newPage();
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on("pageerror", () => errors.push("Page error"));
    page.on("console", (message) => { if (message.type() === "error") errors.push("Console error"); });
    assert.equal((await page.goto(base, { waitUntil: "domcontentloaded" })).status(), 200);
    await page.locator(".creature-wall").first().waitFor();
    await page.waitForFunction(() => {
      const videos = [...document.querySelectorAll(".wall-panel video")];
      return videos.length === 3 && videos.every((video) => !video.paused && video.readyState >= 2 && video.currentTime > 0);
    }, null, { timeout: 60000 }).catch(async (error) => {
      console.log(await page.locator(".wall-panel video").evaluateAll((videos) => videos.map((video) => ({
        paused: video.paused, ready: video.readyState, time: video.currentTime, duration: video.duration,
      }))));
      throw error;
    });
    const playback = await page.locator(".wall-panel video").evaluateAll((videos) => videos.map((video) => ({
      autoplay: video.autoplay, muted: video.muted, inline: video.playsInline,
      loop: video.loop, playing: !video.paused, duration: video.duration,
    })));
    assert(playback.every((video) => video.autoplay && video.muted && video.inline && video.loop && video.playing));
    console.log(`Autoplay verified at ${width}px: three muted looping replays.`);
    assert.equal(await page.locator(".wall-panel .media-badge").allTextContents().then((labels) => labels.every((label) => /Replay/i.test(label))), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (width === 1920) {
      const loops = await page.locator(".wall-panel video").evaluateAll(async (videos) => Promise.all(videos.map(async (video) => {
        const loopBoundary = video.duration - 0.4;
        video.currentTime = loopBoundary;
        await new Promise((done) => video.addEventListener("seeked", done, { once: true }));
        const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 18;
        const context = canvas.getContext("2d");
        return new Promise((done) => {
          let previous = loopBoundary, minimum = 255, samples = 0;
          const deadline = performance.now() + 10000;
          const sample = () => {
            context.drawImage(video, 0, 0, 32, 18);
            const data = context.getImageData(0, 0, 32, 18).data;
            let sum = 0;
            for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
            minimum = Math.min(minimum, sum / (32 * 18)); samples++;
            const time = video.currentTime;
            if (time < previous - 0.5) return done({ wrapped: true, minimum, samples, playing: !video.paused });
            if (performance.now() > deadline) return done({ wrapped: false, minimum, samples, playing: !video.paused, time, duration: video.duration, ready: video.readyState, seeking: video.seeking });
            previous = time; requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
      })));
      assert(loops.every((loop) => loop.wrapped && loop.playing && loop.minimum > 3), JSON.stringify(loops));
      results.push({ loops });
      const panel = page.locator(".wall-panel").first();
      await panel.getByRole("button", { name: "Pause replay", exact: true }).click();
      assert.equal(await panel.locator("video").evaluate((video) => video.paused), true);
      await panel.getByRole("button", { name: "Play replay", exact: true }).click();
      await panel.getByRole("button", { name: "Pause replay", exact: true }).waitFor();
      await panel.getByRole("button", { name: "Sound off", exact: true }).click();
      assert.equal(await panel.locator("video").evaluate((video) => video.muted), false);
      await panel.getByRole("button", { name: "Sound on", exact: true }).click();
      await panel.getByRole("button", { name: "Fullscreen", exact: false }).click();
      await page.waitForFunction(() => Boolean(document.fullscreenElement));
      await page.evaluate(() => document.exitFullscreen());
      assert.equal(new URL(page.url()).pathname, "/");
    }
    await page.screenshot({ path: resolve(output, `wall-home-${width}.png`) });
    if (width === 390) {
      for (const name of ["Bubbles", "Turbo"]) {
        await page.getByRole("button", { name, exact: true }).click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: resolve(output, `wall-${name.toLowerCase()}-${width}.png`) });
      }
    }
    for (const name of ["Pablo", "Bubbles", "Turbo"]) {
      if (width === 390) await page.getByRole("button", { name, exact: true }).click();
      await page.getByRole("link", { name: `Enter ${name}’s Chamber`, exact: true }).click();
      // Retry only an explicit indexed-service failure, never substitute data.
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.waitForFunction((name) => [...document.querySelectorAll("h1,h2")].some((heading) =>
          heading.textContent.trim() === name || heading.textContent.includes("data unavailable")), name);
        if (await page.getByRole("heading", { name, exact: true }).count()) break;
        console.log(`Explicit indexed-service failure opening ${name}; retry ${attempt + 1}.`);
        await page.reload({ waitUntil: "domcontentloaded" });
      }
      await page.getByRole("heading", { name, exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.goto(base, { waitUntil: "domcontentloaded" });
      await page.locator(".creature-wall").first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll(".creature-wall").length === 1);
    }
    assert.deepEqual(errors, []);
    results.push({ width, playback, links: 3, errors: 0, overflow: false });
    await context.close();
  }
  console.log(JSON.stringify({ status: "PASS", results }, null, 2));
} finally { await browser.close(); }
