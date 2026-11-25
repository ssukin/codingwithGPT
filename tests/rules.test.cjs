// Unit tests: the Find & save and Compare & correct rules, and the event log, without a browser.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { filterMuseums, categoryMatcher, museumTitleMatches } = require("../assets/filters.js");
const R = require("../assets/ranking.js");
const { createEventLog, EVENTS_KEY } = require("../assets/events.js");

// The real catalog, loaded the way the browser loads it.
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../assets/museums.js"), "utf8"), sandbox);
const museums = JSON.parse(JSON.stringify(sandbox.window.MUSEUMS)); // plain data in this test's own realm
const ids = (list) => list.map((museum) => museum.id).sort();
const none = () => "Not marked";

test("find: Animals shows exactly the Zoo and Natural History; Art replaces it; clearing restores all 13", () => {
  assert.deepEqual(ids(filterMuseums(museums, { category: "Animals" }, none)), ["national-zoo", "natural-history"]);
  const art = filterMuseums(museums, { category: "Art" }, none);
  assert.ok(art.length > 0 && art.every((museum) => museum.category.startsWith("Art")));
  assert.equal(filterMuseums(museums, { category: "All" }, none).length, 13);
});

test("find: an unknown category no longer falls through to Animals", () => {
  assert.equal(museums.filter(categoryMatcher("Dinosaurs")).length, 13);
});

test("find: search trims, ignores case, and matches both full and short titles", () => {
  const found = filterMuseums(museums, { search: "  american HISTORY " }, none);
  assert.deepEqual(ids(found), ["african-american-history", "american-history"]);
  assert.equal(filterMuseums(museums, { search: "no such museum" }, none).length, 0);
  assert.ok(museumTitleMatches(museums.find((m) => m.id === "national-zoo"), "zoo"));
});

test("find: Want to visit shows only saved museums", () => {
  const statusOf = (museum) => (museum.id === "american-history" ? "Want to visit" : "Not marked");
  assert.deepEqual(ids(filterMuseums(museums, { wishlistOnly: true }, statusOf)), ["american-history"]);
});

test("compare: binary insertion recovers any true order, in at most ceil(log2(n+1)) choices per museum", () => {
  const truth = museums.map((museum) => museum.id); // pretend this is the visitor's real preference
  const prefers = (a, b) => truth.indexOf(a) < truth.indexOf(b);
  const visitOrder = [...truth].reverse().sort((a, b) => a.length - b.length); // a scrambled visit order
  let ranking = [];
  for (const id of visitOrder) {
    const placed = R.placeByChoices(ranking, id, prefers);
    assert.ok(placed.asked <= Math.ceil(Math.log2(ranking.length + 1)), `too many choices for ${id}`);
    ranking = placed.ranking;
  }
  assert.deepEqual(ranking, truth);
});

test("compare: first museum needs no choice; the seed puts the winner first; inputs are never changed", () => {
  assert.deepEqual(R.placeByChoices([], "hirshhorn", () => true), { ranking: ["hirshhorn"], asked: 0 });
  assert.deepEqual(R.seed("a", "b", "b"), ["b", "a"]);
  const ranking = Object.freeze(["a", "b", "c"]);
  assert.deepEqual(R.insertAt(ranking, "x", 1), ["a", "x", "b", "c"]);
  assert.deepEqual(R.moveRank(ranking, "c", "up"), ["a", "c", "b"]);
});

test("correct: moving past either end, or an unranked museum, changes nothing", () => {
  const ranking = ["a", "b"];
  assert.equal(R.moveRank(ranking, "a", "up"), ranking);
  assert.equal(R.moveRank(ranking, "b", "down"), ranking);
  assert.equal(R.moveRank(ranking, "z", "up"), ranking);
});

test("compare: a repeat visit adds no pending museum", () => {
  const visits = [{ museumId: "a" }, { museumId: "a" }, { museumId: "b" }];
  assert.deepEqual(R.pendingIds(visits, ["a"]), ["b"]);
});

test("friends' average counts only friends who ranked a museum, and says how many", () => {
  const averages = R.friendAverages([{ ranking: ["x", "y"] }, { ranking: ["y", "x", "z"] }]);
  assert.deepEqual(averages.map((a) => [a.id, a.average, a.raters]), [["x", 1.5, 2], ["y", 1.5, 2], ["z", 3, 1]]);
});

test("event log keeps OEC events with museum IDs only, ignores unknown names, and caps its size", () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const log = createEventLog(storage, () => "2026-11-25T12:00:00Z");
  log.record("visit_logged", "american-history");
  assert.equal(log.record("note_text", "secret"), null);
  assert.deepEqual(JSON.parse(data.get(EVENTS_KEY)), [{ name: "visit_logged", at: "2026-11-25T12:00:00Z", museumId: "american-history" }]);
  for (let i = 0; i < 600; i++) log.record("website_opened", "hirshhorn");
  assert.equal(log.read().length, 500);
  assert.deepEqual(log.summary(), { website_opened: 500 });
});
