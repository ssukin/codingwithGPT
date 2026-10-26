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
      <div class="card-art" aria-hidden="true">
        <span class="card-monogram">${escapeHtml(museum.monogram)}</span>
        <span class="card-icon">${escapeHtml(museum.icon)}</span>
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
    return `<div class="section-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>${buttonMarkup}</div>`;
  }

  function renderHome() {
    const saved = state.wishlist.map((id) => byId.get(id)).filter(Boolean);
    const visited = uniqueVisitedIds();
    const ranked = state.ranking.length;
    const greeting = state.displayName.trim() ? `Welcome back, ${escapeHtml(state.displayName.trim())}.` : "Your city, your kind of wonder.";
    const preview = saved.length
      ? `<div class="home-saved-preview">${saved.slice(0, 2).map(cardMarkup).join("")}</div>`
      : emptyState("♡", "Your shortlist starts here", "Save a museum that catches your eye. Your Want to visit list will be waiting here.", "Explore museums", "discover");

    return `<section class="hero" aria-labelledby="home-title">
      <div class="hero-copy">
        <p class="eyebrow">Smithsonian museums · Washington, DC</p>
        <h1 id="home-title">A city full of wonder.<br><em>A ranking that's yours.</em></h1>
        <p>${greeting} Find a museum for the afternoon, keep a list for later, and build a personal ranking as you go.</p>
        <div class="hero-actions"><button class="button" type="button" data-view="discover">Explore the museums <span class="icon" aria-hidden="true">→</span></button><button class="text-link" type="button" data-view="ranking">See how ranking works</button></div>
      </div>
      <div class="hero-art" aria-hidden="true"><span class="hero-sun"></span><span class="spark one">✦</span><span class="spark two">✧</span><span class="spark three">✦</span><div class="hero-building"><div class="building-roof"></div><div class="building-top"></div><div class="building-columns"><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="building-base"></div><div class="building-steps"></div></div></div>
    </section>
    <section class="stats-row" aria-label="Your museum activity">
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">♡</span><span><strong class="stat-value">${state.wishlist.length}</strong><span class="stat-label">on your list</span></span></div>
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">✦</span><span><strong class="stat-value">${visited.length}</strong><span class="stat-label">museums visited</span></span></div>
      <div class="stat-card"><span class="stat-icon" aria-hidden="true">↕</span><span><strong class="stat-value">${ranked}</strong><span class="stat-label">in your ranking</span></span></div>
    </section>
    <div class="home-grid">
      <section class="home-panel"><div class="panel-title"><h2>Want to visit</h2><button class="text-link" type="button" data-view="wishlist">View your list →</button></div>${preview}</section>
      <aside class="quick-start"><p class="eyebrow">A good place to start</p><h3>Make your next museum day yours.</h3><p>Save a few places first. After your visits, compare museums to find the order that feels right to you.</p><ol class="quick-start-list"><li><span class="step-number">1</span>Find a museum that sounds good</li><li><span class="step-number">2</span>Save it or log a visit</li><li><span class="step-number">3</span>Compare favorites and shape your ranking</li></ol><button class="button secondary" type="button" data-view="visits">Log a visit <span class="icon" aria-hidden="true">＋</span></button></aside>
    </div>`;
  }

  function filteredMuseums(view) {
    let list = museums;
    if (view === "wishlist") list = list.filter((museum) => state.wishlist.includes(museum.id));
    if (view === "visits") list = list.filter((museum) => visitCountFor(museum.id) > 0);
    if (activeCategory !== "All museums") list = list.filter((museum) => museum.category === activeCategory);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((museum) => `${museum.name} ${museum.shortName} ${museum.category} ${museum.area} ${museum.description}`.toLowerCase().includes(term));
    }
    return list;
  }

  function renderDirectory(view) {
    const isWish = view === "wishlist";
    const title = isWish ? "Want to visit" : view === "visits" ? "Your museum visits" : "Discover museums";
    const desc = isWish
      ? "A personal shortlist for the next free afternoon, weekend, or trip across town."
      : view === "visits"
        ? "Keep a simple record of where you've been and what you'd like to remember."
        : "Twelve Smithsonian museum institutions across Washington, DC. Find the one that fits today.";
    const list = filteredMuseums(view);
    const headingButton = view === "visits" ? `<button class="button small" type="button" data-action="open-visit"><span class="icon" aria-hidden="true">＋</span> Log a visit</button>` : "";
    if (isWish && state.wishlist.length === 0) {
      return `${heading("Your shortlist", title, desc)}${emptyState("♡", "Nothing saved yet", "Browse the Smithsonian pilot directory and save a museum you would like to visit.", "Discover museums", "discover")}`;
    }
    if (view === "visits" && state.visits.length === 0) {
      return `${heading("A little memory keeper", title, desc, headingButton)}${emptyState("✦", "Your first visit goes here", "When you have been to a museum, log the date and add a note for your future self.", "Find a museum", "discover")}`;
    }
    const filters = ["All museums", "Art & design", "Art & history", "History & culture", "Science & nature", "Science & technology"];
    return `${heading(isWish ? "Saved for later" : view === "visits" ? "Your history" : "The DC pilot", title, desc, headingButton)}
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
      return `<article class="visit-row"><span class="mini-art accent-${museum.accent}" aria-hidden="true">${escapeHtml(museum.monogram)}</span><div><h3>${escapeHtml(museum.shortName)}</h3><p>${dateLabel(visit.visitedOn)}${visit.note ? ` · ${escapeHtml(visit.note)}` : ""}</p></div><div class="visit-row-actions"><button class="button ghost small" type="button" data-action="open-museum" data-id="${museum.id}">Details</button><button class="button ghost small" type="button" data-action="delete-visit" data-id="${visit.id}" data-museum-id="${museum.id}" aria-label="Delete visit to ${escapeHtml(museum.shortName)}">Remove</button></div></article>`;
    }).join("");
    return `${heading("Your history", "Your museum visits", "A private record of the museums you've explored. Add a date and a note, then compare your experiences.", `<button class="button small" type="button" data-action="open-visit"><span class="icon" aria-hidden="true">＋</span> Log a visit</button>`)}
      ${sorted.length ? `<div class="list-layout"><div class="visit-list">${rows}</div><aside class="list-note"><p class="eyebrow">Keep the memory</p><h3>What stayed with you?</h3><p>A short note can make it easier to compare the feeling of one visit with another. Your notes are saved only in this browser.</p></aside></div>` : emptyState("✦", "Your first visit goes here", "When you have been to a museum, log the date and add a note for your future self.", "Find a museum", "discover")}`;
  }

  function renderRanking() {
    const ranked = state.ranking.map((id) => byId.get(id)).filter(Boolean);
    const visitedIds = uniqueVisitedIds();
    const pending = visitedIds.filter((id) => !state.ranking.includes(id));
    const rows = ranked.map((museum, index) => `<li class="rank-item"><span class="rank-number">${index + 1}</span><div class="rank-copy"><h3>${escapeHtml(museum.shortName)}</h3><p>${visitCountFor(museum.id)} visit${visitCountFor(museum.id) === 1 ? "" : "s"} · ${escapeHtml(museum.category)}</p></div><div class="rank-controls"><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="up" aria-label="Move ${escapeHtml(museum.shortName)} up" ${index === 0 ? "disabled" : ""}>↑</button><button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="down" aria-label="Move ${escapeHtml(museum.shortName)} down" ${index === ranked.length - 1 ? "disabled" : ""}>↓</button></div></li>`).join("");
    const action = pending.length ? `<button class="button small" type="button" data-action="start-ranking">Compare museums <span class="icon" aria-hidden="true">↗</span></button>` : "";
    const body = ranked.length
      ? `<div class="list-layout"><div><ol class="rank-list">${rows}</ol>${pending.length ? `<div class="rank-pending"><strong>${pending.length} visited museum${pending.length === 1 ? "" : "s"} ${pending.length === 1 ? "is" : "are"} still to place.</strong><br>Compare a new visit with a museum already on your list to find its spot.${action}</div>` : ""}</div><aside class="list-note"><p class="eyebrow">Your order, your call</p><h3>Rankings are personal.</h3><p>Choose which museum you enjoyed more in a head-to-head comparison. You can always adjust the order yourself with the arrows.</p>${ranked.length > 1 ? `<p style="margin-top:12px"><button class="button secondary small" type="button" data-action="start-ranking">Compare again</button></p>` : ""}</aside></div>`
      : visitedIds.length >= 2
        ? `<div class="rank-pending"><strong>You have museums to compare.</strong><br>Choose which you enjoyed more, one pair at a time, and the list will find its order.<br><button class="button small" type="button" data-action="start-ranking">Build my ranking <span class="icon" aria-hidden="true">↗</span></button></div>`
        : emptyState("↕", "Your ranking takes shape as you go", "Log visits to at least two different museums. Then compare them to start your personal ranking.", "Log a visit", "visits");
    return `${heading("A list only you can make", "My ranking", "Put your museum experiences in order. No stars from strangers—just what felt right to you.")}${body}`;
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
    else if (currentView === "discover" || currentView === "wishlist" || currentView === "visits") content.innerHTML = renderDirectory(currentView);
    else if (currentView === "ranking") content.innerHTML = renderRanking();
    else if (currentView === "profile") content.innerHTML = renderProfile();
    if (currentView === "visits") content.innerHTML = renderVisits();
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
    visitDialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close visit form">×</button><p class="eyebrow">Make a note of it</p><h2 class="dialog-heading" id="visit-dialog-title">Log a museum visit</h2><p class="dialog-subtitle">A date and a quick note are enough. You can come back to this memory when you compare museums.</p>
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
      showToast("Everything you've visited is already ranked. Use the arrows to adjust the order.");
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
    compareDialog.innerHTML = `<div class="dialog-inner"><button class="dialog-close" type="button" data-action="close-comparison" aria-label="Close comparison">×</button><p class="eyebrow">Your ranking · head to head</p><h2 class="dialog-heading" id="compare-dialog-title">Which visit did you enjoy more?</h2><p class="dialog-subtitle">There is no right answer. Choose the museum that felt more memorable to you.</p><div class="compare-pair">
      <button class="compare-choice accent-${first.accent}" type="button" data-action="choose-comparison" data-winner="${first.id}" data-mode="${mode}"><span class="choice-icon" aria-hidden="true">${escapeHtml(first.monogram)}</span><strong>${escapeHtml(first.shortName)}</strong></button><span class="versus">OR</span>
      <button class="compare-choice accent-${second.accent}" type="button" data-action="choose-comparison" data-winner="${second.id}" data-mode="${mode}"><span class="choice-icon" aria-hidden="true">${escapeHtml(second.monogram)}</span><strong>${escapeHtml(second.shortName)}</strong></button>
      </div><div class="compare-actions"><button class="text-link" type="button" data-action="skip-comparison">I'm not sure yet</button></div></div>`;
    if (!compareDialog.open) compareDialog.showModal();
  }

  function chooseComparison(winnerId, mode) {
    if (!comparisonSession) return;
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
      saveState();
      visitDialog.close();
      if (museumDialog.open) museumDialog.close();
      renderView();
      showToast(`Visit to ${byId.get(museumId).shortName} saved.`);
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
