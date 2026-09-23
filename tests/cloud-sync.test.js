const assert = require("node:assert/strict");
const { test } = require("node:test");
const sync = require("../src/cloud-sync.js");

const record = (at, sentence = "Hi.") => ({ sentence, accuracy: 100, at });

test("history is a de-duplicated union, newest first, capped at 80", () => {
  const shared = record("2026-09-20T10:00:00Z");
  const local = [record("2026-09-23T10:00:00Z"), shared];
  const remote = [shared, record("2026-09-21T10:00:00Z", "Run.")];
  const merged = sync.mergeHistory(local, remote);
  assert.deepEqual(merged.map((r) => r.at), [
    "2026-09-23T10:00:00Z",
    "2026-09-21T10:00:00Z",
    "2026-09-20T10:00:00Z"
  ]);

  const many = Array.from({ length: 100 }, (_, i) => record(new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()));
  const capped = sync.mergeHistory(many, []);
  assert.equal(capped.length, 80);
  assert.equal(capped[0].at, many[99].at);
});

test("history ignores malformed records", () => {
  assert.deepEqual(sync.mergeHistory([null, { sentence: "x" }], undefined), []);
});

test("grammar cache keeps the newer analysis of the same sentence", () => {
  const older = { key: "Hi.", framework: "traditional", grammar: "old", savedAt: "2026-09-01T00:00:00Z" };
  const newer = { key: "Hi.", framework: "traditional", grammar: "new", savedAt: "2026-09-10T00:00:00Z" };
  const other = { key: "Run.", framework: "traditional", grammar: "run", savedAt: "2026-09-05T00:00:00Z" };
  assert.deepEqual(sync.mergeGrammarCache([older], [newer, other]).map((r) => r.grammar), ["new", "run"]);
  assert.deepEqual(sync.mergeGrammarCache([newer], [older]).map((r) => r.grammar), ["new"]);
});

test("grammar cache keeps different frameworks for the same sentence apart", () => {
  const a = { key: "Hi.", framework: "traditional", savedAt: "2026-09-01T00:00:00Z" };
  const b = { key: "Hi.", framework: "sieg2-cgel", savedAt: "2026-09-01T00:00:00Z" };
  assert.equal(sync.mergeGrammarCache([a], [b]).length, 2);
});

test("settings: the most recently changed side wins as a whole", () => {
  const local = { values: { langLSRWShortcuts: "{\"a\":1}" }, updatedAt: "2026-09-02T00:00:00Z" };
  const remote = { values: { langLSRWShortcuts: "{\"a\":2}" }, updatedAt: "2026-09-01T00:00:00Z" };
  assert.equal(sync.mergeSettings(local, remote), local);
  assert.equal(sync.mergeSettings({ ...local, updatedAt: "1970-01-01T00:00:00.000Z" }, remote), remote);
  assert.equal(sync.mergeSettings(local, null), local);
  assert.equal(sync.mergeSettings(null, remote), remote);
});

test("merge output is stable, so an unchanged sync skips the upload", () => {
  const local = {
    history: [record("2026-09-20T10:00:00Z")],
    grammarCache: [],
    settings: { values: {}, updatedAt: "1970-01-01T00:00:00.000Z" }
  };
  const first = { ...sync.merge(local, null), updatedAt: "2026-09-23T00:00:00Z" };
  const roundTrip = JSON.parse(JSON.stringify(first));
  const second = sync.merge(local, roundTrip);
  assert.ok(sync.sameContent(second, roundTrip));
  assert.ok(!sync.sameContent(sync.merge({ ...local, history: [record("2026-09-24T00:00:00Z")] }, roundTrip), roundTrip));
});
