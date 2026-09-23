// Merge rules for the cloud copy of a Google user's data. Pure functions, no
// DOM or network, so they run under node for tests (tests/cloud-sync.test.js).
//
// Main document (langLSRW/langlsrw-data.json in the user's Drive):
//   { app, kind, version, updatedAt,
//     history:      practice records, newest first      -> union, capped
//     grammarCache: cached AI grammar analyses          -> union, newest wins per sentence
//     settings:     { values: {storageKey: json|null}, updatedAt } -> newest wins as a whole
//     progress:     { activeLibraryId, positions: {libraryId: index}, mode, updatedAt }
//                                                       -> newest wins as a whole }
// Sentence libraries are separate TSV files in langLSRW/libraries/; see
// planLibrarySync for how they reconcile.
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

  function mergeProgress(local, remote) {
    if (!remote) return local;
    if (!local) return remote;
    return time(remote.updatedAt) > time(local.updatedAt) ? remote : local;
  }

  function merge(local, remote) {
    return {
      app: "langLSRW",
      kind: "cloud-sync",
      version: 1,
      history: mergeHistory(local?.history, remote?.history),
      grammarCache: mergeGrammarCache(local?.grammarCache, remote?.grammarCache),
      settings: mergeSettings(local?.settings, remote?.settings),
      progress: mergeProgress(local?.progress, remote?.progress)
    };
  }

  // Reconcile local libraries with the TSV files in Drive.
  //   local:      [{ id, name, updatedAt, driveFileId }]
  //   remote:     [{ fileId, libraryId, name, updatedAt }]  (non-trashed files)
  //   tombstones: library ids deleted locally since the last sync
  // A library that was synced before (has driveFileId) but is gone from Drive
  // was deleted there by the user, so it is deleted locally too.
  function planLibrarySync({ local = [], remote = [], tombstones = [] } = {}) {
    const plan = { download: [], upload: [], rename: [], deleteLocal: [], trashRemote: [] };
    const deleted = new Set(tombstones);
    const localById = new Map(local.map((library) => [library.id, library]));
    const seen = new Set();

    remote.forEach((file) => {
      if (!file.libraryId || deleted.has(file.libraryId) || seen.has(file.libraryId)) {
        plan.trashRemote.push(file.fileId);
        return;
      }
      seen.add(file.libraryId);
      const library = localById.get(file.libraryId);
      if (!library) {
        plan.download.push(file);
      } else if (time(file.updatedAt) > time(library.updatedAt)) {
        plan.download.push(file);
      } else if (time(library.updatedAt) > time(file.updatedAt)) {
        plan.upload.push({ library, fileId: file.fileId });
      } else if (file.name && file.name !== library.name) {
        plan.rename.push({ id: library.id, name: file.name, fileId: file.fileId });
      } else if (library.driveFileId !== file.fileId) {
        plan.rename.push({ id: library.id, name: library.name, fileId: file.fileId });
      }
    });

    local.forEach((library) => {
      if (seen.has(library.id)) return;
      if (library.driveFileId) plan.deleteLocal.push(library.id);
      else plan.upload.push({ library, fileId: "" });
    });
    return plan;
  }

  // Library file <-> TSV text. One sentence per line: id, English, translation.
  function libraryToTsv(items) {
    const clean = (value) => String(value || "").replace(/[\t\r\n]+/g, " ").trim();
    return items.map((item, index) => [clean(item.id) || String(index + 1), clean(item.text), clean(item.translation)].join("\t")).join("\n") + "\n";
  }

  // Compare documents ignoring the top-level timestamp, to skip no-op uploads.
  function sameContent(a, b) {
    if (!a || !b) return false;
    const strip = ({ updatedAt, ...rest }) => rest;
    return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
  }

  return {
    SETTINGS_KEYS,
    merge,
    mergeHistory,
    mergeGrammarCache,
    mergeSettings,
    mergeProgress,
    planLibrarySync,
    libraryToTsv,
    sameContent
  };
});
