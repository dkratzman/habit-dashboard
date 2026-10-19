const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  buildMomentum,
  calculateCurrentStreak,
  calculateLongestStreak,
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
const habits = [
  { id: "workout", label: "Workout", dataKey: "workoutYes", weeklyGoal: 3 },
  { id: "drink", label: "Alcohol / Drinking", dataKey: "drinkYes", lowerIsBetter: true, weeklyGoal: 7 },
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
assert.strictEqual(momentum.recentWindowEnd, "2026-10-11", "the seven-day window should end on the newest saved entry");
assert.strictEqual(momentum.habits[0].current, 2);
assert.strictEqual(momentum.habits[0].recentSuccess, 3);
assert.strictEqual(momentum.habits[0].weeklyGoal, 3);
assert.strictEqual(momentum.habits[0].goalMet, true);
assert.deepStrictEqual(
  momentum.habits[0].recentDays.map(day => day.status),
  ["remaining", "remaining", "remaining", "success", "remaining", "success", "success"],
  "the habit bar should distinguish successful days from the remaining weekly capacity"
);
assert.strictEqual(momentum.habits[1].label, "Alcohol-free");
assert.strictEqual(momentum.habits[1].current, 1);
assert.strictEqual(momentum.habits[1].recentSuccess, 3);
assert.strictEqual(momentum.habits[1].goalMet, false);

const dashboardHtml = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
assert.match(dashboardHtml, /data-dashboard-page-target="home">Home<\/button>/);
assert.match(dashboardHtml, /id="momentum-panel" data-dashboard-page="home"/);
assert.match(dashboardHtml, />7-day habit goals</);
assert.doesNotMatch(dashboardHtml, /Success · missed · no entry/);
assert.match(dashboardHtml, /showPage\("home"\)/);

const settingsHtml = fs.readFileSync(path.resolve(__dirname, "..", "settings.html"), "utf8");
assert.match(settingsHtml, /data-open-weekly-habit-goals/);
assert.match(settingsHtml, /id="weeklyHabitGoalsForm"/);

const preferencesJs = fs.readFileSync(path.resolve(__dirname, "..", "habitPreferences.js"), "utf8");
assert.match(preferencesJs, /habitdash_weekly_habit_goals_v1/);
assert.match(preferencesJs, /defaultWeeklyGoal: 3/);
assert.match(preferencesJs, /defaultWeeklyGoal: 6/);

console.log("Momentum and streak checks passed.");
