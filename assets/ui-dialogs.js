// Controllers behind the dialogs: save, log a visit, edit a note, and the head-to-head comparison.
// Each one builds the next notebook, then MR.commit saves it; nothing changes on screen unless the save succeeded.
(() => {
  "use strict";
  const MR = window.MR;
  const R = window.RankingRules;
  const esc = MR.escapeHtml;
  const { visitDialog, compareDialog } = MR.el;

  // ----- Save (story: Find & save) -----

  MR.toggleSave = (id) => {
    const saved = MR.state.wishlist.includes(id);
    const wishlist = saved ? MR.state.wishlist.filter((savedId) => savedId !== id) : [...MR.state.wishlist, id];
    if (MR.commit({ ...MR.state, wishlist })) {
      MR.events.record(saved ? "museum_unsaved" : "museum_saved", id);
      MR.showToast(saved ? `${MR.byId.get(id).shortName} removed from Want to visit.` : `${MR.byId.get(id).shortName} saved for later.`);
    }
    MR.renderView();
  };

  // ----- Log a visit and edit a note (stories: Log & remember, Edit a memory) -----

  MR.openVisitDialog = (museumId = "") => {
    MR.ui.companions = [];
    const options = MR.museums
      .map((museum) => `<option value="${museum.id}" ${museum.id === museumId ? "selected" : ""}>${esc(museum.shortName)}</option>`).join("");
    visitDialog.innerHTML = `<div class="dialog-inner">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close visit form">×</button>
      <h2 class="dialog-heading" id="visit-dialog-title">Log a museum visit</h2>
      <p class="dialog-subtitle">Add a date and note. You’ll rank this museum before you finish.</p>
      <form class="visit-form" id="visit-form">
        <label class="field">Museum<select name="museumId" required>
          <option value="" disabled ${museumId ? "" : "selected"}>Choose a museum</option>${options}
        </select></label>
        <label class="field">When did you visit?<input type="date" name="visitedOn" value="${MR.today}" max="${MR.today}" required></label>
        <div class="field">
          <label for="visit-friend-search">Who went with you?</label>
          <div class="visit-friend-typeahead">
            <div class="visit-friend-picker">
              <div class="visit-friend-selection" id="visit-friend-selection"></div>
              <input id="visit-friend-search" type="search" placeholder="Search for friends" autocomplete="off"
                role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="visit-friend-options">
            </div>
            <div class="visit-friend-options" id="visit-friend-options" role="listbox" hidden></div>
          </div>
          <span>Only people on your friends list can be tagged.</span>
        </div>
        <label class="field">Anything you want to remember?<textarea name="note" maxlength="${MR.VISIT_NOTE_LIMIT}"
          placeholder="An exhibit, a feeling, a moment… (optional)"></textarea></label>
        <span class="visit-save-error" role="alert"></span>
        <div class="dialog-footer-actions">
          <button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
          <button class="button" type="submit">Save visit</button>
        </div>
      </form>
    </div>`;
    visitDialog.showModal();
  };

  MR.openVisitNoteEditor = (visitId) => {
    const visit = MR.state.visits.find((entry) => entry.id === visitId);
    if (!visit) return;
    visitDialog.innerHTML = `<div class="dialog-inner">
      <button class="dialog-close" type="button" data-action="close-dialog" aria-label="Close note editor">×</button>
      <h2 class="dialog-heading" id="visit-dialog-title">Edit visit note</h2>
      <p class="dialog-subtitle">${esc(MR.byId.get(visit.museumId).shortName)} · ${MR.dateLabel(visit.visitedOn)}</p>
      <form class="visit-form" id="edit-visit-note-form" data-visit-id="${esc(visitId)}">
        <label class="field">Visit note (optional)<textarea name="note" aria-describedby="visit-note-limit visit-note-error" autofocus></textarea></label>
        <small id="visit-note-limit">Up to ${MR.VISIT_NOTE_LIMIT} characters.</small>
        <div id="visit-note-error" role="alert"></div>
        <div class="dialog-footer-actions">
          <button class="button secondary" type="button" data-action="close-dialog">Cancel</button>
          <button class="button" type="submit">Save note</button>
        </div>
      </form>
    </div>`;
    visitDialog.querySelector("textarea").value = visit.note ?? "";
    visitDialog.showModal();
  };

  // ----- Head-to-head comparison (story: Compare & correct; rules in ranking.js) -----
  // Every comparison is a forced choice by design: there is no skip or tie. If two visits feel equal,
  // the visitor picks either and can fix the order later with the arrows on Ranking.

  // MR.ui.comparison is null or one of:
  //   { mode: "seed", first, second, queue }          the first two museums ever ranked
  //   { mode: "insert", queue, candidate, search }    placing each queued museum by binary insertion
  //   { mode: "recompare", first, second }           "Continue ranking" with nothing pending: re-check the top two
  function showPair(firstId, secondId, mode) {
    const choice = (museum) => `<button class="compare-choice accent-${museum.accent}" type="button" data-action="choose-comparison"
        data-winner="${museum.id}" data-mode="${mode}">
        <span class="choice-icon" aria-hidden="true">${esc(museum.monogram)}</span>
        <strong>${esc(museum.shortName)}</strong>
      </button>`;
    compareDialog.innerHTML = `<div class="dialog-inner">
      <p class="eyebrow">Your ranking · head to head</p>
      <h2 class="dialog-heading" id="compare-dialog-title">Which visit did you enjoy more?</h2>
      <p class="dialog-subtitle">Choose the museum you enjoyed more to place it in your ranking.</p>
      <div class="compare-pair">${choice(MR.byId.get(firstId))}<span class="versus">OR</span>${choice(MR.byId.get(secondId))}</div>
      <p class="compare-hint">Feels like a tie? Pick either one. You can move it with the ↑ ↓ arrows on Ranking.</p>
    </div>`;
    if (!compareDialog.open) compareDialog.showModal();
  }

  function endComparison(message) {
    MR.ui.comparison = null;
    compareDialog.close();
    MR.renderView();
    if (message) MR.showToast(message);
  }

  // If a save fails mid-session, stop: the museum stays in "to place" and the earlier order is unchanged.
  function commitRanking(ranking, placedId) {
    if (!MR.commit({ ...MR.state, ranking })) { endComparison(); return false; }
    MR.events.record("comparison_completed", placedId);
    return true;
  }

  MR.beginInsert = (museumId) => {
    MR.ui.comparison = { mode: "insert", queue: [museumId], candidate: null, search: null };
    MR.nextComparison();
  };

  MR.startRanking = () => {
    const queue = R.pendingIds(MR.state.visits, MR.state.ranking);
    const ranking = MR.state.ranking;
    if (ranking.length === 0 && queue.length < 2) {
      if (queue.length === 1 && MR.commit({ ...MR.state, ranking: [queue[0]] })) {
        MR.renderView();
        MR.showToast("Your first museum is in the ranking. Visit another to compare it.");
      } else if (queue.length === 0) MR.showToast("Log visits to two different museums to begin.");
      return;
    }
    if (queue.length === 0) {
      if (ranking.length > 1) {
        MR.ui.comparison = { mode: "recompare", first: ranking[0], second: ranking[1] };
        showPair(ranking[0], ranking[1], "recompare");
      } else MR.showToast("Log a visit to another museum to compare your ranking.");
      return;
    }
    MR.ui.comparison = ranking.length === 0
      ? { mode: "seed", first: queue.shift(), second: queue.shift(), queue }
      : { mode: "insert", queue, candidate: null, search: null };
    MR.nextComparison();
  };

  MR.nextComparison = () => {
    const session = MR.ui.comparison;
    if (!session) return;
    if (session.mode !== "insert") { showPair(session.first, session.second, session.mode); return; }
    if (!session.candidate) {
      session.candidate = session.queue.shift();
      if (!session.candidate) { endComparison("Your ranking is up to date."); return; }
      session.search = R.startSearch(MR.state.ranking);
    }
    if (R.isPlaced(session.search)) {
      if (!commitRanking(R.insertAt(MR.state.ranking, session.candidate, session.search.low), session.candidate)) return;
      session.candidate = null;
      MR.nextComparison();
      return;
    }
    showPair(session.candidate, MR.state.ranking[R.opponentIndex(session.search)], "insert");
  };

  MR.chooseComparison = (winnerId) => {
    const session = MR.ui.comparison;
    if (!session) return;
    if (session.mode === "recompare") {
      if (commitRanking([...R.seed(session.first, session.second, winnerId), ...MR.state.ranking.slice(2)], winnerId)) endComparison();
      return;
    }
    if (session.mode === "seed") {
      if (!commitRanking(R.seed(session.first, session.second, winnerId), winnerId)) return;
      Object.assign(session, { mode: "insert", candidate: null, search: null });
    } else {
      session.search = R.narrow(session.search, winnerId === session.candidate);
    }
    MR.nextComparison();
  };

  MR.moveRank = (id, direction) => {
    const ranking = R.moveRank(MR.state.ranking, id, direction);
    if (ranking !== MR.state.ranking && MR.commit({ ...MR.state, ranking })) MR.events.record("rank_moved", id);
    MR.renderView();
  };
})();
