// Compare & correct rules. Pure functions over arrays of museum IDs: they never change their inputs,
// touch the DOM or storage. The comparison dialog (ui-dialogs.js) calls them one choice at a time.
//
// Cases, and how each is handled (tests in tests/rules.test.cjs and tests/ranking-browser.test.cjs):
// - No visits: nothing to rank; Ranking shows "Your ranking starts with a visit".
// - First museum ever: ranked first with no question (placeByChoices asks 0 questions).
// - Second museum: one question; the winner goes first (seed).
// - Third and later: binary insertion against the current order, at most ceil(log2(n + 1)) questions.
// - Repeat visit to a ranked museum: adds history only; the rank is unchanged (pendingIds ignores it).
// - "Feels like a tie": no tie button by design. The visitor picks either; moveRank fixes it later.
// - Changed preference: moveRank swaps with a neighbour; the ends and unknown IDs are no-ops.
// - Last visit to a museum removed: that museum leaves the ranking (app.js deleteVisit).
// - A save fails mid-comparison: the session stops and the museum stays "to place" (ui-dialogs.js).
// - Two museums can never share a position, and no history of choices is kept, only the final order.
(function (root) {
  "use strict";

  // Visited museums that are not ranked yet, in first-visit order.
  function pendingIds(visits, ranking) {
    return [...new Set(visits.map((visit) => visit.museumId))].filter((id) => !ranking.includes(id));
  }

  // Binary insertion. A search keeps the open range [low, high) of positions where the candidate can go;
  // each choice halves it, so placing one museum among n ranked ones takes at most ceil(log2(n + 1)) choices.
  function startSearch(ranking) {
    return { low: 0, high: ranking.length };
  }
  function isPlaced(search) {
    return search.low >= search.high;
  }
  function opponentIndex(search) {
    return Math.floor((search.low + search.high) / 2);
  }
  function narrow(search, candidateWon) {
    const middle = opponentIndex(search);
    return candidateWon ? { low: search.low, high: middle } : { low: middle + 1, high: search.high };
  }
  function insertAt(ranking, id, index) {
    return [...ranking.slice(0, index), id, ...ranking.slice(index)];
  }

  // The whole insertion in one call, given a way to answer each question. Used by tests and as a reference.
  function placeByChoices(ranking, candidate, prefersCandidate) {
    let search = startSearch(ranking), asked = 0;
    while (!isPlaced(search)) {
      search = narrow(search, prefersCandidate(candidate, ranking[opponentIndex(search)]));
      if (++asked > ranking.length) throw new Error("binary insertion did not converge");
    }
    return { ranking: insertAt(ranking, candidate, search.low), asked };
  }

  // The first two museums: the winner goes first.
  function seed(first, second, winnerId) {
    return winnerId === second ? [second, first] : [first, second];
  }

  // Swap with the neighbour above or below; at either end the ranking is returned unchanged.
  function moveRank(ranking, id, direction) {
    const index = ranking.indexOf(id);
    const destination = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || destination < 0 || destination >= ranking.length) return ranking;
    const next = [...ranking];
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  }

  // Friends' average: each museum's mean position among the friends who ranked it. Friends who
  // didn't rank a museum add nothing, so one friend's #1 can top the list (shown with its count).
  function friendAverages(friends) {
    const positions = new Map();
    friends.forEach((friend) => friend.ranking.forEach((id, index) => {
      positions.set(id, [...(positions.get(id) || []), index + 1]);
    }));
    return [...positions.entries()]
      .map(([id, list]) => ({ id, average: list.reduce((sum, p) => sum + p, 0) / list.length, raters: list.length }))
      .sort((a, b) => a.average - b.average || b.raters - a.raters);
  }

  const api = { pendingIds, startSearch, isPlaced, opponentIndex, narrow, insertAt, placeByChoices, seed, moveRank, friendAverages };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RankingRules = api;
})(typeof window !== "undefined" ? window : globalThis);
