(() => {
  "use strict";

  const STORAGE_KEY = "museum-rankings-v1";
  const museums = window.MUSEUMS || [];
  const byId = new Map(museums.map((museum) => [museum.id, museum]));
  const content = document.querySelector("#view-content");
  const toast = document.querySelector("#toast");
  const museumDialog = document.querySelector("#museum-dialog");
  const visitDialog = document.querySelector("#visit-dialog");
  const compareDialog = document.querySelector("#compare-dialog");
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  let state = loadState();
  let currentView = "home";
  let activeCategory = "All museums";
  let searchTerm = "";
  let comparisonSession = null;
  let toastTimer;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
        wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist.filter((id) => byId.has(id)) : [],
        visits: Array.isArray(parsed.visits) ? parsed.visits.filter((visit) => visit && byId.has(visit.museumId)) : [],
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
    }
    updateHeader();
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

  function updateHeader() {
    document.querySelector("#saved-count").textContent = String(state.wishlist.length);
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
    const saved = state.wishlist.includes(museum.id);
    const visits = visitCountFor(museum.id);
    return `<article class="museum-card accent-${museum.accent}">
      <div class="card-art ${museum.photo ? "has-photo" : ""}">
        ${museum.photo ? `<img class="card-photo" src="${escapeHtml(museum.photo)}" alt="" loading="lazy" decoding="async"><span class="photo-credit">Photo: <a href="${escapeHtml(museum.photoSource)}" target="_blank" rel="noopener noreferrer">${escapeHtml(museum.photoCredit)}</a> · <a href="${escapeHtml(museum.photoLicense)}" target="_blank" rel="noopener noreferrer">${escapeHtml(museum.photoLicenseLabel)}</a></span>` : `<span class="card-monogram" aria-hidden="true">${escapeHtml(museum.monogram)}</span><span class="card-icon" aria-hidden="true">${escapeHtml(museum.icon)}</span>`}
        <button class="save-toggle" type="button" data-action="toggle-save" data-id="${museum.id}" aria-label="${saved ? "Remove" : "Save"} ${escapeHtml(museum.shortName)} ${saved ? "from" : "to"} Want to visit" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>
      </div>
      <div class="card-body">
        <div class="card-meta"><span>${escapeHtml(museum.category)}</span>${visits ? `<span>${visits} visit${visits === 1 ? "" : "s"}</span>` : ""}</div>
        <h3>${escapeHtml(museum.shortName)}</h3>
        <p>${escapeHtml(museum.description)}</p>
        <div class="card-actions">
          <span class="card-address">${escapeHtml(museum.area)}</span>
          <button class="card-detail" type="button" data-action="open-museum" data-id="${museum.id}">View details <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </article>`;
  }

  function emptyState(symbol, title, copy, actionLabel, actionView) {
    return `<div class="empty-state">
      <span class="empty-symbol" aria-hidden="true">${symbol}</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(copy)}</p>
      ${actionLabel ? (actionView === "clear-filters" ? `<button class="button" type="button" data-action="clear-filters">${escapeHtml(actionLabel)}</button>` : `<button class="button" type="button" data-view="${actionView}">${escapeHtml(actionLabel)}</button>`) : ""}
    </div>`;
  }

  function heading(eyebrow, title, description, buttonMarkup = "") {
    return `<div class="section-heading"><div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ""}<h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}</div>${buttonMarkup}</div>`;
  }

  function renderHome() {
    const saved = state.wishlist.map((id) => byId.get(id)).filter(Boolean);
    const visited = uniqueVisitedIds();
    const ranked = state.ranking.length;
    const greeting = "Find Smithsonian museums and rank the ones you love.";
    const preview = saved.length
      ? `<div class="home-saved-preview">${saved.slice(0, 2).map(cardMarkup).join("")}</div>`
      : emptyState("♡", "Nothing saved yet", "Save places you want to visit.", "Browse museums", "discover");

    return `<section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <h1 id="home-title">Plan a museum day.<br><em>Rank your favorites.</em></h1>
        <p>${greeting}</p>
        <div class="hero-actions"><button class="button" type="button" data-view="discover">Explore museums <span class="icon" aria-hidden="true">→</span></button></div>
      </div>
      <div class="hero-art" aria-hidden="true"><span class="hero-sun"></span><span class="spark one">✦</span><span class="spark two">✧</span><span class="spark three">✦</span><div class="hero-building"><div class="building-roof"></div><div class="building-top"></div><div class="building-columns"><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="building-base"></div><div class="building-steps"></div></div></div>
    </section>
    <section class="stats-row" aria-label="Your museum activity">
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">♡</span><span><strong class="stat-value">${state.wishlist.length}</strong><span class="stat-label">on your list</span></span></div>
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">✦</span><span><strong class="stat-value">${visited.length}</strong><span class="stat-label">museums visited</span></span></div>
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">↕</span><span><strong class="stat-value">${ranked}</strong><span class="stat-label">in your ranking</span></span></div>
    </section>
    <section class="home-panel"><div class="panel-title"><h2>Want to visit</h2><button class="text-link" type="button" data-view="wishlist">View list →</button></div>${preview}</section>`;
  }

  function filteredMuseums(view) {
    let list = museums;
    if (view === "wishlist") list = list.filter((museum) => state.wishlist.includes(museum.id));
    if (activeCategory !== "All museums") {
      const categoryMatch = activeCategory === "Art"
        ? (museum) => museum.category.startsWith("Art")
        : activeCategory === "History"
          ? (museum) => museum.category.includes("History")
          : (museum) => museum.category.startsWith("Science");
      list = list.filter(categoryMatch);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((museum) => `${museum.name} ${museum.shortName} ${museum.category} ${museum.area} ${museum.description}`.toLowerCase().includes(term));
    }
    return list;
  }

  function renderDirectory(view) {
    const isWish = view === "wishlist";
    const title = isWish ? "Want to visit" : "Discover museums";
    const desc = "";
    const list = filteredMuseums(view);
    if (isWish && state.wishlist.length === 0) {
      return `${heading("Your shortlist", title, desc)}${emptyState("♡", "Nothing saved yet", "Browse the Smithsonian pilot directory and save a museum you would like to visit.", "Discover museums", "discover")}`;
    }
    const filters = ["All museums", "Art", "History", "Science"];
    return `${heading("", title, desc)}
      <div class="toolbar"><label class="search-box"><input class="search-input" id="museum-search" type="search" placeholder="Search by museum, topic, or neighborhood" value="${escapeHtml(searchTerm)}" aria-label="Search museums"></label>
        <div class="filter-row" role="group" aria-label="Filter museums by topic">${filters.map((filter) => `<button class="filter-chip ${activeCategory === filter ? "is-active" : ""}" type="button" data-action="category" data-category="${escapeHtml(filter)}" aria-pressed="${activeCategory === filter}">${escapeHtml(filter)}</button>`).join("")}</div>
      </div>
      <p class="result-count" id="result-count">${list.length} museum${list.length === 1 ? "" : "s"}</p>
      <div class="museum-grid" id="museum-grid">${list.length ? list.map(cardMarkup).join("") : emptyState("⌕", "No matches yet", "Try a different search or clear the topic filter.", "Clear filters", "clear-filters")}</div>`;
  }

  function renderVisits() {
    const sorted = [...state.visits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
    const rows = sorted.map((visit) => {
      const museum = byId.get(visit.museumId);
      if (!museum) return "";
      const visitPhoto = museum.photo
        ? `<a class="mini-art has-photo" href="${escapeHtml(museum.photoSource)}" target="_blank" rel="noopener noreferrer" aria-label="Photo by ${escapeHtml(museum.photoCredit)}, ${escapeHtml(museum.photoLicenseLabel)}. View source and usage terms."><img src="${escapeHtml(museum.photo)}" alt="" loading="lazy" decoding="async"><span aria-hidden="true">↗</span></a>`
        : `<span class="mini-art accent-${museum.accent}" aria-hidden="true">${escapeHtml(museum.monogram)}</span>`;
      return `<article class="visit-row">${visitPhoto}<div><h3>${escapeHtml(museum.shortName)}</h3><p>${dateLabel(visit.visitedOn)}${visit.note ? ` · ${escapeHtml(visit.note)}` : ""}</p></div><div class="visit-row-actions"><button class="button ghost small" type="button" data-action="open-museum" data-id="${museum.id}">Details</button><button class="button ghost small" type="button" data-action="delete-visit" data-id="${visit.id}" data-museum-id="${museum.id}" aria-label="Delete visit to ${escapeHtml(museum.shortName)}">Remove</button></div></article>`;
    }).join("");
    return `${heading("", "My visits", "", `<button class="button small" type="button" data-action="open-visit"><span class="icon" aria-hidden="true">＋</span> Log a visit</button>`)}
      ${sorted.length ? `<div class="visit-list">${rows}</div>` : emptyState("✦", "No visits yet", "Log a museum visit to see it here.", "Browse museums", "discover")}`;
  }

  function renderRanking() {
    const ranked = state.ranking.map((id) => byId.get(id)).filter(Boolean);
    const visitedIds = uniqueVisitedIds();
    const pending = visitedIds.filter((id) => !state.ranking.includes(id));
    const rows = ranked.map((museum, index) => {
      const visits = state.visits.filter((visit) => visit.museumId === museum.id).sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
      const visitHistory = visits.length ? `<details class="rank-visits"><summary>${visits.length} visit${visits.length === 1 ? "" : "s"}</summary><ul>${visits.map((visit) => `<li><span>${dateLabel(visit.visitedOn)}${visit.note ? ` · ${escapeHtml(visit.note)}` : ""}</span><button class="text-link" type="button" data-action="delete-visit" data-id="${visit.id}" data-museum-id="${museum.id}">Remove</button></li>`).join("")}</ul></details>` : "";
      return `<li class="rank-item"><span class="rank-number">${index + 1}</span><div class="rank-copy"><h3>${escapeHtml(museum.shortName)}</h3><p>${visits.length} visit${visits.length === 1 ? "" : "s"} · ${escapeHtml(museum.category)}</p>${visitHistory}</div><div class="rank-controls"><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="up" aria-label="Move ${escapeHtml(museum.shortName)} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="down" aria-label="Move ${escapeHtml(museum.shortName)} down" ${index === ranked.length - 1 ? "disabled" : ""}>↓</button></div></li>`;
    }).join("");
    const actions = `<div class="ranking-header-actions"><button class="button secondary small" type="button" data-action="open-visit"><span aria-hidden="true">＋</span> Log a visit</button>${ranked.length > 1 ? `<button class="button small" type="button" data-action="start-ranking">Compare again</button>` : ""}</div>`;
    const body = ranked.length
      ? `<div class="ranking-main"><ol class="rank-list">${rows}</ol>${pending.length ? `<div class="rank-pending"><strong>${pending.length} museum${pending.length === 1 ? "" : "s"} to place.</strong><br>Finish comparing your recent visits to update the ranking.<br><button class="button small" type="button" data-action="start-ranking">Continue ranking</button></div>` : ""}</div>`
      : `<div class="empty-state"><span class="empty-symbol" aria-hidden="true">↕</span><h3>Your ranking starts with a visit</h3><p>Log a visit to add your first museum.</p><button class="button" type="button" data-action="open-visit">Log a visit</button></div>`;
    return `${heading("", "My ranking", "", actions)}${body}`;
  }

  function renderProfile() {
    const displayName = escapeHtml(state.displayName);
    return `${heading("Your space", "A little about you", "Make the app feel like yours. Your profile, saved list, visit history, and ranking stay in this browser.")}
      <section class="profile-card"><p class="eyebrow">Private profile</p><h3>Welcome to your museum notebook.</h3><p>This first version does not use accounts. Your information is stored in this browser on this device. It will not follow you to another browser or sync with friends.</p><form class="profile-form" id="profile-form"><label class="field">What should we call you?<input name="displayName" type="text" maxlength="40" value="${displayName}" placeholder="Your name or nickname" autocomplete="nickname"></label><button class="button" type="submit">Save profile</button></form>
      <div class="privacy-callout"><span aria-hidden="true">◈</span><span><strong>About your data</strong><br>For now, your list and notes remain in this browser's storage. Clearing browser data will erase them. Sign-in and cross-device sync can be added later.</span></div>
      <div style="margin-top:22px"><button class="button danger small" type="button" data-action="clear-data">Clear my saved data</button></div></section>`;
  }

  function renderView() {
    updateHeader();
    if (currentView === "home") content.innerHTML = renderHome();
    else if (currentView === "discover" || currentView === "wishlist") content.innerHTML = renderDirectory(currentView);
    else if (currentView === "ranking") content.innerHTML = renderRanking();
    else if (currentView === "profile") content.innerHTML = renderProfile();
    else if (currentView === "visits") setView("ranking");
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
    const saved = state.wishlist.includes(id);
    const count = visitCountFor(id);
    museumDialog.innerHTML = `<div class="dialog-top-art accent-${museum.accent}" aria-hidden="true"><span class="dialog-monogram">${escapeHtml(museum.monogram)}</span><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close details">×</button></div>
      <div class="dialog-inner"><p class="eyebrow">${escapeHtml(museum.category)} · ${escapeHtml(museum.area)}</p><h2 id="museum-dialog-title">${escapeHtml(museum.name)}</h2><p class="dialog-description">${escapeHtml(museum.description)}</p>
      <div class="museum-facts"><div class="museum-fact"><span aria-hidden="true">⌖</span><span>${escapeHtml(museum.address)}</span></div><div class="museum-fact"><span aria-hidden="true">✦</span><span>${count ? `${count} visit${count === 1 ? "" : "s"} in your history` : "Not visited yet"}</span></div><div class="museum-fact"><span aria-hidden="true">↗</span><a href="${museum.officialUrl}" target="_blank" rel="noopener noreferrer">Official museum information</a></div></div>
      <div class="dialog-actions"><button class="button ${saved ? "soft" : "secondary"}" type="button" data-action="toggle-save" data-id="${museum.id}">${saved ? "♥ Saved to Want to visit" : "♡ Add to Want to visit"}</button><button class="button" type="button" data-action="open-visit" data-id="${museum.id}">Log a visit <span class="icon" aria-hidden="true">＋</span></button></div></div>`;
    if (!museumDialog.open) museumDialog.showModal();
  }

  function openVisitDialog(museumId = "") {
    if (museumDialog.open) museumDialog.close();
    const options = museums.map((museum) => `<option value="${museum.id}" ${museum.id === museumId ? "selected" : ""}>${escapeHtml(museum.shortName)}</option>`).join("");
    visitDialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close visit form">×</button><p class="eyebrow">Make a note of it</p><h2 class="dialog-heading" id="visit-dialog-title">Log a museum visit</h2><p class="dialog-subtitle">Add a date and note. You’ll rank this museum before you finish.</p>
      <form class="visit-form" id="visit-form"><label class="field">Museum<select name="museumId" required><option value="" disabled ${museumId ? "" : "selected"}>Choose a museum</option>${options}</select></label><label class="field">When did you visit?<input type="date" name="visitedOn" value="${today}" max="${today}" required></label><label class="field">Anything you want to remember?<textarea name="note" maxlength="500" placeholder="An exhibit, a feeling, a moment… (optional)"></textarea></label><div class="dialog-footer-actions"><button class="button secondary" type="button" data-action="close-dialog">Cancel</button><button class="button" type="submit">Save visit</button></div></form></div>`;
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
    if (!grid || !counter) return;
    const view = currentView;
    const list = filteredMuseums(view);
    counter.textContent = `${list.length} museum${list.length === 1 ? "" : "s"}`;
    grid.innerHTML = list.length ? list.map(cardMarkup).join("") : emptyState("⌕", "No matches yet", "Try a different search or clear the topic filter.", "Clear filters", "clear-filters");
  }

  function handleAction(button) {
    const { action, id } = button.dataset;
    if (action === "toggle-save") toggleSave(id);
    else if (action === "open-museum") openMuseum(id);
    else if (action === "open-visit") openVisitDialog(id || "");
    else if (action === "close-dialog") button.closest("dialog").close();
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
    } else if (action === "category") {
      activeCategory = button.dataset.category;
      content.innerHTML = renderDirectory(currentView);
    } else if (action === "clear-filters") {
      activeCategory = "All museums";
      searchTerm = "";
      content.innerHTML = renderDirectory(currentView);
    } else if (action === "clear-data") {
      if (window.confirm("Clear your saved list, visits, ranking, and profile from this browser? This cannot be undone.")) {
        state = { displayName: "", wishlist: [], visits: [], ranking: [] };
        saveState();
        setView("home");
        showToast("Your browser data has been cleared.");
      }
    }
  }

  document.addEventListener("click", (event) => {
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

  document.addEventListener("input", (event) => {
    if (event.target.id === "museum-search") {
      searchTerm = event.target.value;
      renderMuseumGrid();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "visit-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      const museumId = String(form.get("museumId"));
      const visitedOn = String(form.get("visitedOn"));
      const note = String(form.get("note") || "").trim();
      state.visits.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, museumId, visitedOn, note });
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
