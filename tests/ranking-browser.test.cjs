// System test for Compare & correct: log two museums, choose a favourite, reorder, reload, and check
// that the order and the pilot event log survive.
const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");

const app = pathToFileURL(path.resolve(__dirname, "../index.html")).href;
let browser;
before(async () => { browser = await chromium.launch({ channel: "chrome", headless: true }); });
after(async () => { await browser?.close(); });

async function logVisit(page, museumId) {
  await page.locator(`[data-action="open-visit"][data-id="${museumId}"]`).click();
  await page.getByRole("button", { name: "Save visit", exact: true }).click();
}
const rankedNames = (page) => page.locator(".rank-item h3").allInnerTexts();

test("system: choose a favourite, correct the order, and keep it after reload", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route(/^https?:/, (route) => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(app);

  await logVisit(page, "american-history");                       // first museum: ranked with no choice
  await logVisit(page, "natural-history");                        // second: one head-to-head choice
  await page.locator('[data-action="choose-comparison"][data-winner="natural-history"]').click();
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  assert.deepEqual(await rankedNames(page), ["Natural History", "American History"]);

  await page.getByRole("button", { name: "Move American History up" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  assert.deepEqual(await rankedNames(page), ["American History", "Natural History"]);

  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("museum-rankings-events-v1")).map((e) => e.name));
  for (const name of ["visit_logged", "comparison_completed", "rank_moved", "ranking_viewed"]) assert.ok(events.includes(name), name);
});
