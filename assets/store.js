// The notebook model: what is kept in this browser and how it is read back. No DOM.
// Relationships (has-a, by ID): a notebook has many saved IDs, many visits and one ordered ranking;
// each visit belongs to one museum and has zero or more companion IDs; each ranking entry is one museum.
// Data rules: a visit needs a known museum; a visited museum leaves the wishlist; unknown IDs are dropped on load.
// A notebook is { displayName, wishlist: [museumId], visits: [{ id, museumId, visitedOn, note, companionIds }], ranking: [museumId] }.
(function (root) {
  "use strict";

  const STORAGE_KEY = "museum-rankings-v1";
  const FRIENDS_STORAGE_KEY = "museum-rankings-demo-friends";
  const EMPTY = Object.freeze({ displayName: "", wishlist: [], visits: [], ranking: [] });

  // Older visits stored a single `companionId`; newer ones store `companionIds`.
  function normalizeCompanionIds(visit) {
    const ids = Array.isArray(visit.companionIds)
      ? visit.companionIds
      : (typeof visit.companionId === "string" && visit.companionId ? [visit.companionId] : []);
    return [...new Set(ids)].filter((id) => typeof id === "string");
  }

  // Unknown museums are dropped; a visited museum leaves the wishlist.
  function loadNotebook(storage, knownMuseum) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
      const visits = Array.isArray(parsed.visits)
        ? parsed.visits.filter((visit) => visit && knownMuseum(visit.museumId))
          .map((visit) => ({ ...visit, companionIds: normalizeCompanionIds(visit) }))
        : [];
      return {
        displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
        wishlist: Array.isArray(parsed.wishlist)
          ? parsed.wishlist.filter((id) => knownMuseum(id) && !visits.some((visit) => visit.museumId === id))
          : [],
        visits,
        ranking: Array.isArray(parsed.ranking) ? parsed.ranking.filter(knownMuseum) : []
      };
    } catch {
      return { ...EMPTY };
    }
  }

  // Returns false when the browser refuses the write (full, blocked or private mode); callers keep the old notebook.
  function persistNotebook(storage, notebook) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(notebook));
      return true;
    } catch {
      return false;
    }
  }

  function loadAddedFriendIds(storage) {
    try {
      const ids = JSON.parse(storage.getItem(FRIENDS_STORAGE_KEY) || "[]");
      return Array.isArray(ids) ? ids : [];
    } catch { return []; }
  }
  function saveAddedFriendIds(storage, ids) {
    try { storage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(ids)); return true; } catch { return false; }
  }

  const api = { STORAGE_KEY, FRIENDS_STORAGE_KEY, EMPTY, normalizeCompanionIds, loadNotebook, persistNotebook, loadAddedFriendIds, saveAddedFriendIds };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NotebookStore = api;
})(typeof window !== "undefined" ? window : globalThis);
