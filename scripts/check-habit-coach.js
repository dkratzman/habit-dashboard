const assert = require("assert");
const { buildInsights, findHabitAssociation } = require("../habitCoach.js");

const workout = {
  id: "workout",
  label: "Workout",
  dataKey: "workoutYes",
};

const entries = [
  { date: "2026-09-01", overallFeeling: 5, workoutYes: true },
  { date: "2026-09-02", overallFeeling: 4, workoutYes: true },
  { date: "2026-09-03", overallFeeling: 5, workoutYes: true },
  { date: "2026-09-04", overallFeeling: 4, workoutYes: true },
  { date: "2026-09-05", overallFeeling: 2, workoutYes: false },
  { date: "2026-09-06", overallFeeling: 3, workoutYes: false },
  { date: "2026-09-07", overallFeeling: 2, workoutYes: false },
  { date: "2026-09-08", overallFeeling: 3, workoutYes: false },
];

const weeklySummary = {
  current: { ratings: { overallAvg: 4.2, overallCount: 5 } },
  previous: { ratings: { overallAvg: 3.4, overallCount: 4 } },
};

const association = findHabitAssociation(entries, [workout]);
assert(association, "expected a qualifying habit association");
assert.strictEqual(association.habit.id, "workout");
assert.strictEqual(association.favorableCount, 4);
assert.strictEqual(association.comparisonCount, 4);
assert.strictEqual(association.difference, 2);

const drinkingAssociation = findHabitAssociation(
  entries.map((entry, index) => ({ ...entry, drinkYes: index >= 4 })),
  [{ id: "drink", label: "Alcohol / Drinking", dataKey: "drinkYes", lowerIsBetter: true }]
);
assert(drinkingAssociation, "expected alcohol-free days to be treated as favorable");
assert.strictEqual(drinkingAssociation.favorableCount, 4);
assert.strictEqual(drinkingAssociation.difference, 2);

const insights = buildInsights(entries, weeklySummary, [workout]);
assert.strictEqual(insights.length, 3, "coach should always produce three concise cards");
assert.match(insights[0].title, /moved up/i);
assert.match(insights[1].body, /association, not proof of cause/i);
assert.match(insights[2].title, /experiment/i);

const sparseInsights = buildInsights([], {
  current: { ratings: { overallAvg: 4, overallCount: 1 } },
  previous: { ratings: { overallAvg: null, overallCount: 0 } },
}, [workout]);
assert.match(sparseInsights[0].title, /more data/i);
assert.match(sparseInsights[1].title, /no reliable habit signal/i);
assert.match(sparseInsights[2].body, /complete week/i);

console.log("Habit Coach checks passed.");
