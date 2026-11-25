// Shared UI state and helpers. Every ui-*.js file and app.js reads and writes the notebook through `MR`.
// Order of scripts: museums → sample-friends → filters → ranking → events → visit-friends → store → ui-core → ui-* → app.
(() => {
  "use strict";

  const museums = window.MUSEUMS || [];
  const byId = new Map(museums.map((museum) => [museum.id, museum]));
  const store = window.NotebookStore;
  const sample = window.SAMPLE_FRIENDS;

  // Friends: the three starting sample friends plus any suggested ones the visitor added.
  const friends = [...sample.starting];
  store.loadAddedFriendIds(localStorage).forEach((id) => {
    const friend = sample.suggested.find((suggestion) => suggestion.id === id);
    if (friend && !friends.some((existing) => existing.id === id)) friends.push(friend);
  });

  const MR = window.MR = {
    museums, byId, friends, suggestedFriends: sample.suggested,
    events: window.museumEvents,
    VISIT_NOTE_LIMIT: 500,
    today: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    // The notebook (Model) and the transient UI state; only `state` is ever saved.
    state: store.loadNotebook(localStorage, (id) => byId.has(id)),
    ui: {
      view: "discover", category: "All", status: "All", location: "All", search: "",
      rankingMode: "mine", rankingSearch: "", leaderboardSearch: "", addFriendSearch: "",
      companions: [], comparison: null, toastTimer: null
    },
    el: {
      content: document.querySelector("#view-content"),
      toast: document.querySelector("#toast"),
      visitDialog: document.querySelector("#visit-dialog"),
      compareDialog: document.querySelector("#compare-dialog"),
      addFriendsDialog: document.querySelector("#add-friends-dialog")
    }
  };

  // Save-then-commit: the new notebook replaces the old one only if the browser accepted the write.
  MR.commit = function commit(next) {
    const ok = store.persistNotebook(localStorage, next);
    if (ok) MR.state = next;
    else {
      MR.events.record("storage_failed");
      MR.showToast("This browser could not save your changes. Check its storage settings.");
    }
    MR.updateHeader();
    return ok;
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  MR.escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  MR.plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

  MR.externalLink = (url, label, attributes = "") =>
    `<a href="${MR.escapeHtml(url)}" target="_blank" rel="noopener noreferrer" ${attributes}>${label}</a>`;

  MR.dateLabel = (value, options = { month: "short", day: "numeric", year: "numeric" }) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.valueOf()) ? "Date not set" : new Intl.DateTimeFormat("en-US", options).format(date);
  };

  MR.visitCountFor = (id) => MR.state.visits.filter((visit) => visit.museumId === id).length;

  MR.museumStatus = (museum) => {
    if (MR.visitCountFor(museum.id) > 0) return "Visited";
    if (MR.state.wishlist.includes(museum.id)) return "Want to visit";
    return "Not marked";
  };

  MR.friendName = (id) => MR.friends.find((friend) => friend.id === id)?.name;

  MR.visitDescription = (visit) => {
    const parts = [MR.dateLabel(visit.visitedOn)];
    if (visit.note) parts.push(MR.escapeHtml(visit.note));
    const names = store.normalizeCompanionIds(visit).map(MR.friendName).filter(Boolean).map(MR.escapeHtml);
    if (names.length === 1) parts.push(`Went with ${names[0]}`);
    else if (names.length === 2) parts.push(`Went with ${names[0]} and ${names[1]}`);
    else if (names.length > 2) parts.push(`Went with ${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`);
    return parts.join(" · ");
  };

  MR.resetFilters = () => Object.assign(MR.ui, { category: "All", status: "All", location: "All", search: "" });

  MR.showToast = (message) => {
    MR.el.toast.textContent = message;
    MR.el.toast.classList.add("is-visible");
    window.clearTimeout(MR.ui.toastTimer);
    MR.ui.toastTimer = window.setTimeout(() => MR.el.toast.classList.remove("is-visible"), 2800);
  };

  MR.updateHeader = () => {
    const name = MR.state.displayName.trim();
    document.querySelector("#profile-label").textContent = name || "My profile";
    document.querySelector("#profile-avatar").textContent = name ? name[0].toUpperCase() : "M";
  };

  // ---------------------------------------------------------------------------
  // Shared markup
  // ---------------------------------------------------------------------------

  MR.emptyState = (symbol, title, copy, actionLabel, actionView) => {
    const esc = MR.escapeHtml;
    let action = "";
    if (actionLabel && actionView === "clear-filters") action = `<button class="button" type="button" data-action="clear-filters">${esc(actionLabel)}</button>`;
    else if (actionLabel && actionView === "all-museums") action = `<button class="button" type="button" data-action="show-all-museums">${esc(actionLabel)}</button>`;
    else if (actionLabel) action = `<button class="button" type="button" data-view="${actionView}">${esc(actionLabel)}</button>`;
    return `<div class="empty-state">
      <span class="empty-symbol" aria-hidden="true">${symbol}</span>
      <h3>${esc(title)}</h3>
      <p>${esc(copy)}</p>
      ${action}
    </div>`;
  };

  MR.noMatchesState = () => MR.emptyState("⌕", "No matches yet", "Try a different search or clear the topic filter.", "Clear filters", "clear-filters");

  MR.heading = (eyebrow, title, description, buttonMarkup = "") => `<div class="section-heading">
      <div>
        ${eyebrow ? `<p class="eyebrow">${MR.escapeHtml(eyebrow)}</p>` : ""}
        <h2>${MR.escapeHtml(title)}</h2>
        ${description ? `<p>${MR.escapeHtml(description)}</p>` : ""}
      </div>
      ${buttonMarkup}
    </div>`;

  MR.searchField = (id, placeholder, value, { label = placeholder, className = "" } = {}) => `<label class="search-box ${className}">
      <span class="visually-hidden">${MR.escapeHtml(label)}</span>
      <input class="search-input" id="${MR.escapeHtml(id)}" type="search"
        placeholder="${MR.escapeHtml(placeholder)}" value="${MR.escapeHtml(value)}">
    </label>`;

  MR.selectFilter = (id, label, anyLabel, selectedValue, values) => {
    const esc = MR.escapeHtml;
    const options = values.map((value) => `<option value="${esc(value)}" ${selectedValue === value ? "selected" : ""}>${esc(value)}</option>`);
    return `<label class="visually-hidden" for="${id}">${esc(label)}</label>
      <select class="directory-filter" id="${id}">
        <option value="All" ${selectedValue === "All" ? "selected" : ""}>${esc(anyLabel)}</option>
        ${options.join("")}
      </select>`;
  };

  MR.viewToggle = (ariaLabel, action, dataKey, activeValue, choices) => {
    const buttons = choices.map(([value, label]) => {
      const isActive = activeValue === value;
      return `<button class="${isActive ? "is-active" : ""}" type="button" data-action="${action}"
        data-${dataKey}="${value}" aria-pressed="${isActive}">${label}</button>`;
    });
    return `<div class="ranking-mode-toggle view-toggle" role="group" aria-label="${ariaLabel}">${buttons.join("")}</div>`;
  };
})();
