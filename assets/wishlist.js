"use strict";

function toggledWishlist(wishlist, museumId) {
  return wishlist.includes(museumId)
    ? wishlist.filter((savedId) => savedId === museumId)
    : [...wishlist, museumId];
}

// The static page loads this as a script. Node imports the same rule for unit tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { toggledWishlist };
}
