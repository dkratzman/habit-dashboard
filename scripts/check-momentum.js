const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  buildMomentum,
  calculateCurrentStreak,
  calculateLongestStreak,
  streakProgress,
  toDayNumber,
} = require("../momentum.js");

const days = (...dates) => new Set(dates.map(toDayNumber));

assert.deepStrictEqual(
  calculateCurrentStreak(
    days("2026-10-09", "2026-10-10", "2026-10-11"),
    days("2026-10-09", "2026-10-10", "2026-10-11"),
    "2026-10-12"
  ),
  { count: 3, anchorDate: "2026-10-11" },
  "a streak through yesterday should remain active before today's entry"
);

assert.strictEqual(
  calculateCurrentStreak(
    days("2026-10-10", "2026-10-11"),
    days("2026-10-10", "2026-10-11", "2026-10-12"),
    "2026-10-12"
  ).count,
  0,
  "a tracked failure today should end a habit streak"
);

assert.strictEqual(
  calculateLongestStreak(days("2026-10-01", "2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06")),
  3
);
assert.strictEqual(streakProgress(3, 8), 38);
assert.strictEqual(streakProgress(8, 8), 100);
assert.strictEqual(streakProgress(0, 0), 0);

const habits = [
  { id: "workout", label: "Workout", dataKey: "workoutYes" },
  { id: "drink", label: "Alcohol / Drinking", dataKey: "drinkYes", lowerIsBetter: true },
];
const momentum = buildMomentum([
  { date: "2026-10-08", workoutYes: true, drinkYes: false },
  { date: "2026-10-09", workoutYes: false, drinkYes: false },
  { date: "2026-10-10", workoutYes: true, drinkYes: true },
  { date: "2026-10-11", workoutYes: true, drinkYes: false },
  { date: "2026-10-13", workoutYes: true, drinkYes: false },
  { date: "2026-10-14", workoutYes: true, drinkYes: false },
  { date: "2026-10-15", workoutYes: true, drinkYes: false },
  { date: "2026-10-16", workoutYes: true, drinkYes: false },
  { date: "2026-10-17", workoutYes: true, drinkYes: false },
], habits, "2026-10-12");

assert.strictEqual(momentum.currentCheckInStreak, 4);
assert.strictEqual(momentum.longestCheckInStreak, 4);
assert.strictEqual(momentum.recentLoggedDays, 4);
assert.strictEqual(momentum.totalEntries, 4, "future entries should not affect current momentum");
assert.strictEqual(momentum.habits[0].current, 2);
assert.strictEqual(momentum.habits[1].label, "Alcohol-free");
assert.strictEqual(momentum.habits[1].current, 1);
assert.strictEqual(momentum.habits[1].recentSuccess, 3);

const dashboardHtml = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
assert.match(dashboardHtml, /data-dashboard-page-target="home">Home<\/button>/);
assert.match(dashboardHtml, /id="momentum-panel" data-dashboard-page="home"/);
assert.match(dashboardHtml, /showPage\("home"\)/);

console.log("Momentum and streak checks passed.");
