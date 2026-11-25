// Event wiring (Controller): turns clicks, typing and form submits into calls on the views and dialogs.
// The notebook model is in store.js, the rules in filters.js and ranking.js, the views in ui-*.js.
(() => {
  "use strict";
  const MR = window.MR;
  const { content, visitDialog, compareDialog, addFriendsDialog } = MR.el;

  // ----- Friend typeahead in the visit form -----

  function friendPicker() {
    return { search: document.querySelector("#visit-friend-search"), options: document.querySelector("#visit-friend-options") };
  }
  function showFriendOptions(query, expanded) {
    const { search, options } = friendPicker();
    if (options) { options.innerHTML = MR.renderVisitFriendSuggestions(query); options.hidden = false; }
    if (search) search.setAttribute("aria-expanded", String(expanded));
  }
  function selectVisitFriend(friendId) {
    const { search } = friendPicker();
    if (!search || !MR.friends.some((friend) => friend.id === friendId) || MR.ui.companions.includes(friendId)) return;
    MR.ui.companions.push(friendId);
    MR.renderSelectedVisitFriends();
    search.value = "";
    search.focus();
    showFriendOptions("", false);
  }
  function removeVisitFriend(friendId) {
    MR.ui.companions = MR.ui.companions.filter((id) => id !== friendId);
    MR.renderSelectedVisitFriends();
    const { search } = friendPicker();
    if (search) { search.focus(); showFriendOptions(search.value, true); }
  }

  // ----- Other actions -----

  function deleteVisit(visitId, museumId) {
    const visits = MR.state.visits.filter((visit) => visit.id !== visitId);
    const stillVisited = visits.some((visit) => visit.museumId === museumId);
    const ranking = stillVisited ? MR.state.ranking : MR.state.ranking.filter((id) => id !== museumId);
    if (MR.commit({ ...MR.state, visits, ranking })) MR.showToast("Visit removed from your history.");
    MR.renderView();
  }

  function addFriend(friendId) {
    const friend = MR.suggestedFriends.find((suggestion) => suggestion.id === friendId);
    if (!friend || MR.friends.some((existing) => existing.id === friend.id)) return;
    MR.friends.push(friend);
    window.NotebookStore.saveAddedFriendIds(localStorage, MR.friends.map((existing) => existing.id));
    MR.ui.leaderboardSearch = "";
    MR.ui.addFriendSearch = "";
    addFriendsDialog.close();
    content.innerHTML = MR.renderLeaderboard();
    MR.showToast(`${friend.name} added to your friends.`);
  }

  function exportEvents() {
    const blob = new Blob([JSON.stringify(MR.events.read(), null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `museum-rankings-events-${MR.today}.json` });
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function clearData() {
    if (!window.confirm("Clear your saved list, visits, ranking, profile and activity log from this browser? This cannot be undone.")) return;
    if (!MR.commit({ ...window.NotebookStore.EMPTY })) return;
    MR.events.clear();
    MR.resetFilters();
    MR.setView("discover");
    MR.showToast("Your browser data has been cleared.");
  }

  const ACTIONS = {
    "toggle-save": (b) => MR.toggleSave(b.dataset.id),
    "open-website": (b) => MR.events.record("website_opened", b.dataset.id),
    "open-visit": (b) => MR.openVisitDialog(b.dataset.id || ""),
    "edit-visit-note": (b) => MR.openVisitNoteEditor(b.dataset.id),
    "select-visit-friend": (b) => selectVisitFriend(b.dataset.friendId),
    "remove-visit-friend": (b) => removeVisitFriend(b.dataset.friendId),
    "close-dialog": (b) => b.closest("dialog").close(),
    "start-ranking": () => MR.startRanking(),
    "move-rank": (b) => MR.moveRank(b.dataset.id, b.dataset.direction),
    "delete-visit": (b) => deleteVisit(b.dataset.id, b.dataset.museumId),
    "choose-comparison": (b) => MR.chooseComparison(b.dataset.winner),
    "show-all-museums": () => { MR.resetFilters(); MR.refreshDirectory(); },
    "clear-filters": () => { MR.resetFilters(); MR.refreshDirectory(); },
    "ranking-mode": (b) => { MR.ui.rankingMode = b.dataset.mode; content.innerHTML = MR.renderRanking(); },
    "open-add-friends": () => { MR.ui.addFriendSearch = ""; MR.renderAddFriendsDialog(); },
    "close-add-friends": () => addFriendsDialog.close(),
    "add-friend": (b) => addFriend(b.dataset.friendId),
    "export-events": () => exportEvents(),
    "clear-data": () => clearData()
  };

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".visit-friend-typeahead")) {
      const { search, options } = friendPicker();
      if (options) options.hidden = true;
      if (search) search.setAttribute("aria-expanded", "false");
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { event.preventDefault(); MR.setView(viewButton.dataset.view); return; }
    const actionButton = event.target.closest("[data-action]");
    if (actionButton && ACTIONS[actionButton.dataset.action]) ACTIONS[actionButton.dataset.action](actionButton);
  });

  // A comparison can't be dismissed with Escape: the visitor finishes the choice (see ui-dialogs.js).
  compareDialog.addEventListener("cancel", (event) => { if (MR.ui.comparison) event.preventDefault(); });
  addFriendsDialog.addEventListener("click", (event) => { if (event.target === addFriendsDialog) addFriendsDialog.close(); });

  // ----- Typing and filters -----

  const SEARCHES = {
    "museum-search": (value) => { MR.ui.search = value; MR.renderMuseumGrid(); },
    "leaderboard-search": (value) => { MR.ui.leaderboardSearch = value; document.querySelector("#leaderboard-results").innerHTML = MR.renderLeaderboardResults(); },
    "add-friend-search": (value) => { MR.ui.addFriendSearch = value; document.querySelector("#add-friend-results").innerHTML = MR.renderAddFriendResults(); },
    "ranking-friends-search": (value) => { MR.ui.rankingSearch = value; document.querySelector("#friend-ranking-results").innerHTML = MR.renderFriendRankingResults(); },
    "visit-friend-search": (value) => showFriendOptions(value, true)
  };
  document.addEventListener("input", (event) => SEARCHES[event.target.id]?.(event.target.value));

  const FILTERS = { "museum-status-filter": "status", "category-filter": "category", "location-filter": "location" };
  document.addEventListener("change", (event) => {
    const key = FILTERS[event.target.id];
    if (!key) return;
    MR.ui[key] = event.target.value;
    MR.refreshDirectory();
  });

  document.addEventListener("focusin", (event) => {
    if (event.target.id === "visit-friend-search") showFriendOptions(event.target.value, true);
  });
  document.addEventListener("focusout", (event) => {
    if (event.target.id !== "visit-friend-search") return;
    window.setTimeout(() => {
      const { search, options } = friendPicker();
      if (!search || document.activeElement?.closest(".visit-friend-typeahead")) return;
      search.value = "";
      if (options) options.hidden = true;
      search.setAttribute("aria-expanded", "false");
    }, 0);
  });

  // ----- Form submits -----

  function saveNote(form) {
    const field = form.elements.note;
    const error = form.querySelector("#visit-note-error");
    if (field.value.length > MR.VISIT_NOTE_LIMIT) {
      error.textContent = `Shorten your note to ${MR.VISIT_NOTE_LIMIT} characters or fewer.`;
      field.setAttribute("aria-invalid", "true");
      field.focus();
      return;
    }
    field.removeAttribute("aria-invalid");
    const visitId = form.dataset.visitId;
    const visits = MR.state.visits.map((visit) => visit.id === visitId ? { ...visit, note: field.value.trim() } : visit);
    if (!MR.commit({ ...MR.state, visits })) {
      error.textContent = "Your note could not be saved in this browser. Try again.";
      return;
    }
    MR.events.record("note_edited", MR.state.visits.find((visit) => visit.id === visitId)?.museumId);
    visitDialog.close();
    MR.renderView();
    const editButton = content.querySelector(`[data-action="edit-visit-note"][data-id="${CSS.escape(visitId)}"]`);
    const history = editButton?.closest(".rank-visits");
    if (history) history.open = true;
    editButton?.focus();
    MR.showToast("Visit note saved.");
  }

  // Save the visit first; only then start comparisons. A failed save keeps the form open for a retry.
  function saveVisit(form) {
    const data = new FormData(form);
    const museumId = String(data.get("museumId"));
    const visit = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      museumId,
      visitedOn: String(data.get("visitedOn")),
      note: String(data.get("note") || "").trim(),
      companionIds: selectedFriendIds(MR.ui.companions, MR.friends)
    };
    const firstMuseum = MR.state.ranking.length === 0;
    const needsComparison = !firstMuseum && !MR.state.ranking.includes(museumId);
    const saved = MR.commit({
      ...MR.state,
      visits: [...MR.state.visits, visit],
      wishlist: MR.state.wishlist.filter((id) => id !== museumId),
      ranking: firstMuseum ? [museumId] : MR.state.ranking
    });
    if (!saved) {
      MR.events.record("visit_save_failed", museumId);
      form.querySelector(".visit-save-error").textContent = "Your visit could not be saved. Check browser storage and try again.";
      return;
    }
    MR.events.record("visit_logged", museumId);
    visitDialog.close();
    MR.renderView();
    if (needsComparison) MR.beginInsert(museumId);
    else MR.showToast(`Visit to ${MR.byId.get(museumId).shortName} saved and ranked.`);
  }

  function saveProfile(form) {
    const displayName = String(new FormData(form).get("displayName") || "").trim();
    if (MR.commit({ ...MR.state, displayName })) MR.showToast("Your profile was saved in this browser.");
    MR.renderView();
  }

  const FORMS = { "edit-visit-note-form": saveNote, "visit-form": saveVisit, "profile-form": saveProfile };
  document.addEventListener("submit", (event) => {
    const handler = FORMS[event.target.id];
    if (!handler) return;
    event.preventDefault();
    handler(event.target);
  });

  MR.updateHeader();
  MR.renderView();
})();
