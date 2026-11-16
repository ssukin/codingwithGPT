(() => {
  "use strict";

  const STORAGE_KEY = "museum-rankings-v1";
  const VISIT_NOTE_LIMIT = 500;
  const museums = window.MUSEUMS || [];
  const byId = new Map(museums.map((museum) => [museum.id, museum]));
  const content = document.querySelector("#view-content");
  const toast = document.querySelector("#toast");
  const museumDialog = document.querySelector("#museum-dialog");
  const visitDialog = document.querySelector("#visit-dialog");
  const compareDialog = document.querySelector("#compare-dialog");
  const addFriendsDialog = document.querySelector("#add-friends-dialog");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  let state = loadState();
  let currentView = "discover";
  let activeCategory = "All";
  let activeMuseumStatus = "All";
  let activeLocation = "All";
  let searchTerm = "";
  let comparisonSession = null;
  let discoverDisplay = "list";
  let mapInstance = null;
  let mapMarkers = null;
  let toastTimer;
  let selectedVisitCompanionIds = [];

  let demoFriends = [
    { id: "alex", name: "Alex", submittedVisits: 18, ranking: ["natural-history", "air-and-space", "american-history", "national-zoo"] },
    { id: "sam", name: "Sam", submittedVisits: 9, ranking: ["national-zoo", "natural-history", "hirshhorn", "american-history"] },
    { id: "jordan", name: "Jordan", submittedVisits: 12, ranking: ["american-history", "african-american-history", "african-art", "natural-history"] }
  ];
  const suggestedFriends = [
    { id: "taylor", name: "Taylor", submittedVisits: 7, ranking: ["hirshhorn", "american-history", "natural-history", "african-art"] },
    { id: "morgan", name: "Morgan", submittedVisits: 16, ranking: ["air-and-space", "national-zoo", "american-history", "natural-history"] },
    { id: "casey", name: "Casey", submittedVisits: 11, ranking: ["african-art", "natural-history", "american-history", "hirshhorn"] },
    { id: "riley", name: "Riley", submittedVisits: 5, ranking: ["natural-history", "hirshhorn", "air-and-space", "national-zoo"] }
  ];
  try {
    const savedFriendIds = JSON.parse(localStorage.getItem("museum-rankings-demo-friends") || "[]");
    if (Array.isArray(savedFriendIds)) savedFriendIds.forEach((id) => {
      const friend = suggestedFriends.find((suggestion) => suggestion.id === id);
      if (friend && !demoFriends.some((existing) => existing.id === friend.id)) demoFriends.push(friend);
    });
  } catch {}
  let rankingMode = "mine";
  let rankingSearchTerm = "";
  let leaderboardSearchTerm = "";
  let addFriendSearchTerm = "";

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      const visits = Array.isArray(parsed.visits) ? parsed.visits.filter((visit) => visit && byId.has(visit.museumId)).map((visit) => ({
        ...visit,
        companionIds: [...new Set(Array.isArray(visit.companionIds) ? visit.companionIds : (typeof visit.companionId === "string" && visit.companionId ? [visit.companionId] : []))].filter((id) => typeof id === "string")
      })) : [];
      return {
        displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
        wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist.filter((id) => byId.has(id) && !visits.some((visit) => visit.museumId === id)) : [],
        visits,
        ranking: Array.isArray(parsed.ranking) ? parsed.ranking.filter((id) => byId.has(id)) : []
      };
    } catch {
      return { displayName: "", wishlist: [], visits: [], ranking: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      showToast("This browser could not save your changes. Check its storage settings.");
      return false;
    } finally {
      updateHeader();
    }
    return true;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function dateLabel(value, options = { month: "short", day: "numeric", year: "numeric" }) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.valueOf()) ? "Date not set" : new Intl.DateTimeFormat("en-US", options).format(date);
  }

  function uniqueVisitedIds() {
    return [...new Set(state.visits.map((visit) => visit.museumId))];
  }

  function visitCountFor(id) {
    return state.visits.filter((visit) => visit.museumId === id).length;
  }

  function museumStatus(museum) {
    if (visitCountFor(museum.id) > 0) return "Visited";
    if (state.wishlist.includes(museum.id)) return "Want to visit";
    return "Not marked";
  }

  function visitDescription(visit) {
    const parts = [dateLabel(visit.visitedOn)];
    if (visit.note) parts.push(escapeHtml(visit.note));
    const companionIds = Array.isArray(visit.companionIds) ? visit.companionIds : (visit.companionId ? [visit.companionId] : []);
    const names = companionIds.map((id) => demoFriends.find((friend) => friend.id === id)?.name).filter(Boolean).map(escapeHtml);
    if (names.length === 1) parts.push(`Went with ${names[0]}`);
    else if (names.length === 2) parts.push(`Went with ${names[0]} and ${names[1]}`);
    else if (names.length > 2) parts.push(`Went with ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`);
    return parts.join(" · ");
  }

  function renderVisitFriendSuggestions(query = "") {
    const normalizedQuery = query.trim().toLowerCase();
    const featuredOrder = ["sam", "alex", "jordan"];
    const friends = demoFriends
      .filter((friend) => friend.id && !selectedVisitCompanionIds.includes(friend.id) && friend.name.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => {
        const firstOrder = featuredOrder.indexOf(first.id);
        const secondOrder = featuredOrder.indexOf(second.id);
        return (firstOrder < 0 ? featuredOrder.length : firstOrder) - (secondOrder < 0 ? featuredOrder.length : secondOrder);
      });
    return friends.length
      ? friends.map((friend) => `<button class="friend-typeahead-option" type="button" role="option" data-action="select-visit-friend" data-friend-id="${escapeHtml(friend.id)}">${escapeHtml(friend.name)}</button>`).join("")
      : `<p class="friend-typeahead-empty">No friends found.</p>`;
  }

  function renderSelectedVisitFriends() {
    const selection = document.querySelector("#visit-friend-selection");
    if (!selection) return;
    selection.innerHTML = selectedVisitCompanionIds.map((id) => {
      const friend = demoFriends.find((existing) => existing.id === id);
      return friend ? `<span class="visit-friend-pill">${escapeHtml(friend.name)}<button type="button" data-action="remove-visit-friend" data-friend-id="${escapeHtml(friend.id)}" aria-label="Remove ${escapeHtml(friend.name)}">×</button></span>` : "";
    }).join("");
  }

  function updateHeader() {
    const name = state.displayName.trim();
    document.querySelector("#profile-label").textContent = name || "My profile";
    document.querySelector("#profile-avatar").textContent = name ? name[0].toUpperCase() : "M";
  }

  function setView(view) {
    currentView = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
      if (button.classList.contains("nav-link")) {
        if (button.dataset.view === view) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      }
    });
    renderView();
    document.querySelector("#main-content").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2800);
  }

  function cardMarkup(museum) {
    const visits = visitCountFor(museum.id);
    const saved = visits === 0 && state.wishlist.includes(museum.id);
    return `<article class="museum-card accent-${museum.accent}">
      <div class="card-art ${museum.photo ? "has-photo" : ""}">
        ${museum.photo ? `<img class="card-photo" src="${escapeHtml(museum.photo)}" alt="" loading="lazy" decoding="async"><span class="photo-credit">Photo: <a href="${escapeHtml(museum.photoSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(museum.photoCredit)}</a> · <a href="${escapeHtml(museum.photoLicense)}" target="_blank" rel="noopener noreferrer">${escapeHtml(museum.photoLicenseLabel)}</a></span>` : `<span class="card-monogram" aria-hidden="true">${escapeHtml(museum.monogram)}</span><span class="card-icon" aria-hidden="true">${escapeHtml(museum.icon)}</span>`}
        ${visits ? "" : `<button class="save-toggle" type="button" data-action="toggle-save" data-id="${museum.id}" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(museum.shortName)} ${saved ? "from" : "to"} Want to visit" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>`}
        ${visits ? `<span class="visited-badge"><span aria-hidden="true">✓</span> Visited</span>` : ""}
      </div>
      <div class="card-body">
        <h3>${escapeHtml(museum.shortName)}</h3>
        <p>${escapeHtml(museum.description)}</p>
        <div class="card-actions">
          <span class="card-address">${escapeHtml(museum.area)}</span>
          <span class="card-action-links"><button class="card-detail" type="button" data-action="open-museum" data-id="${museum.id}">Details <span aria-hidden="true">↗</span></button><button class="card-log-visit" type="button" data-action="open-visit" data-id="${museum.id}">Log visit <span aria-hidden="true">＋</span></button></span>
        </div>
      </div>
    </article>`;
  }

  function emptyState(symbol, title, copy, actionLabel, actionView) {
    return `<div class="empty-state">
      <span class="empty-symbol" aria-hidden="true">${symbol}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
      ${actionLabel ? (actionView === "clear-filters" || actionView === "all-museums" ? `<button class="button" type="button" data-action="${actionView === "clear-filters" ? "clear-filters" : "show-all-museums"}">${escapeHtml(actionLabel)}</button>` : `<button class="button" type="button" data-view="${actionView}">${escapeHtml(actionLabel)}</button>`) : ""}
    </div>`;
  }

  function heading(eyebrow, title, description, buttonMarkup = "") {
    return `<div class="section-heading"><div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}<h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${buttonMarkup}</div>`;
  }

  function searchField(id, placeholder, value, { label = placeholder, className = "" } = {}) {
    return `<label class="search-box ${className}"><span class="visually-hidden">${escapeHtml(label)}</span><input class="search-input" id="${escapeHtml(id)}" type="search" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}"></label>`;
  }

  function museumTitleMatches(museum, query) {
    const title = `${museum.name} ${museum.shortName}`.toLowerCase();
    return title.includes(query);
  }

  function filteredMuseums(view) {
    let list = museums;
    if (view === "wishlist") list = list.filter((museum) => museumStatus(museum) === "Want to visit");
    if (activeCategory !== "All") {
      const categoryMatch = activeCategory === "Art"
        ? (museum) => museum.category.startsWith("Art")
        : activeCategory === "History"
          ? (museum) => museum.category.includes("History")
          : activeCategory === "Science"
            ? (museum) => museum.category.startsWith("Science")
            : (museum) => museum.id === "national-zoo" || museum.id === "natural-history";
      list = list.filter(categoryMatch);
    }
    if (activeMuseumStatus !== "All") {
      list = list.filter((museum) => museumStatus(museum) === activeMuseumStatus);
    }
    if (activeLocation !== "All") list = list.filter((museum) => museum.area === activeLocation);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((museum) => museumTitleMatches(museum, term));
    }
    return list;
  }

  function renderDirectory(view) {
    const isWish = view === "wishlist" || activeMuseumStatus === "Want to visit";
    const title = "Discover museums";
    const list = filteredMuseums(view);
    const locations = [...new Set(museums.map((museum) => museum.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const viewToggle = "";
    /* Temporarily hidden; restore when the map view is ready to return.
    const viewToggle = `<div class="directory-actions"><div class="view-toggle" role="group" aria-label="Discover display"><button class="${discoverDisplay === "list" ? "is-active" : ""}" type="button" data-action="discover-display" data-display="list" aria-pressed="${discoverDisplay === "list"}">List</button><button class="${discoverDisplay === "map" ? "is-active" : ""}" type="button" data-action="discover-display" data-display="map" aria-pressed="${discoverDisplay === "map"}">Map</button></div></div>`;
    */
    const results = list.length ? list.map(cardMarkup).join("") : isWish && state.wishlist.length === 0
      ? emptyState("♡", "Nothing saved yet", "Use the heart on a museum to add it here.", "Browse all museums", "all-museums")
      : emptyState("⌕", "No matches yet", "Try a different search or clear the topic filter.", "Clear filters", "clear-filters");
    return `${heading("", title, "")}
      <div class="toolbar">${searchField("museum-search", "Search museums", searchTerm)}
        <div class="filter-controls"><span class="filter-by-label">Filter by</span><label class="visually-hidden" for="museum-status-filter">Filter by status</label><select class="directory-filter" id="museum-status-filter">${["All", "Not marked", "Want to visit", "Visited"].map((status) => `<option value="${status}" ${activeMuseumStatus === status ? "selected" : ""}>${status === "All" ? "Any status" : status}</option>`).join("")}</select><label class="visually-hidden" for="category-filter">Filter by category</label><select class="directory-filter" id="category-filter"><option value="All" ${activeCategory === "All" ? "selected" : ""}>Any category</option>${["Art", "History", "Science", "Animals"].map((filter) => `<option value="${filter}" ${activeCategory === filter ? "selected" : ""}>${filter}</option>`).join("")}</select><label class="visually-hidden" for="location-filter">Filter by location</label><select class="directory-filter" id="location-filter"><option value="All" ${activeLocation === "All" ? "selected" : ""}>Any location</option>${locations.map((location) => `<option value="${escapeHtml(location)}" ${activeLocation === location ? "selected" : ""}>${escapeHtml(location)}</option>`).join("")}</select></div>${viewToggle}
      </div>
      <p class="result-count" id="result-count">${list.length} museum${list.length === 1 ? "" : "s"}</p>
      ${discoverDisplay === "map" ? `${list.length ? `<div class="map-frame"><div id="museum-map" class="museum-map" aria-label="Map of Smithsonian museums"></div><div class="map-legend"><span class="legend-ranked">1</span> Your rank <span class="legend-unranked">•</span> Unranked</div></div>` : `<div class="museum-grid" id="museum-grid">${results}</div>`}` : `<div class="museum-grid" id="museum-grid">${results}</div>`}`;
  }

  function renderFriends() {
    const addFriendsButton = `<button class="button small" type="button" data-action="open-add-friends">Add friends</button>`;
    return `${heading("", "Leaderboard", "", addFriendsButton)}
      ${searchField("leaderboard-search", "Search friends", leaderboardSearchTerm, { label: "Search leaderboard friends", className: "search-box--standalone" })}
      <div id="leaderboard-results">${renderLeaderboardResults()}</div>`;
  }

  function renderAddFriendsDialog() {
    addFriendsDialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" type="button" data-action="close-add-friends" aria-label="Close add friends">×</button><h2 class="dialog-heading" id="add-friends-title">Add friends</h2>
      ${searchField("add-friend-search", "Search people to add", addFriendSearchTerm, { label: "Search people to add as friends", className: "search-box--standalone" })}
      <div id="add-friend-results">${renderAddFriendResults()}</div></div>`;
    addFriendsDialog.showModal();
    document.querySelector("#add-friend-search")?.focus();
  }

  function renderFriendCard(friend) {
    return `<article class="friend-card is-suggested"><div class="friend-heading"><h3>${escapeHtml(friend.name)}</h3><span class="friend-visit-count">${friend.submittedVisits} visits</span></div><button class="button small" type="button" data-action="add-friend" data-friend-id="${friend.id}">Add friend</button></article>`;
  }

  function renderLeaderboardResults() {
    const query = leaderboardSearchTerm.trim().toLowerCase();
    const friends = demoFriends.filter((friend) => !query || friend.name.toLowerCase().includes(query));
    const orderedFriends = [...friends].sort((a, b) => b.submittedVisits - a.submittedVisits);
    return orderedFriends.length
      ? `<ol class="friends-average-list friends-visits-list">${orderedFriends.map((friend) => `<li><span class="average-museum">${escapeHtml(friend.name)}</span><span class="visit-total"><strong>${friend.submittedVisits}</strong><span>visits</span></span></li>`).join("")}</ol>`
      : `<p class="friend-empty">No friends found.</p>`;
  }

  function renderAddFriendResults() {
    const query = addFriendSearchTerm.trim().toLowerCase();
    if (!query) return "";
    const friendIds = new Set(demoFriends.map((friend) => friend.id).filter(Boolean));
    const suggestions = suggestedFriends.filter((friend) => friend.name.toLowerCase().includes(query) && !friendIds.has(friend.id));
    return suggestions.length
      ? `<div class="friend-suggestions">${suggestions.map(renderFriendCard).join("")}</div>`
      : `<p class="friend-empty">No people to add found.</p>`;
  }

  function renderFriendRankingResults() {
    const query = rankingSearchTerm.trim().toLowerCase();
    const averageRanks = new Map();
    demoFriends.forEach((friend) => friend.ranking.forEach((id, index) => {
      const positions = averageRanks.get(id) || [];
      positions.push(index + 1);
      averageRanks.set(id, positions);
    }));
    const averages = [...averageRanks.entries()].map(([id, positions]) => ({ museum: byId.get(id), average: positions.reduce((sum, position) => sum + position, 0) / positions.length }))
      .filter((item) => item.museum)
      .filter((item) => !query || museumTitleMatches(item.museum, query))
      .sort((a, b) => a.average - b.average);
    return averages.length
      ? `<ol class="friends-average-list">${averages.map((item, index) => `<li><span class="average-rank">${index + 1}</span><span class="average-museum">${escapeHtml(item.museum.shortName)}</span><span class="average-value">${item.average.toFixed(1)} avg</span></li>`).join("")}</ol>`
      : `<p class="friend-empty">No museums found.</p>`;
  }

  function renderMap() {
    const mapElement = document.querySelector("#museum-map");
    if (!mapElement) return;
    if (!window.L) {
      mapElement.innerHTML = "<p class=\"map-unavailable\">Map unavailable. Check your internet connection.</p>";
      return;
    }
    const locations = filteredMuseums("discover").filter((museum) => Array.isArray(museum.coordinates));
    if (!locations.length) return;
    mapInstance = window.L.map(mapElement, { scrollWheelZoom: false }).setView([38.895, -77.025], 13);
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
    mapMarkers = window.L.featureGroup().addTo(mapInstance);
    renderMapMarkers();
    const bounds = mapMarkers.getBounds();
    if (bounds.isValid()) mapInstance.fitBounds(bounds.pad(0.12), { maxZoom: 14 });
    window.setTimeout(() => mapInstance && mapInstance.invalidateSize(), 0);
  }

  function renderMapMarkers() {
    if (!mapMarkers) return;
    mapMarkers.clearLayers();
    filteredMuseums("discover").filter((museum) => Array.isArray(museum.coordinates)).forEach((museum) => {
      const rank = state.ranking.indexOf(museum.id);
      const markerIcon = window.L.divIcon({ className: "", html: `<span class="map-marker ${rank >= 0 ? "is-ranked" : ""}">${rank >= 0 ? rank + 1 : "•"}</span>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      const rankLabel = rank >= 0 ? `Your rank: #${rank + 1}` : "Not ranked yet";
      const popup = `<strong>${escapeHtml(museum.shortName)}</strong><br>${rankLabel}<br><span>${escapeHtml(museum.area)}</span><br><a href="https://www.google.com/maps/dir/?api=1&destination=${museum.coordinates[0]}%2C${museum.coordinates[1]}" target="_blank" rel="noopener noreferrer">Directions</a>`;
      window.L.marker(museum.coordinates, { icon: markerIcon }).bindPopup(popup).addTo(mapMarkers);
    });
  }

  function renderVisits() {
    const sorted = [...state.visits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
    const rows = sorted.map((visit) => {
      const museum = byId.get(visit.museumId);
      if (!museum) return "";
      const visitPhoto = museum.photo
        ? `<a class="mini-art has-photo" href="${escapeHtml(museum.photoSource)}" target="_blank" rel="noopener noreferrer" aria-label="Photo by ${escapeHtml(museum.photoCredit)}, ${escapeHtml(museum.photoLicenseLabel)}. View source and usage terms."><img src="${escapeHtml(museum.photo)}" alt="" loading="lazy" decoding="async"><span aria-hidden="true">↗</span></a>`
        : `<span class="mini-art accent-${museum.accent}" aria-hidden="true">${escapeHtml(museum.monogram)}</span>`;
      return `<article class="visit-row">${visitPhoto}<div><h3>${escapeHtml(museum.shortName)}</h3><p>${visitDescription(visit)}</p></div><div class="visit-row-actions"><button class="button ghost small" type="button" data-action="open-museum" data-id="${museum.id}">Details</button><button class="button ghost small" type="button" data-action="delete-visit" data-id="${visit.id}" data-museum-id="${museum.id}" aria-label="Delete visit to ${escapeHtml(museum.shortName)}">Remove</button></div></article>`;
    }).join("");
    return `${heading("", "My visits", "", `<button class="button small" type="button" data-action="open-visit"><span class="icon" aria-hidden="true">＋</span> Log a visit</button>`)}
      ${sorted.length ? `<div class="visit-list">${rows}</div>` : emptyState("✦", "No visits yet", "Log a museum visit to see it here.", "Browse museums", "discover")}`;
  }

  function renderRanking() {
    const modeToggle = `<div class="ranking-mode-toggle view-toggle" role="group" aria-label="Ranking views"><button class="${rankingMode === "mine" ? "is-active" : ""}" type="button" data-action="ranking-mode" data-mode="mine" aria-pressed="${rankingMode === "mine"}">My ranking</button><button class="${rankingMode === "friends" ? "is-active" : ""}" type="button" data-action="ranking-mode" data-mode="friends" aria-pressed="${rankingMode === "friends"}">Friends’ average</button></div>`;
    if (rankingMode === "friends") {
      return `${heading("", "Ranking", "")}${modeToggle}
        ${searchField("ranking-friends-search", "Search museums", rankingSearchTerm, { className: "search-box--standalone" })}
        <div id="friend-ranking-results">${renderFriendRankingResults()}</div>`;
    }

    const ranked = state.ranking.map((id) => byId.get(id)).filter(Boolean);
    const visitedIds = uniqueVisitedIds();
    const pending = visitedIds.filter((id) => !state.ranking.includes(id));
    const rows = ranked.map((museum, index) => {
      const visits = state.visits.filter((visit) => visit.museumId === museum.id).sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
      const visitHistory = visits.length ? `<details class="rank-visits">
        <summary>${visits.length} visit${visits.length === 1 ? "" : "s"}</summary>
        <ul>${visits.map((visit) => `<li>
          <span>${visitDescription(visit)}</span>
          <button class="text-link" type="button" data-action="edit-visit-note" data-id="${escapeHtml(visit.id)}" aria-label="Edit note for ${escapeHtml(museum.shortName)} on ${dateLabel(visit.visitedOn)}">Edit note</button>
          <button class="text-link" type="button" data-action="delete-visit" data-id="${visit.id}" data-museum-id="${museum.id}">Remove</button>
        </li>`).join("")}</ul>
      </details>` : "";
      return `<li class="rank-item"><span class="rank-number">${index + 1}</span><div class="rank-copy"><h3>${escapeHtml(museum.shortName)}</h3><p>${visits.length} visit${visits.length === 1 ? "" : "s"}</p>${visitHistory}</div><div class="rank-controls"><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="up" aria-label="Move ${escapeHtml(museum.shortName)} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="down" aria-label="Move ${escapeHtml(museum.shortName)} down" ${index === ranked.length - 1 ? "disabled" : ""}>↓</button></div></li>`;
    }).join("");
    const actions = `<div class="ranking-header-actions"><button class="button small" type="button" data-action="open-visit"><span aria-hidden="true">＋</span> Log a visit</button></div>`;
    const body = ranked.length
      ? `<div class="ranking-main"><ol class="rank-list">${rows}</ol>${pending.length ? `<div class="rank-pending"><strong>${pending.length} museum${pending.length === 1 ? "" : "s"} to place.</strong><br>Finish comparing your recent visits to update the ranking.<br><button class="button small" type="button" data-action="start-ranking">Continue ranking</button></div>` : ""}</div>`
      : `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">↕</span><h3>Your ranking starts with a visit</h3><p>Log a visit to add your first museum.</p><button class="button" type="button" data-action="open-visit">Log a visit</button></div>`;
    return `${heading("", "Ranking", "", actions)}${modeToggle}${body}`;
  }

  function renderProfile() {
    const displayName = escapeHtml(state.displayName);
    return `<section class="profile-page"><h2>Sample Name Profile</h2>
      <p>This first version does not use accounts. Your information is stored in this browser on this device. It will not follow you to another browser or sync with friends.</p>
      <form class="profile-form" id="profile-form"><label class="field">What should we call you?<input name="displayName" type="text" maxlength="40" value="${displayName}" placeholder="Your name or nickname" autocomplete="nickname"></label><button class="button" type="submit">Save profile</button></form>
      <p class="privacy-copy"><strong>About your data</strong><br>For now, your list and notes remain in this browser's storage. Clearing browser data will erase them. Sign-in and cross-device sync can be added later.</p>
      <div class="profile-actions"><button class="button danger small" type="button" data-action="clear-data">Clear my saved data</button></div></section>`;
  }

  function renderView() {
    if (mapInstance) mapInstance.remove();
    mapInstance = null;
    mapMarkers = null;
    updateHeader();
    if (currentView === "discover" || currentView === "wishlist") content.innerHTML = renderDirectory(currentView);
    else if (currentView === "ranking") content.innerHTML = renderRanking();
    else if (currentView === "friends") content.innerHTML = renderFriends();
    else if (currentView === "profile") content.innerHTML = renderProfile();
    else if (currentView === "visits") setView("ranking");
    if (currentView === "discover" && discoverDisplay === "map") renderMap();
  }

  function refreshDirectory() {
    if (mapInstance) mapInstance.remove();
    mapInstance = null;
    mapMarkers = null;
    content.innerHTML = renderDirectory(currentView);
    if (currentView === "discover" && discoverDisplay === "map") renderMap();
  }

  function toggleSave(id) {
    const detailWasOpen = museumDialog.open;
    if (state.wishlist.includes(id)) {
      state.wishlist = state.wishlist.filter((savedId) => savedId !== id);
      showToast(`${byId.get(id).shortName} removed from Want to visit.`);
    } else {
      state.wishlist = [...state.wishlist, id];
      showToast(`${byId.get(id).shortName} saved for later.`);
    }
    saveState();
    renderView();
    if (detailWasOpen) openMuseum(id);
  }

  function openMuseum(id) {
    const museum = byId.get(id);
    if (!museum) return;
    const saved = count === 0 && state.wishlist.includes(id);
    const count = visitCountFor(id);
    museumDialog.innerHTML = `<div class="dialog-top-art accent-${museum.accent}" aria-hidden="true"><span class="dialog-monogram">${escapeHtml(museum.monogram)}</span><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close details">×</button></div>
      <div class="dialog-inner"><p class="eyebrow">${escapeHtml(museum.category)} · ${escapeHtml(museum.area)}</p><h2 id="museum-dialog-title">${escapeHtml(museum.name)}</h2><p class="dialog-description">${escapeHtml(museum.description)}</p>
      <div class="museum-facts"><div class="museum-fact"><span aria-hidden="true">⌖</span><span>${escapeHtml(museum.address)}</span></div><div class="museum-fact"><span aria-hidden="true">✦</span><span>${count ? `${count} visit${count === 1 ? "" : "s"} in your history` : "Not visited yet"}</span></div><div class="museum-fact"><span aria-hidden="true">↗</span><a href="${museum.officialUrl}" target="_blank" rel="noopener noreferrer">Official museum information</a></div></div>
      <div class="dialog-actions">${count ? `<span class="museum-status-label">✓ Visited</span>` : `<button class="button ${saved ? "soft" : "secondary"}" type="button" data-action="toggle-save" data-id="${museum.id}">${saved ? "♥ Remove from Want to visit" : "♡ Want to visit"}</button>`}<button class="button" type="button" data-action="open-visit" data-id="${museum.id}">Log a visit <span class="icon" aria-hidden="true">＋</span></button></div></div>`;
    if (!museumDialog.open) museumDialog.showModal();
  }

  function openVisitDialog(museumId = "") {
    if (museumDialog.open) museumDialog.close();
    selectedVisitCompanionIds = [];
    const options = museums.map((museum) => `<option value="${museum.id}" ${museum.id === museumId ? "selected" : ""}>${escapeHtml(museum.shortName)}</option>`).join("");
    visitDialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close visit form">×</button><h2 class="dialog-heading" id="visit-dialog-title">Log a museum visit</h2><p class="dialog-subtitle">Add a date and note. You’ll rank this museum before you finish.</p>
      <form class="visit-form" id="visit-form"><label class="field">Museum<select name="museumId" required><option value="" disabled ${museumId ? "" : "selected"}>Choose a museum</option>${options}</select></label><label class="field">When did you visit?<input type="date" name="visitedOn" value="${today}" max="${today}" required></label><div class="field"><label for="visit-friend-search">Who went with you?</label><div class="visit-friend-typeahead"><div class="visit-friend-picker"><div class="visit-friend-selection" id="visit-friend-selection"></div><input id="visit-friend-search" type="search" placeholder="Search for friends" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="visit-friend-options"></div><div class="visit-friend-options" id="visit-friend-options" role="listbox" hidden></div></div><span>Only people on your friends list can be tagged.</span></div><label class="field">Anything you want to remember?<textarea name="note" maxlength="${VISIT_NOTE_LIMIT}" placeholder="An exhibit, a feeling, a moment… (optional)"></textarea></label><div class="dialog-footer-actions"><button class="button secondary" type="button" data-action="close-dialog">Cancel</button><button class="button" type="submit">Save visit</button></div></form></div>`;
    visitDialog.showModal();
  }

  function openVisitNoteEditor(visitId) {
    const visit = state.visits.find((entry) => entry.id === visitId);
    if (!visit) return;
    const museum = byId.get(visit.museumId);

    visitDialog.innerHTML = `<div class="dialog-inner">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close note editor">×</button>
      <h2 class="dialog-heading" id="visit-dialog-title">Edit visit note</h2>
      <p class="dialog-subtitle">${escapeHtml(museum.shortName)} · ${dateLabel(visit.visitedOn)}</p>
      <form class="visit-form" id="edit-visit-note-form" data-visit-id="${escapeHtml(visitId)}">
        <label class="field">Visit note (optional)<textarea name="note" aria-describedby="visit-note-limit visit-note-error" autofocus></textarea></label>
        <small id="visit-note-limit">Up to ${VISIT_NOTE_LIMIT} characters.</small>
        <div id="visit-note-error" role="alert"></div>
        <div class="dialog-footer-actions">
          <button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
          <button class="button" type="submit">Save note</button>
        </div>
      </form>
    </div>`;
    visitDialog.querySelector("textarea").value = visit.note ?? "";
    visitDialog.showModal();
  }

  function startRanking() {
    const queue = uniqueVisitedIds().filter((id) => !state.ranking.includes(id));
    if (state.ranking.length === 0 && queue.length < 2) {
      if (queue.length === 1) {
        state.ranking = [queue[0]];
        saveState();
        renderView();
        showToast("Your first museum is in the ranking. Visit another to compare it.");
      } else showToast("Log visits to two different museums to begin.");
      return;
    }
    if (queue.length === 0) {
      if (state.ranking.length > 1) {
        comparisonSession = { mode: "recompare", first: state.ranking[0], second: state.ranking[1] };
        renderComparePair(byId.get(comparisonSession.first), byId.get(comparisonSession.second), "recompare");
      } else showToast("Log a visit to another museum to compare your ranking.");
      return;
    }
    if (state.ranking.length === 0) {
      comparisonSession = { mode: "seed", first: queue.shift(), second: queue.shift(), queue };
    } else {
      comparisonSession = { mode: "insert", queue, candidate: null, low: 0, high: 0, opponent: null };
    }
    nextComparison();
  }

  function nextComparison() {
    if (!comparisonSession) return;
    if (comparisonSession.mode === "insert") {
      if (!comparisonSession.candidate) {
        comparisonSession.candidate = comparisonSession.queue.shift();
        comparisonSession.low = 0;
        comparisonSession.high = state.ranking.length;
      }
      if (!comparisonSession.candidate) {
        comparisonSession = null;
        compareDialog.close();
        saveState();
        renderView();
        showToast("Your ranking is up to date.");
        return;
      }
      if (comparisonSession.low >= comparisonSession.high) {
        state.ranking.splice(comparisonSession.low, 0, comparisonSession.candidate);
        comparisonSession.candidate = null;
        saveState();
        nextComparison();
        return;
      }
      const middle = Math.floor((comparisonSession.low + comparisonSession.high) / 2);
      comparisonSession.middle = middle;
      comparisonSession.opponent = state.ranking[middle];
      renderComparePair(byId.get(comparisonSession.candidate), byId.get(comparisonSession.opponent), "insert");
      return;
    }
    renderComparePair(byId.get(comparisonSession.first), byId.get(comparisonSession.second), "seed");
  }

  function renderComparePair(first, second, mode) {
    compareDialog.innerHTML = `<div class="dialog-inner"><p class="eyebrow">Your ranking · head to head</p><h2 class="dialog-heading" id="compare-dialog-title">Which visit did you enjoy more?</h2><p class="dialog-subtitle">Choose the museum you enjoyed more to place it in your ranking.</p><div class="compare-pair">
      <button class="compare-choice accent-${first.accent}" type="button" data-action="choose-comparison" data-winner="${first.id}" data-mode="${mode}"><span class="choice-icon" aria-hidden="true">${escapeHtml(first.monogram)}</span><strong>${escapeHtml(first.shortName)}</strong></button><span class="versus">OR</span>
      <button class="compare-choice accent-${second.accent}" type="button" data-action="choose-comparison" data-winner="${second.id}" data-mode="${mode}"><span class="choice-icon" aria-hidden="true">${escapeHtml(second.monogram)}</span><strong>${escapeHtml(second.shortName)}</strong></button>
      </div></div>`;
    if (!compareDialog.open) compareDialog.showModal();
  }

  function chooseComparison(winnerId, mode) {
    if (!comparisonSession) return;
    if (mode === "recompare") {
      if (winnerId === comparisonSession.second) [state.ranking[0], state.ranking[1]] = [state.ranking[1], state.ranking[0]];
      comparisonSession = null;
      compareDialog.close();
      saveState();
      renderView();
      return;
    }
    if (mode === "seed") {
      const loserId = winnerId === comparisonSession.first ? comparisonSession.second : comparisonSession.first;
      state.ranking = [winnerId, loserId];
      comparisonSession.mode = "insert";
      comparisonSession.candidate = null;
      saveState();
      nextComparison();
      return;
    }
    if (winnerId === comparisonSession.candidate) comparisonSession.high = comparisonSession.middle;
    else comparisonSession.low = comparisonSession.middle + 1;
    nextComparison();
  }

  function skipComparison() {
    if (!comparisonSession) return;
    const wasSeed = comparisonSession.mode === "seed";
    comparisonSession = null;
    compareDialog.close();
    renderView();
    showToast(wasSeed ? "No ranking changed. You can compare these museums another time." : "That museum is still unranked. Continue whenever you're ready.");
  }

  function moveRank(id, direction) {
    const index = state.ranking.indexOf(id);
    const destination = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || destination < 0 || destination >= state.ranking.length) return;
    [state.ranking[index], state.ranking[destination]] = [state.ranking[destination], state.ranking[index]];
    saveState();
    renderView();
  }

  function renderMuseumGrid() {
    const grid = document.querySelector("#museum-grid");
    const counter = document.querySelector("#result-count");
    if (!counter) return;
    const view = currentView;
    const list = filteredMuseums(view);
    counter.textContent = `${list.length} museum${list.length === 1 ? "" : "s"}`;
    if (view === "discover" && discoverDisplay === "map") {
      renderMapMarkers();
      return;
    }
    if (!grid) return;
    grid.innerHTML = list.length ? list.map(cardMarkup).join("") : emptyState("⌕", "No matches yet", "Try a different search or clear the topic filter.", "Clear filters", "clear-filters");
  }

  function handleAction(button) {
    const { action, id } = button.dataset;
    if (action === "toggle-save") toggleSave(id);
    else if (action === "open-museum") openMuseum(id);
    else if (action === "open-visit") openVisitDialog(id || "");
    else if (action === "edit-visit-note") openVisitNoteEditor(id);
    else if (action === "select-visit-friend") {
      const friend = demoFriends.find((existing) => existing.id === button.dataset.friendId);
      const search = document.querySelector("#visit-friend-search");
      const suggestions = document.querySelector("#visit-friend-options");
      if (friend && search && suggestions && !selectedVisitCompanionIds.includes(friend.id)) {
        selectedVisitCompanionIds.push(friend.id);
        renderSelectedVisitFriends();
        search.value = "";
        suggestions.innerHTML = renderVisitFriendSuggestions();
        suggestions.hidden = false;
        search.focus();
        search.setAttribute("aria-expanded", "false");
      }
    } else if (action === "remove-visit-friend") {
      selectedVisitCompanionIds = selectedVisitCompanionIds.filter((friendId) => friendId !== button.dataset.friendId);
      renderSelectedVisitFriends();
      const search = document.querySelector("#visit-friend-search");
      const suggestions = document.querySelector("#visit-friend-options");
      if (search && suggestions) {
        suggestions.innerHTML = renderVisitFriendSuggestions(search.value);
        suggestions.hidden = false;
        search.focus();
        search.setAttribute("aria-expanded", "true");
      }
    } else if (action === "close-dialog") button.closest("dialog").close();
    else if (action === "start-ranking") startRanking();
    else if (action === "move-rank") moveRank(id, button.dataset.direction);
    else if (action === "delete-visit") {
      state.visits = state.visits.filter((visit) => visit.id !== id);
      if (visitCountFor(button.dataset.museumId) === 0) state.ranking = state.ranking.filter((rankedId) => rankedId !== button.dataset.museumId);
      saveState();
      renderView();
      showToast("Visit removed from your history.");
    } else if (action === "choose-comparison") chooseComparison(button.dataset.winner, button.dataset.mode);
    else if (action === "skip-comparison") skipComparison();
    else if (action === "close-comparison") {
      comparisonSession = null;
      compareDialog.close();
      renderView();
    } else if (action === "discover-display") {
      discoverDisplay = button.dataset.display;
      refreshDirectory();
    } else if (action === "show-all-museums") {
      activeCategory = "All";
      activeMuseumStatus = "All";
      activeLocation = "All";
      searchTerm = "";
      refreshDirectory();
    } else if (action === "clear-filters") {
      activeCategory = "All";
      activeMuseumStatus = "All";
      activeLocation = "All";
      searchTerm = "";
      refreshDirectory();
    } else if (action === "ranking-mode") {
      rankingMode = button.dataset.mode;
      content.innerHTML = renderRanking();
    } else if (action === "open-add-friends") {
      addFriendSearchTerm = "";
      renderAddFriendsDialog();
    } else if (action === "close-add-friends") {
      addFriendsDialog.close();
    } else if (action === "add-friend") {
      const friend = suggestedFriends.find((suggestion) => suggestion.id === button.dataset.friendId);
      if (friend && !demoFriends.some((existing) => existing.name.toLowerCase() === friend.name.toLowerCase())) {
        demoFriends.push(friend);
        try {
          localStorage.setItem("museum-rankings-demo-friends", JSON.stringify(demoFriends.filter((existing) => existing.id).map((existing) => existing.id)));
        } catch {}
        leaderboardSearchTerm = "";
        addFriendSearchTerm = "";
        addFriendsDialog.close();
        content.innerHTML = renderFriends();
        showToast(`${friend.name} added to your friends.`);
      }
    } else if (action === "clear-data") {
      if (window.confirm("Clear your saved list, visits, ranking, and profile from this browser? This cannot be undone.")) {
        state = { displayName: "", wishlist: [], visits: [], ranking: [] };
        activeCategory = "All";
        activeMuseumStatus = "All";
        activeLocation = "All";
        searchTerm = "";
        saveState();
        setView("discover");
        showToast("Your browser data has been cleared.");
      }
    }
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".visit-friend-typeahead")) {
      const search = document.querySelector("#visit-friend-search");
      const suggestions = document.querySelector("#visit-friend-options");
      if (suggestions) suggestions.hidden = true;
      if (search) search.setAttribute("aria-expanded", "false");
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) {
      event.preventDefault();
      setView(viewButton.dataset.view);
      return;
    }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) handleAction(actionButton);
  });

  compareDialog.addEventListener("cancel", (event) => {
    if (comparisonSession) event.preventDefault();
  });

  addFriendsDialog.addEventListener("click", (event) => {
    if (event.target === addFriendsDialog) addFriendsDialog.close();
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "visit-friend-search") {
      const search = event.target;
      const suggestions = document.querySelector("#visit-friend-options");
      if (suggestions) {
        suggestions.innerHTML = renderVisitFriendSuggestions(search.value);
        suggestions.hidden = false;
      }
      search.setAttribute("aria-expanded", "true");
    } else if (event.target.id === "museum-search") {
      searchTerm = event.target.value;
      renderMuseumGrid();
    } else if (event.target.id === "leaderboard-search") {
      leaderboardSearchTerm = event.target.value;
      const results = document.querySelector("#leaderboard-results");
      if (results) results.innerHTML = renderLeaderboardResults();
    } else if (event.target.id === "add-friend-search") {
      addFriendSearchTerm = event.target.value;
      const results = document.querySelector("#add-friend-results");
      if (results) results.innerHTML = renderAddFriendResults();
    } else if (event.target.id === "ranking-friends-search") {
      rankingSearchTerm = event.target.value;
      const results = document.querySelector("#friend-ranking-results");
      if (results) results.innerHTML = renderFriendRankingResults();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "museum-status-filter") {
      activeMuseumStatus = event.target.value;
      refreshDirectory();
    } else if (event.target.id === "category-filter") {
      activeCategory = event.target.value;
      refreshDirectory();
    } else if (event.target.id === "location-filter") {
      activeLocation = event.target.value;
      refreshDirectory();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (event.target.id === "visit-friend-search") {
      const suggestions = document.querySelector("#visit-friend-options");
      if (suggestions) {
        suggestions.innerHTML = renderVisitFriendSuggestions(event.target.value);
        suggestions.hidden = false;
      }
      event.target.setAttribute("aria-expanded", "true");
    }
  });

  document.addEventListener("focusout", (event) => {
    if (event.target.id !== "visit-friend-search") return;
    window.setTimeout(() => {
      const search = document.querySelector("#visit-friend-search");
      const suggestions = document.querySelector("#visit-friend-options");
      if (!search || document.activeElement?.closest(".visit-friend-typeahead")) return;
      search.value = "";
      if (suggestions) suggestions.hidden = true;
      search.setAttribute("aria-expanded", "false");
    }, 0);
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "edit-visit-note-form") {
      event.preventDefault();
      const editor = event.target;
      const field = editor.elements.note;
      const error = editor.querySelector("#visit-note-error");
      if (field.value.length > VISIT_NOTE_LIMIT) {
        error.textContent = `Shorten your note to ${VISIT_NOTE_LIMIT} characters or fewer.`;
        field.setAttribute("aria-invalid", "true");
        field.focus();
        return;
      }

      field.removeAttribute("aria-invalid");
      const visitId = editor.dataset.visitId;
      const visit = state.visits.find((entry) => entry.id === visitId);
      if (!visit) return;
      const previousNote = visit.note;
      visit.note = field.value.trim();
      if (!saveState()) {
        visit.note = previousNote;
        error.textContent = "Your note could not be saved in this browser. Try again.";
        return;
      }

      visitDialog.close();
      renderView();
      const editButton = content.querySelector(`[data-action="edit-visit-note"][data-id="${CSS.escape(visitId)}"]`);
      const visitHistory = editButton?.closest(".rank-visits");
      if (visitHistory) visitHistory.open = true;
      editButton?.focus();
      showToast("Visit note saved.");
      return;
    }
    if (event.target.id === "visit-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const museumId = String(form.get("museumId"));
      const visitedOn = String(form.get("visitedOn"));
      const note = String(form.get("note") || "").trim();
      const companionIds = [...new Set(selectedVisitCompanionIds)].filter((id) => demoFriends.some((friend) => friend.id === id));
      state.visits.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, museumId, visitedOn, note, companionIds });
      state.wishlist = state.wishlist.filter((id) => id !== museumId);
      if (!state.ranking.includes(museumId)) {
        if (state.ranking.length === 0) state.ranking.push(museumId);
        else comparisonSession = { mode: "insert", queue: [museumId], candidate: null, low: 0, high: 0, opponent: null };
      }
      saveState();
      visitDialog.close();
      if (museumDialog.open) museumDialog.close();
      renderView();
      if (comparisonSession) nextComparison();
      else showToast(`Visit to ${byId.get(museumId).shortName} saved and ranked.`);
    }
    if (event.target.id === "profile-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      state.displayName = String(form.get("displayName") || "").trim();
      saveState();
      renderView();
      showToast("Your profile was saved in this browser.");
    }
  });

  updateHeader();
  renderView();
})();
