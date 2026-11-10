const assert = require("node:assert/strict");
const test = require("node:test");
const { openMuseumSite } = require("./browser.cjs");

test("a visitor can save a museum, find it after reload, and remove it", async (t) => {
  const { page, url } = await openMuseumSite(t);
  const museumName = "American History";
  const savedView = page.getByRole("button", { name: "Want to visit", exact: true });
  const savedMuseum = page.getByRole("heading", { name: museumName, exact: true });

  await page.goto(url);
  await page.getByRole("button", { name: `Save ${museumName} to Want to visit`, exact: true }).click();
  await page.reload();
  await savedView.click();
  assert.equal(await savedMuseum.isVisible(), true, "The saved museum should appear after reload");

  await page.getByRole("button", { name: `Remove ${museumName} from Want to visit`, exact: true }).click();
  await page.reload();
  await savedView.click();
  assert.equal(await savedMuseum.count(), 0, "The removed museum should stay absent after reload");
  assert.equal(await page.getByRole("heading", { name: "Nothing saved yet" }).isVisible(), true);
});
