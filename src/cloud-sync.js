// Merge rules for the cloud copy of a Google user's data. Pure functions, no
// DOM or network, so they run under node for tests (tests/cloud-sync.test.js).
//
// Document shape (stored as one JSON file in Drive appDataFolder):
//   { app, kind, version, updatedAt,
//     history:      practice records, newest first      -> union, capped
//     grammarCache: cached AI grammar analyses          -> union, newest wins per sentence
//     settings:     { values: {storageKey: json|null}, updatedAt } -> newest wins as a whole }
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.langLSRWCloudSync = api;
})(typeof self !== "undefined" ? self : this, function () {
  const HISTORY_LIMIT = 80;
  const GRAMMAR_CACHE_LIMIT = 500;
  const SETTINGS_KEYS = [
    "langLSRWShortcuts",
    "langLSRWSpeechSettings",
    "langLSRWFontSettings",
    "langLSRWGrammarColors"
  ];

  function time(value) {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function historyKey(record) {
    return `${record?.at || ""}|${record?.sentence || ""}`;
  }

  function grammarKey(record) {
    return `${record?.framework || ""}|${record?.key || record?.sentence || ""}`;
  }

  function mergeHistory(local, remote) {
    const byKey = new Map();
    [...(remote || []), ...(local || [])].forEach((record) => {
      if (record && record.at) byKey.set(historyKey(record), record);
    });
    return [...byKey.values()]
      .sort((a, b) => time(b.at) - time(a.at))
      .slice(0, HISTORY_LIMIT);
  }

  function mergeGrammarCache(local, remote) {
    const byKey = new Map();
    [...(remote || []), ...(local || [])].forEach((record) => {
      if (!record || !(record.key || record.sentence)) return;
      const key = grammarKey(record);
      const existing = byKey.get(key);
      if (!existing || time(record.savedAt) >= time(existing.savedAt)) byKey.set(key, record);
    });
    return [...byKey.values()]
      .sort((a, b) => time(b.savedAt) - time(a.savedAt))
      .slice(0, GRAMMAR_CACHE_LIMIT);
  }

  function mergeSettings(local, remote) {
    if (!remote?.values) return local;
    if (!local?.values) return remote;
    return time(remote.updatedAt) > time(local.updatedAt) ? remote : local;
  }

  function merge(local, remote) {
    return {
      app: "langLSRW",
      kind: "cloud-sync",
      version: 1,
      history: mergeHistory(local?.history, remote?.history),
      grammarCache: mergeGrammarCache(local?.grammarCache, remote?.grammarCache),
      settings: mergeSettings(local?.settings, remote?.settings)
    };
  }

  // Compare documents ignoring the top-level timestamp, to skip no-op uploads.
  function sameContent(a, b) {
    if (!a || !b) return false;
    const strip = ({ updatedAt, ...rest }) => rest;
    return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  }

  return { SETTINGS_KEYS, merge, mergeHistory, mergeGrammarCache, mergeSettings, sameContent };
});
