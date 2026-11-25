const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright-core");

const app = pathToFileURL(path.resolve(__dirname, "../index.html")).href;
const key = "museum-rankings-v1";
let browser;
before(async () => { browser = await chromium.launch({ channel: "chrome", headless: true }); });
after(async () => { await browser?.close(); });

async function openNotebook(t) {
  const context = await browser.newContext();
  t.after(() => context.close());
  await context.route(/^https?:/, route => route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(app);
  return page;
}

test("integration: stored single-companion visits still display and survive a note edit", async t => {
  const page = await openNotebook(t);
  const visit = { id: "visit-1", museumId: "american-history", visitedOn: "2026-10-01", note: "first", companionId: "sam" };
  await page.evaluate(({key, visit}) => localStorage.setItem(key, JSON.stringify({
    visits: [visit], wishlist: [], ranking: [visit.museumId]
  })), { key, visit });
  await page.reload();
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await page.locator(".rank-visits summary").click();
  assert.match(await page.locator(".rank-visits").innerText(), /Went with Sam/);
  await page.locator('[data-action="edit-visit-note"]').click();
  await page.locator("#edit-visit-note-form textarea").fill("updated");
  await page.locator("#edit-visit-note-form button[type=submit]").click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(saved.visits.length, 1);
  assert.deepEqual(saved.visits[0].companionIds, ["sam"]);
  assert.equal(saved.visits[0].note, "updated");
});

test("system: reject unknown friends, recover a failed save, and recall Sam after reload", async t => {
  const page = await openNotebook(t);
  await page.locator('[data-action="toggle-save"][data-id="american-history"]').click();
  await page.locator('[data-action="open-visit"][data-id="american-history"]').click();
  const search = page.getByRole("combobox", { name: "Who went with you?" });
  await search.fill("Sarah");
  assert.equal(await page.locator('[data-action="select-visit-friend"]').count(), 0);
  await search.fill("Sam");
  await page.locator('[data-action="select-visit-friend"][data-friend-id="sam"]').click();
  // Simulate one quota failure, then let the visitor retry on the same form.
  await page.evaluate(key => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, value) {
      if (k === key) {
        Storage.prototype.setItem = write;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return write.call(this, k, value);
    };
  }, key);
  const save = page.getByRole("button", { name: "Save visit", exact: true });
  await save.click();
  assert.equal(await save.isVisible(), true, "Keep the visit form open when the write fails");
  const beforeRetry = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.deepEqual(beforeRetry.wishlist, ["american-history"]);
  assert.equal(beforeRetry.visits.length, 0);
  await save.click();
  await page.reload();
  await page.getByRole("button", { name: "Ranking", exact: true }).click();
  await page.locator(".rank-visits summary").click();
  assert.match(await page.locator(".rank-visits").innerText(), /Went with Sam/);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  assert.equal(saved.visits.length, 1, "retry must record the visit exactly once");
  assert.deepEqual(saved.wishlist, []);
  assert.deepEqual(saved.ranking, ["american-history"]);
});
