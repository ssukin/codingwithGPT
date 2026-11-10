const assert = require("node:assert/strict");
const test = require("node:test");
const { toggledWishlist } = require("../assets/wishlist.js");

test("toggledWishlist adds and removes only the selected museum", () => {
  const saved = Object.freeze(["natural-history"]);
  const afterSave = toggledWishlist(saved, "american-history");
  assert.deepEqual(afterSave, ["natural-history", "american-history"],
    "Saving American History should retain Natural History and add American History");

  const afterRemove = toggledWishlist(afterSave, "american-history");
  assert.deepEqual(afterRemove, ["natural-history"],
    "Removing American History should retain Natural History and remove American History");
});
