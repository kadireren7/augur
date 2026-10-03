const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright"
);
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.env.AUGUR_AUDIT_URL || "http://localhost:3010";
const output = resolve(process.env.AUGUR_AUDIT_ASSETS || "../docs/images");
await mkdir(output, { recursive: true });
const chamber = "/chambers/indexed-9d6541b7a855bf7c";
const routes = [
  "/",
  chamber,
  `${chamber}/proof`,
  "/chronicle",
  "/battles",
  "/create",
  "/showcase",
  "/health",
  "/replays/bubbles",
  "/replays/turbo",
];
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 1024, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1000 },
    });
    context.setDefaultTimeout(60000);
    const page = await context.newPage();
    const errors = [];
    let consoleErrors = 0;
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors++;
    });
    page.on("pageerror", (error) =>
      errors.push({
        type: error.name,
        hydration: /hydrat|React error #418/i.test(error.message),
        message: error.message
          .replace(/https?:\/\/\S+/g, "[URL]")
          .replace(/[A-Za-z0-9_-]{16,}/g, "[redacted]"),
      }),
    );
    for (const route of routes) {
      const start = errors.length;
      const consoleStart = consoleErrors;
      const response = await page.goto(base + route, {
        waitUntil: "domcontentloaded",
      });
      await page
        .locator(".page-heading, .exchange-hero")
        .first()
        .waitFor({ state: "visible" });
      await page.waitForTimeout(900);
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      if (dimensions.document > width)
        throw new Error(
          `Horizontal overflow ${route} at ${width}: ${dimensions.document}`,
        );
      if (response.status() !== 200)
        throw new Error(`Route ${route} HTTP ${response.status()}`);
      const body = await page.locator("body").innerText();
      if (
        route === chamber &&
        (!body.includes("INDEXED") ||
          !(await page.locator('[data-contract-mode="true"]').count()) ||
          !body.includes("BUY") ||
          !body.includes("Pablo") ||
          /Advance deterministic fixture/.test(body))
      )
        throw new Error(
          "Indexed Chamber mode or transaction surface regression",
        );
      if (route === chamber) {
        if (
          /Hamster [0-9a-f]{6}|0x[0-9a-fA-F]{40,}|LOCAL DEMO|FIXTURE/.test(body)
        )
          throw new Error("Technical metadata leaked into normal Chamber view");
        for (const name of ["Approve", "Predict BUY", "Send"]) {
          const button = page.getByRole("button", { name, exact: true });
          if ((await button.count()) && !(await button.isDisabled()))
            throw new Error(`Logged-out action enabled: ${name}`);
        }
      }
      if (route.startsWith("/replays/")) {
        await page.waitForFunction(
          () => document.querySelector("video")?.readyState >= 2,
          { timeout: 12000 },
        );
      }
      if (
        route === "/chronicle" &&
        (!body.includes("10 AUGD") ||
          body.includes("10000000000000000000 AUGD"))
      )
        throw new Error("Chronicle AUGD formatting regression");
      results.push({
        width,
        route,
        status: response.status(),
        overflow: false,
        errors: errors.slice(start),
        consoleErrors: consoleErrors - consoleStart,
      });
      if (width === 1440 || width === 390) {
        for (
          let y = 0;
          y < (await page.evaluate(() => document.body.scrollHeight));
          y += 700
        ) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await page.waitForTimeout(120);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(600);
        const names = {
          "/": "home",
          [chamber]: "chamber",
          [`${chamber}/proof`]: "proof",
          "/chronicle": "chronicle",
          "/battles": "battles",
          "/create": "create",
          "/showcase": "showcase",
          "/health": "health",
          "/replays/bubbles": "fish",
          "/replays/turbo": "turtle",
        };
        await page.screenshot({
          path: resolve(
            output,
            `${names[route]}${width === 390 ? "-mobile" : ""}.png`,
          ),
          fullPage: true,
          timeout: 90000,
        });
      }
    }
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto(base + "/");
  await page.locator(".exchange-hero").waitFor();
  await page.waitForTimeout(1000);
  await page
    .locator("video")
    .first()
    .evaluate((element) => {
      if (element.readyState >= 2) element.currentTime = 15;
    });
  await page.waitForTimeout(500);
  await page.screenshot({ path: resolve(output, "hero.png") });
  await page.locator(".discovery-section").scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page
    .locator(".discovery-section")
    .screenshot({ path: resolve(output, "discovery.png") });
  await page.getByRole("button", { name: "Fish", exact: true }).click();
  if (
    (await page.locator(".creature-discovery").count()) !== 1 ||
    !(await page.getByRole("link", { name: "Open Chamber" }).isVisible())
  )
    throw new Error("Creature category filtering failed");
  await page.getByRole("link", { name: "Chronicle", exact: true }).click();
  await page.locator(".ledger-event").first().waitFor();
  await page.goto(base + chamber);
  await page.waitForTimeout(1500);
  console.log(
    "Media",
    JSON.stringify(
      await page.locator("video").evaluate((element) => ({
        readyState: element.readyState,
        currentTime: element.currentTime,
        sourceMode: "REPLAY",
      })),
    ),
  );
  await page.getByRole("button", { name: "How payouts work" }).click();
  if (!(await page.getByText("0% platform fee.", { exact: false }).isVisible()))
    throw new Error("Payout drawer failed");
  await page.getByRole("button", { name: "Fullscreen ↗" }).click();
  await page.waitForTimeout(300);
  const fullscreen = await page.evaluate(() =>
    Boolean(document.fullscreenElement),
  );
  if (fullscreen) await page.evaluate(() => document.exitFullscreen());
  await page.locator("video").evaluate((element) => {
    element.src = "/media/audit-missing.webm";
    element.load();
  });
  await page
    .getByRole("alert")
    .filter({ hasText: "Video unavailable" })
    .waitFor();
  if (!(await page.locator("body").innerText()).includes("INDEXED"))
    throw new Error("Video failure replaced indexed mode");
  await page.reload();
  await page.getByRole("button", { name: "Log in", exact: true }).waitFor();
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForTimeout(1200);
  const loginDialog = await page.getByRole("dialog").count();
  if (loginDialog)
    await page.screenshot({ path: resolve(output, "wallet-login.png") });
  await page.goto(base + "/showcase");
  await page.waitForTimeout(900);
  const frameDirectory = resolve(
    process.env.AUGUR_AUDIT_FRAMES || "../.presentation-frames",
  );
  await mkdir(frameDirectory, { recursive: true });
  await page.getByRole("button", { name: "Start cycles" }).click();
  for (let frame = 0; frame < 24; frame++) {
    await page.screenshot({
      path: resolve(
        frameDirectory,
        `showcase-${String(frame).padStart(3, "0")}.png`,
      ),
    });
    await page.waitForTimeout(350);
  }
  await page.getByRole("button", { name: "Stop cycles" }).click();
  if (!(await page.getByText("Cycles paused").isVisible()))
    throw new Error("Showcase stop failed");
  await context.close();
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reduced.newPage();
  await reducedPage.goto(base + "/");
  await reducedPage.waitForTimeout(800);
  if (
    !(await reducedPage
      .getByRole("heading", { name: /The next move\.\s*Your position\./ })
      .isVisible())
  )
    throw new Error("Reduced-motion home inaccessible");
  await reduced.close();
  console.log(
    JSON.stringify(
      {
        routeChecks: results.length,
        widths: [1440, 1024, 390, 430],
        allHTTP200: results.every((result) => result.status === 200),
        horizontalOverflow: false,
        consoleErrors: results
          .filter((result) => result.consoleErrors > 0)
          .map(({ route, width, consoleErrors }) => ({
            route,
            width,
            count: consoleErrors,
          })),
        pageErrors: results.flatMap((result) =>
          result.errors.map((error) => ({
            route: result.route,
            width: result.width,
            ...error,
          })),
        ),
        transactionSubmitted: false,
        reducedMotion: "PASS",
        showcase: "PASS",
        videoErrorState: "PASS",
        fullscreen,
        privyLoginDialog: loginDialog > 0,
        authenticatedVerification: "MANUAL",
      },
      null,
      2,
    ),
  );
  if (results.some((result) => result.errors.length || result.consoleErrors))
    throw new Error(
      "Browser page errors detected; inspect the safe state report",
    );
} finally {
  await browser.close();
}
