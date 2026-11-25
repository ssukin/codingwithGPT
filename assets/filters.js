// Find & save rules (story: Find by interest). Pure functions: no DOM, no storage.
// Loaded in the browser as window.MuseumFilters and in Node tests with require().
//
// Cases, and how each is handled:
// - Filters combine (AND): category, status (Not marked / Want to visit / Visited), location and search.
// - Search ignores case and surrounding spaces and matches full and short titles, not descriptions:
//   "American History" finds two museums, so the visitor picks the card.
// - Animals is a curated list (Zoo, Natural History); a new animal museum must be added to ANIMAL_MUSEUM_IDS.
// - "Art & history" (Portrait Gallery) counts as Art, not History: History matches the capitalised word.
// - No matches: the view offers "Clear filters", which restores all 13.
(function (root) {
  "use strict";

  // Animals is an editorial list, not a source category: add a museum here when it teaches about animals.
  const ANIMAL_MUSEUM_IDS = new Set(["national-zoo", "natural-history"]);

  const CATEGORY_RULES = {
    Art: (museum) => museum.category.startsWith("Art"),
    History: (museum) => museum.category.includes("History"),
    Science: (museum) => museum.category.startsWith("Science"),
    Animals: (museum) => ANIMAL_MUSEUM_IDS.has(museum.id)
  };
  const CATEGORIES = Object.keys(CATEGORY_RULES);

  function museumTitleMatches(museum, query) {
    const term = String(query || "").trim().toLowerCase();
    return `${museum.name} ${museum.shortName}`.toLowerCase().includes(term);
  }

  // "All" and anything unrecognised leave the list unfiltered.
  function categoryMatcher(category) {
    return CATEGORY_RULES[category] || (() => true);
  }

  // criteria: { category, status, location, search, wishlistOnly }; statusOf(museum) -> "Visited" | "Want to visit" | "Not marked"
  function filterMuseums(museums, criteria, statusOf) {
    const { category = "All", status = "All", location = "All", search = "", wishlistOnly = false } = criteria;
    return museums.filter((museum) =>
      (!wishlistOnly || statusOf(museum) === "Want to visit") &&
      categoryMatcher(category)(museum) &&
      (status === "All" || statusOf(museum) === status) &&
      (location === "All" || museum.area === location) &&
      (!search.trim() || museumTitleMatches(museum, search)));
  }

  const api = { CATEGORIES, ANIMAL_MUSEUM_IDS, museumTitleMatches, categoryMatcher, filterMuseums };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MuseumFilters = api;
})(typeof window !== "undefined" ? window : globalThis);
