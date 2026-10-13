const assert = require("assert");
const {
  formatEditDateLabel,
  mapDatabaseEntryToForm,
  normalizeStoredTime,
  preserveDisabledHabitValues,
} = require("../entryEditor.js");

assert.strictEqual(normalizeStoredTime("22:30:00"), "10:30p");
assert.strictEqual(normalizeStoredTime("07:00:00"), "7:00a");
assert.strictEqual(normalizeStoredTime("10:30pm"), "10:30p");

const model = mapDatabaseEntryToForm({
  id: "entry-1",
  timestamp: "2026-10-11T00:00:00Z",
  time_in_bed: "22:30:00",
  time_up: "07:00:00",
  hours_worked: 8,
  hours_personal: 2,
  overall_feeling: 4,
  physical_feeling: 3,
  mental_feeling: 5,
  energy: 4,
  worked_out: true,
  journaled: false,
  keyword: "Focused",
  summary: "A productive day.",
});

assert.strictEqual(model.date, "2026-10-11");
assert.strictEqual(model.timeBed, "10:30p");
assert.strictEqual(model.timeUp, "7:00a");
assert.strictEqual(model.ratings.mental, 5);
assert.strictEqual(model.habits.workout, true);
assert.strictEqual(model.habits.journal, false);
assert.strictEqual(model.keyword, "Focused");
assert.match(formatEditDateLabel("2026-10-11"), /October 11, 2026/);

const nextEntry = { worked_out: false, journaled: null };
preserveDisabledHabitValues(
  nextEntry,
  { worked_out: true, journaled: true },
  ["workout"]
);
assert.strictEqual(nextEntry.worked_out, false, "enabled habits should use the edited value");
assert.strictEqual(nextEntry.journaled, true, "disabled habits should retain the stored value");

console.log("Past-entry editor checks passed.");
