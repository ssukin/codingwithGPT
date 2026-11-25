// Views for Ranking, Leaderboard and the sample-friend pickers, plus view switching.
(() => {
  "use strict";
  const MR = window.MR;
  const esc = MR.escapeHtml;
  const SAMPLE_NOTE = "Sample friends for this pilot, not real accounts.";

  // ----- Leaderboard and sample friends -----

  MR.renderLeaderboard = () => {
    const addFriendsButton = `<button class="button small" type="button" data-action="open-add-friends">Add friends</button>`;
    return `${MR.heading("", "Leaderboard", SAMPLE_NOTE, addFriendsButton)}
      ${MR.searchField("leaderboard-search", "Search friends", MR.ui.leaderboardSearch, { label: "Search leaderboard friends", className: "search-box--standalone" })}
      <div id="leaderboard-results">${MR.renderLeaderboardResults()}</div>`;
  };

  MR.renderLeaderboardResults = () => {
    const query = MR.ui.leaderboardSearch.trim().toLowerCase();
    const friends = MR.friends
      .filter((friend) => !query || friend.name.toLowerCase().includes(query))
      .sort((a, b) => b.submittedVisits - a.submittedVisits);
    if (!friends.length) return `<p class="friend-empty">No friends found.</p>`;
    const rows = friends.map((friend) => `<li>
        <span class="average-museum">${esc(friend.name)} <span class="sample-tag">Sample</span></span>
        <span class="visit-total"><strong>${friend.submittedVisits}</strong><span>visits</span></span>
      </li>`);
    return `<ol class="friends-average-list friends-visits-list">${rows.join("")}</ol>`;
  };

  MR.renderAddFriendsDialog = () => {
    MR.el.addFriendsDialog.innerHTML = `<div class="dialog-inner">
      <button class="dialog-close" type="button" data-action="close-add-friends" aria-label="Close add friends">×</button>
      <h2 class="dialog-heading" id="add-friends-title">Add friends</h2>
      <p class="dialog-subtitle">Search by name to add a sample friend to your leaderboard. ${SAMPLE_NOTE}</p>
      ${MR.searchField("add-friend-search", "Search people to add", MR.ui.addFriendSearch, { label: "Search people to add as friends", className: "search-box--standalone" })}
      <div id="add-friend-results">${MR.renderAddFriendResults()}</div>
    </div>`;
    MR.el.addFriendsDialog.showModal();
    document.querySelector("#add-friend-search")?.focus();
  };

  MR.renderAddFriendResults = () => {
    const query = MR.ui.addFriendSearch.trim().toLowerCase();
    if (!query) return "";
    const friendIds = new Set(MR.friends.map((friend) => friend.id));
    const suggestions = MR.suggestedFriends.filter((friend) => friend.name.toLowerCase().includes(query) && !friendIds.has(friend.id));
    return suggestions.length
      ? `<div class="friend-suggestions">${suggestions.map((friend) => `<article class="friend-card is-suggested">
          <div class="friend-heading">
            <h3>${esc(friend.name)} <span class="sample-tag">Sample</span></h3>
            <span class="friend-visit-count">${friend.submittedVisits} visits</span>
          </div>
          <button class="button small" type="button" data-action="add-friend" data-friend-id="${friend.id}">Add friend</button>
        </article>`).join("")}</div>`
      : `<p class="friend-empty">No people to add found.</p>`;
  };

  // Typeahead for "Who went with you?": current friends only, minus the ones already chosen.
  MR.renderVisitFriendSuggestions = (query = "") => {
    const normalizedQuery = query.trim().toLowerCase();
    const featuredOrder = ["sam", "alex", "jordan"];
    const orderOf = (friend) => {
      const index = featuredOrder.indexOf(friend.id);
      return index < 0 ? featuredOrder.length : index;
    };
    const friends = MR.friends
      .filter((friend) => !MR.ui.companions.includes(friend.id) && friend.name.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => orderOf(first) - orderOf(second));
    if (!friends.length) return `<p class="friend-typeahead-empty">No friends found.</p>`;
    return friends.map((friend) => `<button class="friend-typeahead-option" type="button" role="option"
      data-action="select-visit-friend" data-friend-id="${esc(friend.id)}">${esc(friend.name)}</button>`).join("");
  };

  MR.renderSelectedVisitFriends = () => {
    const selection = document.querySelector("#visit-friend-selection");
    if (!selection) return;
    selection.innerHTML = MR.ui.companions.map((id) => {
      const name = MR.friendName(id);
      return name ? `<span class="visit-friend-pill">${esc(name)}<button type="button" data-action="remove-visit-friend"
        data-friend-id="${esc(id)}" aria-label="Remove ${esc(name)}">×</button></span>` : "";
    }).join("");
  };

  // ----- Ranking -----

  MR.renderFriendRankingResults = () => {
    const query = MR.ui.rankingSearch;
    const rows = window.RankingRules.friendAverages(MR.friends)
      .map((item) => ({ ...item, museum: MR.byId.get(item.id) }))
      .filter((item) => item.museum && (!query.trim() || window.MuseumFilters.museumTitleMatches(item.museum, query)));
    if (!rows.length) return `<p class="friend-empty">No museums found.</p>`;
    return `<ol class="friends-average-list">${rows.map((item, index) => `<li>
        <span class="average-rank">${index + 1}</span>
        <span class="average-museum">${esc(item.museum.shortName)}</span>
        <span class="average-value">${item.average.toFixed(1)} avg · ${MR.plural(item.raters, "friend")}</span>
      </li>`).join("")}</ol>`;
  };

  function rankVisitHistory(museum, visits) {
    if (!visits.length) return "";
    const items = visits.map((visit) => `<li>
          <span>${MR.visitDescription(visit)}</span>
          <button class="text-link" type="button" data-action="edit-visit-note" data-id="${esc(visit.id)}"
            aria-label="Edit note for ${esc(museum.shortName)} on ${MR.dateLabel(visit.visitedOn)}">Edit note</button>
          <button class="text-link" type="button" data-action="delete-visit" data-id="${esc(visit.id)}" data-museum-id="${museum.id}">Remove</button>
        </li>`);
    return `<details class="rank-visits"><summary>${MR.plural(visits.length, "visit")}</summary><ul>${items.join("")}</ul></details>`;
  }

  function rankRow(museum, index, total) {
    const visits = MR.state.visits.filter((visit) => visit.museumId === museum.id).sort((a, b) => b.visitedOn.localeCompare(a.visitedOn));
    const name = esc(museum.shortName);
    return `<li class="rank-item">
      <span class="rank-number">${index + 1}</span>
      <div class="rank-copy"><h3>${name}</h3><p>${MR.plural(visits.length, "visit")}</p>${rankVisitHistory(museum, visits)}</div>
      <div class="rank-controls">
        <button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="up" aria-label="Move ${name} up" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" data-action="move-rank" data-id="${museum.id}" data-direction="down" aria-label="Move ${name} down" ${index === total - 1 ? "disabled" : ""}>↓</button>
      </div>
    </li>`;
  }

  MR.renderRanking = () => {
    const modeToggle = MR.viewToggle("Ranking views", "ranking-mode", "mode", MR.ui.rankingMode, [["mine", "My ranking"], ["friends", "Friends’ average"]]);
    if (MR.ui.rankingMode === "friends") {
      return `${MR.heading("", "Ranking", SAMPLE_NOTE)}${modeToggle}
        ${MR.searchField("ranking-friends-search", "Search museums", MR.ui.rankingSearch, { className: "search-box--standalone" })}
        <div id="friend-ranking-results">${MR.renderFriendRankingResults()}</div>`;
    }
    const ranked = MR.state.ranking.map((id) => MR.byId.get(id)).filter(Boolean);
    const pending = window.RankingRules.pendingIds(MR.state.visits, MR.state.ranking);
    const actions = `<div class="ranking-header-actions">
      <button class="button small" type="button" data-action="open-visit"><span aria-hidden="true">＋</span> Log a visit</button>
    </div>`;
    if (!ranked.length) {
      return `${MR.heading("", "Ranking", "", actions)}${modeToggle}
        <div class="empty-state">
          <span class="empty-symbol" aria-hidden="true">↕</span>
          <h3>Your ranking starts with a visit</h3>
          <p>Log a visit to add your first museum.</p>
          <button class="button" type="button" data-action="open-visit">Log a visit</button>
        </div>`;
    }
    const rows = ranked.map((museum, index) => rankRow(museum, index, ranked.length)).join("");
    const pendingNotice = pending.length
      ? `<div class="rank-pending">
          <strong>${MR.plural(pending.length, "museum")} to place.</strong><br>
          Finish comparing your recent visits to update the ranking.<br>
          <button class="button small" type="button" data-action="start-ranking">Continue ranking</button>
        </div>`
      : "";
    return `${MR.heading("", "Ranking", "", actions)}${modeToggle}
      <div class="ranking-main"><ol class="rank-list">${rows}</ol>${pendingNotice}</div>`;
  };

  // ----- Views -----

  MR.renderView = () => {
    const view = MR.ui.view;
    MR.updateHeader();
    if (view === "discover" || view === "wishlist") MR.el.content.innerHTML = MR.renderDirectory(view);
    else if (view === "ranking") MR.el.content.innerHTML = MR.renderRanking();
    else if (view === "leaderboard") MR.el.content.innerHTML = MR.renderLeaderboard();
    else if (view === "profile") MR.el.content.innerHTML = MR.renderProfile();
    else if (view === "visits") MR.setView("ranking");
  };

  MR.setView = (view) => {
    MR.ui.view = view;
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
      if (!button.classList.contains("nav-link")) return;
      if (button.dataset.view === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    if (view === "ranking") MR.events.record("ranking_viewed");
    MR.renderView();
    document.querySelector("#main-content").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
})();
