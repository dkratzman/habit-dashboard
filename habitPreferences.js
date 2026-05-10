// habitPreferences.js
// Fixed habit catalog + local display preferences. No database schema changes.

const HABIT_PREFERENCES_STORAGE_KEY = "habitdash_enabled_habits_v1";

const HABIT_DEFINITIONS = [
  {
    id: "workout",
    label: "Workout",
    description: "Any intentional exercise, training, or workout session.",
    inputId: "workout",
    dataKey: "workoutYes",
    summaryKey: "workouts",
    chartKey: "workout",
    color: "#10b981",
  },
  {
    id: "journal",
    label: "Journal",
    description: "A written journal entry, vlog, or intentional reflection.",
    inputId: "journal",
    dataKey: "journalYes",
    summaryKey: "journaling",
    chartKey: "journal",
    color: "#3b82f6",
  },
  {
    id: "read",
    label: "Read / Audiobook",
    description: "Reading or listening to an audiobook for personal growth or enjoyment.",
    inputId: "read",
    dataKey: "readYes",
    summaryKey: "reading",
    chartKey: "read",
    color: "#6366f1",
  },
  {
    id: "drink",
    label: "Alcohol / Drinking",
    description: "Whether you drank alcohol that day. Fewer drinking days are treated as positive.",
    inputId: "drink",
    dataKey: "drinkYes",
    summaryKey: "drinking",
    chartKey: "drink",
    color: "#ef4444",
    lowerIsBetter: true,
  },
  {
    id: "media",
    label: "Low Media",
    description: "Whether you spent less than 2 hours on social media that day.",
    inputId: "media",
    dataKey: "mediaYes",
    summaryKey: "lowMedia",
    chartKey: "media",
    color: "#f59e0b",
  },
  {
    id: "piano",
    label: "Music Practice",
    description: "Practicing music, such as piano, guitar, voice, or another instrument.",
    inputId: "piano",
    dataKey: "pianoYes",
    summaryKey: "piano",
    chartKey: "piano",
    color: "#a855f7",
  },
  {
    id: "office",
    label: "Office / Work Location",
    description: "Whether you went into the office to work instead of working from home.",
    inputId: "office",
    dataKey: "officeYes",
    summaryKey: "office",
    chartKey: "office",
    color: "#0ea5e9",
  },
  {
    id: "hitGoal",
    label: "Hit Work Goal",
    description: "Whether you met the main work goal you set for that day.",
    inputId: "hitGoal",
    dataKey: "goalYes",
    summaryKey: "hitGoal",
    chartKey: "goal",
    color: "#22c55e",
  },
];

function getAllHabitIds() {
  return HABIT_DEFINITIONS.map(habit => habit.id);
}

function getStoredHabitIds() {
  try {
    const raw = localStorage.getItem(HABIT_PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const validIds = new Set(getAllHabitIds());
    return parsed.filter(id => validIds.has(id));
  } catch (e) {
    console.warn("Could not read habit preferences", e);
    return null;
  }
}

function getEnabledHabitIds() {
  const stored = getStoredHabitIds();
  return stored && stored.length ? stored : getAllHabitIds();
}

function setEnabledHabitIds(ids) {
  const validIds = new Set(getAllHabitIds());
  const nextIds = ids.filter(id => validIds.has(id));
  localStorage.setItem(
    HABIT_PREFERENCES_STORAGE_KEY,
    JSON.stringify(nextIds.length ? nextIds : getAllHabitIds())
  );
}

function hasHabitPreferences() {
  return Array.isArray(getStoredHabitIds());
}

function getEnabledHabitDefinitions() {
  const enabled = new Set(getEnabledHabitIds());
  return HABIT_DEFINITIONS.filter(habit => enabled.has(habit.id));
}

function isHabitEnabled(id) {
  return getEnabledHabitIds().includes(id);
}

function applyHabitVisibility(root = document) {
  root.querySelectorAll("[data-habit-id]").forEach(el => {
    el.hidden = !isHabitEnabled(el.dataset.habitId);
  });
}

function setupHabitPreferencesForm({ formId, saveButtonId, statusId, onSave } = {}) {
  const form = document.getElementById(formId);
  const saveBtn = document.getElementById(saveButtonId);
  const status = document.getElementById(statusId);
  if (!form || !saveBtn) return;

  function render() {
    const enabled = new Set(getEnabledHabitIds());
    form.innerHTML = HABIT_DEFINITIONS.map(habit => `
      <label class="habit-choice">
        <input type="checkbox" value="${habit.id}" ${enabled.has(habit.id) ? "checked" : ""}>
        <span>
          <strong>${habit.label}</strong>
          <small>${habit.description}</small>
        </span>
      </label>
    `).join("");
  }

  saveBtn.addEventListener("click", () => {
    const selected = Array.from(form.querySelectorAll("input:checked")).map(input => input.value);
    if (!selected.length) {
      if (status) status.textContent = "Choose at least one habit.";
      return;
    }
    setEnabledHabitIds(selected);
    applyHabitVisibility();
    if (status) {
      status.textContent = "Saved.";
      setTimeout(() => { status.textContent = ""; }, 1800);
    }
    if (typeof onSave === "function") onSave();
    window.dispatchEvent(new CustomEvent("habitdash:habit-preferences-updated"));
  });

  render();
}

window.HABIT_DEFINITIONS = HABIT_DEFINITIONS;
window.HABIT_PREFERENCES_STORAGE_KEY = HABIT_PREFERENCES_STORAGE_KEY;
window.getEnabledHabitIds = getEnabledHabitIds;
window.setEnabledHabitIds = setEnabledHabitIds;
window.hasHabitPreferences = hasHabitPreferences;
window.getEnabledHabitDefinitions = getEnabledHabitDefinitions;
window.isHabitEnabled = isHabitEnabled;
window.applyHabitVisibility = applyHabitVisibility;
window.setupHabitPreferencesForm = setupHabitPreferencesForm;
