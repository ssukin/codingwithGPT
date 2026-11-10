const assert = require("node:assert/strict");
const test = require("node:test");
const { openMuseumSite } = require("./browser.cjs");

test("the wishlist handler writes the selected museum and renders the saved list", async (t) => {
  const { page, url } = await openMuseumSite(t);
  const storageKey = "museum-rankings-v1";
  const museumFixture = [
    { id: "test-art", name: "Test Art Museum", shortName: "Test Art", category: "Art" },
    { id: "test-history", name: "Test History Museum", shortName: "Test History", category: "History" }
  ];
  await page.route("**/assets/museums.js", (route) => route.fulfill({
    contentType: "text/javascript",
    body: `window.MUSEUMS = ${JSON.stringify(museumFixture)};`
  }));
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ wishlist: ["test-history"] }));
  }, storageKey);
  await page.goto(url);

  // Invoke the page's real click handler without relying on pointer interaction.
  await page.locator('[data-action="toggle-save"][data-id="test-art"]').evaluate((button) => button.click());
  const storedWishlist = () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).wishlist, storageKey);
  assert.deepEqual(await storedWishlist(), ["test-history", "test-art"],
    "The handler should persist the selected museum ID alongside the existing ID");

  await page.locator('[data-action="museum-scope"][data-scope="wishlist"]').evaluate((button) => button.click());
  const savedHeadings = page.locator("#museum-grid article h3");
  assert.deepEqual(await savedHeadings.allTextContents(), ["Test Art", "Test History"]);

  await page.locator('[data-action="toggle-save"][data-id="test-art"]').evaluate((button) => button.click());
  assert.deepEqual(await storedWishlist(), ["test-history"]);
  assert.deepEqual(await savedHeadings.allTextContents(), ["Test History"]);
});
