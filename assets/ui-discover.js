// Views for Discover (find & save) and Profile. They read MR.state and MR.ui and return HTML; they never save.
(() => {
  "use strict";
  const MR = window.MR;
  const esc = MR.escapeHtml;

  function cardArt(museum, visits, saved) {
    const art = museum.photo
      ? `<img class="card-photo" src="${esc(museum.photo)}" alt="" loading="lazy" decoding="async">
        <span class="photo-credit">Photo:
          ${MR.externalLink(museum.photoSource, esc(museum.photoCredit))} ·
          ${MR.externalLink(museum.photoLicense, esc(museum.photoLicenseLabel))}
        </span>`
      : `<span class="card-monogram" aria-hidden="true">${esc(museum.monogram)}</span>
        <span class="card-icon" aria-hidden="true">${esc(museum.icon)}</span>`;
    const saveLabel = saved ? `Remove ${esc(museum.shortName)} from Want to visit` : `Save ${esc(museum.shortName)} to Want to visit`;
    const statusControl = visits
      ? `<span class="visited-badge"><span aria-hidden="true">✓</span> Visited</span>`
      : `<button class="save-toggle" type="button" data-action="toggle-save" data-id="${museum.id}"
          aria-label="${saveLabel}" aria-pressed="${saved}">${saved ? "♥" : "♡"}</button>`;
    return `<div class="card-art ${museum.photo ? "has-photo" : ""}">${art}${statusControl}</div>`;
  }

  function cardMarkup(museum) {
    const visits = MR.visitCountFor(museum.id);
    const saved = visits === 0 && MR.state.wishlist.includes(museum.id);
    const websiteLink = MR.externalLink(museum.officialUrl, `Website <span aria-hidden="true">↗</span>`,
      `class="card-detail" data-action="open-website" data-id="${museum.id}" aria-label="${esc(museum.shortName)} website (opens in a new tab)"`);
    return `<article class="museum-card accent-${museum.accent}">
      ${cardArt(museum, visits, saved)}
      <div class="card-body">
        <h3>${esc(museum.shortName)}</h3>
        <p>${esc(museum.description)}</p>
        <div class="card-actions">
          <span class="card-address">${esc(museum.area)}</span>
          <span class="card-action-links">
            ${websiteLink}
            <button class="card-log-visit" type="button" data-action="open-visit" data-id="${museum.id}">
              Log visit <span aria-hidden="true">＋</span>
            </button>
          </span>
        </div>
      </div>
    </article>`;
  }

  // The rules live in filters.js; this binds them to the current UI choices.
  MR.filteredMuseums = (view) => window.MuseumFilters.filterMuseums(MR.museums, {
    category: MR.ui.category, status: MR.ui.status, location: MR.ui.location,
    search: MR.ui.search, wishlistOnly: view === "wishlist"
  }, MR.museumStatus);

  function directoryResults(view, list) {
    if (list.length) return list.map(cardMarkup).join("");
    const isWish = view === "wishlist" || MR.ui.status === "Want to visit";
    return isWish && MR.state.wishlist.length === 0
      ? MR.emptyState("♡", "Nothing saved yet", "Use the heart on a museum to add it here.", "Browse all museums", "all-museums")
      : MR.noMatchesState();
  }

  MR.renderDirectory = (view) => {
    const list = MR.filteredMuseums(view);
    const locations = [...new Set(MR.museums.map((museum) => museum.area).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return `${MR.heading("", "Discover museums", "")}
      <div class="toolbar">
        ${MR.searchField("museum-search", "Search museums", MR.ui.search)}
        <div class="filter-controls">
          <span class="filter-by-label">Filter by</span>
          ${MR.selectFilter("museum-status-filter", "Filter by status", "Any status", MR.ui.status, ["Not marked", "Want to visit", "Visited"])}
          ${MR.selectFilter("category-filter", "Filter by category", "Any category", MR.ui.category, window.MuseumFilters.CATEGORIES)}
          ${MR.selectFilter("location-filter", "Filter by location", "Any location", MR.ui.location, locations)}
        </div>
      </div>
      <p class="result-count" id="result-count">${MR.plural(list.length, "museum")}</p>
      <div class="museum-grid" id="museum-grid">${directoryResults(view, list)}</div>`;
  };

  // Typing in search redraws only the count and grid, so the input keeps focus.
  MR.renderMuseumGrid = () => {
    const grid = document.querySelector("#museum-grid");
    const counter = document.querySelector("#result-count");
    if (!counter || !grid) return;
    const list = MR.filteredMuseums(MR.ui.view);
    counter.textContent = MR.plural(list.length, "museum");
    grid.innerHTML = list.length ? list.map(cardMarkup).join("") : MR.noMatchesState();
  };

  MR.refreshDirectory = () => { MR.el.content.innerHTML = MR.renderDirectory(MR.ui.view); };

  // Profile: display name, privacy, the pilot activity log a facilitator exports after a session, and clear data.
  MR.renderProfile = () => {
    const counts = MR.events.summary();
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const lines = Object.entries(counts).map(([name, n]) => `<li><code>${esc(name)}</code> ${n}</li>`).join("");
    return `<section class="profile-page">
      <h2>Sample Name Profile</h2>
      <p>This first version does not use accounts. Your information is stored in this browser on this device. It will not follow you to another browser or sync with friends.</p>
      <form class="profile-form" id="profile-form">
        <label class="field">What should we call you?<input name="displayName" type="text" maxlength="40"
          value="${esc(MR.state.displayName)}" placeholder="Your name or nickname" autocomplete="nickname"></label>
        <button class="button" type="submit">Save profile</button>
      </form>
      <p class="privacy-copy"><strong>About your data</strong><br>For now, your list and notes remain in this browser's storage. Clearing browser data will erase them. Sign-in and cross-device sync can be added later.</p>
      <div class="pilot-log">
        <p class="privacy-copy"><strong>Pilot activity log</strong><br>For test sessions: ${MR.plural(total, "event")} recorded in this browser (event names, times and museum IDs only; no notes or names).</p>
        ${lines ? `<ul class="pilot-log-counts">${lines}</ul>` : ""}
        <button class="button secondary small" type="button" data-action="export-events" ${total ? "" : "disabled"}>Download activity log</button>
      </div>
      <div class="profile-actions">
        <button class="button danger small" type="button" data-action="clear-data">Clear my saved data</button>
      </div>
    </section>`;
  };
})();
