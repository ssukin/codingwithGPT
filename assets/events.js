// Pilot event log: the charter's OEC events, kept in this browser so a facilitator can export them
// after a test session. Only event names, times and museum IDs are kept: never notes or friend names.
//
// How the events line up with the charter's stories and OECs (attempts are counted by the observer):
// - Find & save: museum_saved / museum_unsaved; website_opened when the visitor checks official info.
// - Log & remember: visit_logged on success, visit_save_failed when the browser refuses the write.
// - Compare & correct: comparison_completed per museum placed; rank_moved per arrow correction;
//   ranking_viewed when Ranking opens (the "return to my ranking" signal for the retention hypothesis).
// - Edit a memory: note_edited. Any refused write also logs storage_failed: the in-app "it broke" signal.
(function (root) {
  "use strict";

  const EVENTS_KEY = "museum-rankings-events-v1";
  const MAX_EVENTS = 500;
  const EVENT_NAMES = [
    "website_opened", "museum_saved", "museum_unsaved", "visit_logged", "visit_save_failed",
    "comparison_completed", "ranking_viewed", "rank_moved", "note_edited", "storage_failed"
  ];

  function createEventLog(storage, clock = () => new Date().toISOString(), logger = null) {
    function read() {
      try {
        const events = JSON.parse(storage.getItem(EVENTS_KEY) || "[]");
        return Array.isArray(events) ? events : [];
      } catch { return []; }
    }
    // Unknown names and any field other than museumId are dropped, so personal text can't be logged.
    function record(name, museumId) {
      if (!EVENT_NAMES.includes(name)) return null;
      const event = { name, at: clock(), ...(typeof museumId === "string" && museumId ? { museumId } : {}) };
      if (logger) logger(`[museum-rankings] ${name}${event.museumId ? " " + event.museumId : ""}`);
      try { storage.setItem(EVENTS_KEY, JSON.stringify([...read(), event].slice(-MAX_EVENTS))); } catch {}
      return event;
    }
    // Counts per event name: what a facilitator compares against the OECs after a session.
    function summary() {
      return read().reduce((counts, event) => ({ ...counts, [event.name]: (counts[event.name] || 0) + 1 }), {});
    }
    function clear() {
      try { storage.removeItem(EVENTS_KEY); } catch {}
    }
    return { record, read, summary, clear };
  }

  const api = { EVENTS_KEY, EVENT_NAMES, MAX_EVENTS, createEventLog };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.MuseumEvents = api;
    root.museumEvents = createEventLog(root.localStorage, undefined, (line) => console.debug(line));
  }
})(typeof window !== "undefined" ? window : globalThis);
