const test = require("node:test");
const assert = require("node:assert/strict");
const { selectedFriendIds } = require("../assets/visit-friends.js");

test("only current friends can be tagged, once each in selection order", () => {
  const friends = [{ id: "sam" }, { id: "alex" }];
  assert.deepEqual(selectedFriendIds(["alex", "sarah", "sam", "alex"], friends), ["alex", "sam"]);
  assert.deepEqual(selectedFriendIds(["sam"], []), []);
});

