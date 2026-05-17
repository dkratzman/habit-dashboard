console.log("input.js loaded");

const ONBOARDING_ENTRY_REDIRECT_KEY = "habitdash_onboarding_entry_redirect_v1";
const calendarState = {
  visibleDate: new Date(),
  selectedDate: "",
  entryDates: new Set()
};
const TIME_OPTIONS = {
  timeBed: [
    "8:00p", "8:30p", "9:00p", "9:30p", "10:00p", "10:30p", "11:00p", "11:30p",
    "12:00a", "12:30a", "1:00a", "1:30a", "2:00a", "2:30a", "3:00a", "3:30a"
  ],
  timeUp: [
    "4:00a", "4:30a", "5:00a", "5:30a", "6:00a", "6:30a", "7:00a", "7:30a",
    "8:00a", "8:30a", "9:00a", "9:30a", "10:00a", "10:30a", "11:00a"
  ]
};
const HOUR_GOALS = {
  hoursWorked: 8,
  hoursPersonal: 2
};

function getActiveTimeGoals() {
  return typeof getTimeGoals === "function"
    ? getTimeGoals()
    : {
        timeBed: "10:30p",
        timeUp: "7:00a",
        ...HOUR_GOALS,
      };
}

// --------------------------------------
// Auth Helpers
// --------------------------------------
async function getCurrentUserId() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

async function requireInputAuth() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
  }
}

// Enforce auth immediately
requireInputAuth();

// --------------------------------------
// Main Init
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupLogout();
  if (typeof applyHabitVisibility === "function") applyHabitVisibility();
  setupQuickEntryOrder();
  setupEntryCalendar();
  setupFirstEntryGuide();
  setupRequiredTimeGoalsPrompt();
  setupHabitToggles();
  setupAllButtonGroups();
  setupTimeSteppers();
  loadLastSubmissionSummary();
  setupFormSubmit();
});

function setupQuickEntryOrder() {
  const form = document.getElementById("dailyForm");
  if (!form) return;

  [
    document.querySelector(".date-picker-row"),
    document.querySelector(".habit-section"),
    document.querySelector(".rating-section"),
    ...document.querySelectorAll(".time-entry-row"),
    ...document.querySelectorAll(".notes-entry-row"),
    form.querySelector('button[type="submit"]'),
    document.getElementById("saveStatus")
  ].filter(Boolean).forEach(element => {
    form.appendChild(element);
  });
}

function setupRequiredTimeGoalsPrompt() {
  if (typeof hasTimeGoals === "function" && hasTimeGoals()) return;

  const modal = document.getElementById("requiredTimeGoalsModal");
  if (!modal || typeof setupTimeGoalsForm !== "function") return;

  setupTimeGoalsForm({
    formId: "inputTimeGoalsForm",
    saveButtonId: "saveInputTimeGoals",
    statusId: "inputTimeGoalsStatus",
    onSave: () => {
      modal.hidden = true;
      applyCurrentTimeGoalsToSteppers();
    },
  });

  modal.hidden = false;
}

// --------------------------------------
// Entry Calendar
// --------------------------------------
function setupEntryCalendar() {
  const dateInput = document.getElementById("date");
  const prevBtn = document.getElementById("calendarPrevMonth");
  const nextBtn = document.getElementById("calendarNextMonth");
  if (!dateInput) return;

  const todayIso = getLocalDateKey(new Date());
  selectCalendarDate(dateInput.value || todayIso, { moveMonth: true, render: false });

  prevBtn?.addEventListener("click", () => {
    calendarState.visibleDate = new Date(
      calendarState.visibleDate.getFullYear(),
      calendarState.visibleDate.getMonth() - 1,
      1
    );
    loadCalendarEntryStatuses();
  });

  nextBtn?.addEventListener("click", () => {
    calendarState.visibleDate = new Date(
      calendarState.visibleDate.getFullYear(),
      calendarState.visibleDate.getMonth() + 1,
      1
    );
    loadCalendarEntryStatuses();
  });

  loadCalendarEntryStatuses();
}

async function loadCalendarEntryStatuses() {
  const userId = await getCurrentUserId();
  if (!userId) {
    renderEntryCalendar();
    return;
  }

  const year = calendarState.visibleDate.getFullYear();
  const month = calendarState.visibleDate.getMonth();
  const monthStart = getLocalDateKey(new Date(year, month, 1));
  const monthEnd = getLocalDateKey(new Date(year, month + 1, 0));

  const { data, error } = await supabaseClient
    .from("daily_entries")
    .select("timestamp")
    .eq("user_id", userId)
    .gte("timestamp", monthStart)
    .lte("timestamp", monthEnd);

  if (error) {
    console.error("Calendar status load failed:", error);
    calendarState.entryDates = new Set();
    renderEntryCalendar();
    return;
  }

  calendarState.entryDates = new Set(
    (data || [])
      .map(row => formatSubmissionDate(row.timestamp))
      .filter(Boolean)
  );
  renderEntryCalendar();
}

function renderEntryCalendar() {
  const grid = document.getElementById("entryCalendarGrid");
  const monthLabel = document.getElementById("calendarMonthLabel");
  if (!grid) return;

  const year = calendarState.visibleDate.getFullYear();
  const month = calendarState.visibleDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = getLocalDateKey(new Date());

  if (monthLabel) {
    monthLabel.textContent = firstDay.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric"
    });
  }

  grid.innerHTML = "";

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-day-spacer";
    grid.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = getLocalDateKey(date);
    const hasEntry = calendarState.entryDates.has(dateKey);
    const isPastOrToday = dateKey <= todayKey;
    const status = hasEntry ? "has-entry" : isPastOrToday ? "needs-entry" : "upcoming";
    const button = document.createElement("button");

    button.type = "button";
    button.className = `calendar-day ${status}`;
    button.dataset.date = dateKey;
    button.setAttribute("aria-pressed", String(dateKey === calendarState.selectedDate));
    button.setAttribute("aria-label", `${formatCalendarDisplayDate(date)}, ${getCalendarStatusLabel(status)}`);
    if (dateKey === calendarState.selectedDate) button.classList.add("selected");
    if (dateKey === todayKey) button.classList.add("today");

    button.innerHTML = `
      <span class="calendar-day-number">${day}</span>
      <span class="calendar-status-dot" aria-hidden="true"></span>
    `;
    button.addEventListener("click", () => selectCalendarDate(dateKey));
    grid.appendChild(button);
  }
}

function selectCalendarDate(dateKey, options = {}) {
  const { moveMonth = false, render = true } = options;
  const dateInput = document.getElementById("date");
  if (!dateKey) return;

  const parsed = parseLocalDateKey(dateKey);
  calendarState.selectedDate = dateKey;
  if (moveMonth && parsed) {
    calendarState.visibleDate = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }

  if (dateInput) dateInput.value = dateKey;
  if (render) renderEntryCalendar();
}

function parseLocalDateKey(dateKey) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function getLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatCalendarDisplayDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

function getCalendarStatusLabel(status) {
  if (status === "has-entry") return "entry complete";
  if (status === "needs-entry") return "waiting on data";
  return "upcoming";
}

// --------------------------------------
// Logout
// --------------------------------------
function setupLogout() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    try {
      await supabaseClient.auth.signOut();
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
    }
  });
}

// --------------------------------------
// Button Groups
// --------------------------------------
function setupButtonGroup(group) {
  const inputId = group.dataset.inputId;
  const hiddenInput = document.getElementById(inputId);
  const buttons = group.querySelectorAll(".btn-option");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      hiddenInput.value = btn.dataset.value;
    });
  });
}

function setupAllButtonGroups() {
  document
    .querySelectorAll(".button-group")
    .forEach(setupButtonGroup);
}

function setupHabitToggles() {
  document.querySelectorAll(".habit-toggle").forEach(toggle => {
    const input = document.getElementById(toggle.dataset.inputId);
    const tile = toggle.closest(".form-row.inline");
    if (!input) return;

    syncHabitToggle(toggle, input.value === "Yes");

    tile?.setAttribute("role", "button");
    tile?.setAttribute("tabindex", "0");
    tile?.addEventListener("click", () => {
      syncHabitToggle(toggle, input.value !== "Yes");
    });
    tile?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      syncHabitToggle(toggle, input.value !== "Yes");
    });
  });
}

function syncHabitToggle(toggle, isOn) {
  const input = document.getElementById(toggle.dataset.inputId);
  if (!input) return;

  input.value = isOn ? "Yes" : "No";
  toggle.textContent = isOn ? "Yes" : "No";
  toggle.classList.toggle("selected", isOn);
  toggle.setAttribute("aria-pressed", String(isOn));

  const tile = toggle.closest(".form-row.inline");
  tile?.classList.toggle("habit-yes", isOn);
  tile?.classList.toggle("habit-no", !isOn);
  tile?.setAttribute("aria-pressed", String(isOn));
}

function setupTimeSteppers() {
  document.querySelectorAll(".time-stepper").forEach(stepper => {
    const inputId = stepper.dataset.inputId;
    const options = TIME_OPTIONS[inputId];
    const input = document.getElementById(inputId);
    if (!options || !input) return;

    const goals = getActiveTimeGoals();
    syncTimeStepper(stepper, getSafeTimeOption(inputId, goals[inputId] || input.value || options[0]));

    stepper.querySelectorAll(".stepper-btn").forEach(button => {
      button.addEventListener("click", () => {
        const currentIndex = Math.max(0, options.indexOf(getSafeTimeOption(inputId, input.value)));
        const nextIndex = clampNumber(currentIndex + Number(button.dataset.step), 0, options.length - 1);
        syncTimeStepper(stepper, options[nextIndex]);
      });
    });
  });

  document.querySelectorAll(".number-stepper").forEach(stepper => {
    const inputId = stepper.dataset.inputId;
    const input = document.getElementById(inputId);
    if (!input) return;

    const goals = getActiveTimeGoals();
    const goalValue = Number(goals[inputId] ?? HOUR_GOALS[inputId] ?? 0);
    stepper.dataset.goal = String(goalValue);
    syncNumberStepper(stepper, goalValue);

    stepper.querySelectorAll(".stepper-btn").forEach(button => {
      button.addEventListener("click", () => {
        syncNumberStepper(stepper, Number(input.value) + Number(button.dataset.step));
      });
    });

    stepper.querySelector(".zero-time-btn")?.addEventListener("click", () => {
      syncNumberStepper(stepper, 0);
    });
  });
}

function applyCurrentTimeGoalsToSteppers() {
  const goals = getActiveTimeGoals();
  document.querySelectorAll(".time-stepper").forEach(stepper => {
    const inputId = stepper.dataset.inputId;
    syncTimeStepper(stepper, goals[inputId]);
  });
  document.querySelectorAll(".number-stepper").forEach(stepper => {
    const inputId = stepper.dataset.inputId;
    const goalValue = Number(goals[inputId] ?? HOUR_GOALS[inputId] ?? 0);
    stepper.dataset.goal = String(goalValue);
    syncNumberStepper(stepper, goalValue);
  });
}

function syncTimeStepper(stepper, value) {
  const input = document.getElementById(stepper.dataset.inputId);
  const output = stepper.querySelector(".stepper-value");
  const safeValue = getSafeTimeOption(stepper.dataset.inputId, value);
  if (input) input.value = safeValue;
  if (output) output.textContent = safeValue;
  syncTimeGoalState(stepper, safeValue);
}

function getSafeTimeOption(inputId, value) {
  const options = TIME_OPTIONS[inputId] || [];
  if (!options.length) return value;
  if (options.includes(value)) return value;
  return options[0];
}

function syncTimeGoalState(stepper, value) {
  const inputId = stepper.dataset.inputId;
  const options = TIME_OPTIONS[inputId] || [];
  const goals = getActiveTimeGoals();
  const goalValue = getSafeTimeOption(inputId, goals[inputId]);
  const valueIndex = options.indexOf(value);
  const goalIndex = options.indexOf(goalValue);
  if (valueIndex < 0 || goalIndex < 0) return;

  const isAtOrEarlierThanGoal = valueIndex <= goalIndex;
  const distance = Math.abs(valueIndex - goalIndex);
  const range = isAtOrEarlierThanGoal ? Math.max(1, goalIndex) : Math.max(1, options.length - 1 - goalIndex);
  const intensity = 0.1 + (Math.min(distance, range) / range) * 0.16;

  stepper.classList.toggle("goal-met", isAtOrEarlierThanGoal);
  stepper.classList.toggle("goal-missed", !isAtOrEarlierThanGoal);
  stepper.style.setProperty("--goal-intensity", intensity.toFixed(3));
  stepper.style.setProperty("--goal-border-intensity", Math.min(0.5, intensity + 0.12).toFixed(3));
}

function syncNumberStepper(stepper, value) {
  const input = document.getElementById(stepper.dataset.inputId);
  const output = stepper.querySelector(".stepper-value");
  const min = Number(stepper.dataset.min ?? 0);
  const max = Number(stepper.dataset.max ?? 14);
  const goals = getActiveTimeGoals();
  const goal = Number(stepper.dataset.goal ?? goals[stepper.dataset.inputId] ?? HOUR_GOALS[stepper.dataset.inputId] ?? 0);
  const safeValue = clampNumber(value, min, max);

  if (input) input.value = String(safeValue);
  if (output) output.textContent = `${safeValue} ${safeValue === 1 ? "hr" : "hrs"}`;
  syncHourGoalState(stepper, safeValue, goal, max);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function syncHourGoalState(stepper, value, goal, max) {
  if (!goal) return;

  const isAtOrAboveGoal = value >= goal;
  const distance = isAtOrAboveGoal
    ? Math.min(value - goal, max - goal)
    : Math.min(goal - value, goal);
  const range = isAtOrAboveGoal ? Math.max(1, max - goal) : goal;
  const intensity = 0.1 + (distance / range) * 0.16;

  stepper.classList.toggle("goal-met", isAtOrAboveGoal);
  stepper.classList.toggle("goal-missed", !isAtOrAboveGoal);
  stepper.style.setProperty("--goal-intensity", intensity.toFixed(3));
  stepper.style.setProperty("--goal-border-intensity", Math.min(0.5, intensity + 0.12).toFixed(3));
}

// --------------------------------------
// Form Submission
// --------------------------------------
function setupFormSubmit() {
  const form = document.getElementById("dailyForm");

  if (!form) {
    console.error("dailyForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    try {
      const userId = await getCurrentUserId();

      if (!userId) {
        showSaveStatus("You are not logged in.", true);
        return;
      }

      const entry = buildEntryFromForm(userId);
      console.log("Submitting entry:", entry);

      const existingEntry = await findExistingEntryForDate(userId, entry.timestamp);
      let saveResult;

      if (existingEntry) {
        const shouldOverwrite = await confirmOverwrite(entry.timestamp);
        if (!shouldOverwrite) {
          showSaveStatus("Save canceled. Existing entry was not changed.");
          return;
        }

        saveResult = await updateExistingEntry(existingEntry, entry, userId);
      } else {
        saveResult = await supabaseClient
          .from("daily_entries")
          .insert([entry])
          .select("id");
      }

      if (saveResult.error) {
        console.error("Save error:", saveResult.error);
        showSaveStatus("Error saving entry.", true);
        return;
      }

      if (!saveResult.data?.length) {
        console.error("Save returned no rows:", saveResult);
        showSaveStatus("Overwrite blocked. Supabase update policy may need to be enabled.", true);
        return;
      }

      showSaveStatus(existingEntry ? "Entry updated successfully!" : "Entry saved successfully!");
      renderLastSubmissionSummary(entry);
      calendarState.entryDates.add(entry.timestamp);
      resetDailyFormToDefaults(entry.timestamp);

      if (
        localStorage.getItem(ONBOARDING_ENTRY_REDIRECT_KEY) === "true" ||
        new URLSearchParams(window.location.search).get("fromOnboarding") === "1"
      ) {
        localStorage.removeItem(ONBOARDING_ENTRY_REDIRECT_KEY);
        setTimeout(() => {
          window.location.href = "index.html?fromFirstEntry=1";
        }, 900);
      }

    } catch (err) {
      console.error("Unexpected submit error:", err);
      showSaveStatus("Unexpected error occurred.", true);
    }
  });
}

async function updateExistingEntry(existingEntry, entry, userId) {
  const byId = await supabaseClient
    .from("daily_entries")
    .update(entry)
    .eq("id", existingEntry.id)
    .eq("user_id", userId)
    .select("id");

  if (byId.error || byId.data?.length) return byId;

  console.warn("Update by id returned no rows. Retrying by date.", byId);

  return supabaseClient
    .from("daily_entries")
    .update(entry)
    .eq("user_id", userId)
    .eq("timestamp", existingEntry.timestamp)
    .select("id");
}

async function findExistingEntryForDate(userId, date) {
  if (!date) return null;

  const { data, error } = await supabaseClient
    .from("daily_entries")
    .select("id, timestamp")
    .eq("user_id", userId)
    .eq("timestamp", date)
    .limit(1);

  if (error) {
    console.error("Existing entry check failed:", error);
    throw error;
  }

  return data?.[0] || null;
}

function confirmOverwrite(date) {
  const modal = document.getElementById("overwriteEntryModal");
  const message = document.getElementById("overwriteEntryMessage");
  const cancelBtn = document.getElementById("overwriteCancel");
  const confirmBtn = document.getElementById("overwriteConfirm");

  if (!modal || !cancelBtn || !confirmBtn) {
    return Promise.resolve(window.confirm("An entry already exists for this date. Overwrite it?"));
  }

  if (message) {
    message.textContent = `Data has already been entered for ${date}. Do you want to overwrite that entry?`;
  }

  modal.hidden = false;

  return new Promise(resolve => {
    const cleanup = (result) => {
      modal.hidden = true;
      cancelBtn.removeEventListener("click", onCancel);
      confirmBtn.removeEventListener("click", onConfirm);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    };

    const onCancel = () => cleanup(false);
    const onConfirm = () => cleanup(true);
    const onKeydown = (event) => {
      if (event.key === "Escape") cleanup(false);
    };

    cancelBtn.addEventListener("click", onCancel);
    confirmBtn.addEventListener("click", onConfirm);
    document.addEventListener("keydown", onKeydown);
  });
}

function resetDailyFormToDefaults(dateKey) {
  const form = document.getElementById("dailyForm");
  const goals = getActiveTimeGoals();
  form?.reset();

  document.querySelectorAll(".habit-toggle").forEach(toggle => {
    syncHabitToggle(toggle, false);
  });

  resetButtonGroupToValue("overall", "3");
  resetButtonGroupToValue("physical", "3");
  resetButtonGroupToValue("mental", "3");
  resetButtonGroupToValue("energy", "3");
  resetTimeStepperToValue("timeBed", goals.timeBed);
  resetTimeStepperToValue("timeUp", goals.timeUp);
  resetNumberStepperToValue("hoursWorked", goals.hoursWorked);
  resetNumberStepperToValue("hoursPersonal", goals.hoursPersonal);

  selectCalendarDate(dateKey);
}

function resetTimeStepperToValue(inputId, value) {
  const stepper = document.querySelector(`.time-stepper[data-input-id="${inputId}"]`);
  if (stepper) syncTimeStepper(stepper, value);
}

function resetNumberStepperToValue(inputId, value) {
  const stepper = document.querySelector(`.number-stepper[data-input-id="${inputId}"]`);
  if (stepper) syncNumberStepper(stepper, value);
}

function resetButtonGroupToValue(inputId, value) {
  const input = document.getElementById(inputId);
  const group = document.querySelector(`.button-group[data-input-id="${inputId}"]`);
  if (input) input.value = value;
  if (!group) return;

  group.querySelectorAll(".btn-option").forEach(button => {
    button.classList.toggle("selected", button.dataset.value === value);
  });
}

async function loadLastSubmissionSummary() {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabaseClient
    .from("daily_entries")
    .select("timestamp, overall_feeling, keyword")
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Last submission load failed:", error);
    return;
  }

  renderLastSubmissionSummary(data?.[0] || null);
}

function renderLastSubmissionSummary(entry) {
  setLastSubmissionText("lastSubmissionDate", formatSubmissionDate(entry?.timestamp));
  setLastSubmissionText("lastSubmissionOverall", entry?.overall_feeling ?? "—");
  setLastSubmissionText("lastSubmissionKeyword", entry?.keyword || "—");
}

function setLastSubmissionText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatSubmissionDate(value) {
  if (!value) return "—";
  return String(value).includes("T") ? String(value).split("T")[0] : String(value);
}

function setupFirstEntryGuide() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("fromOnboarding") !== "1") return;

  const guide = document.getElementById("firstEntryGuide");
  const continueBtn = document.getElementById("firstEntryContinue");
  const backBtn = document.getElementById("firstEntryBack");
  const dateInput = document.getElementById("date");
  if (!guide) return;

  if (dateInput) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    selectCalendarDate(getLocalDateKey(yesterday), { moveMonth: true });
  }

  guide.hidden = false;
  continueBtn?.addEventListener("click", () => {
    guide.hidden = true;
    dateInput?.focus();
  });

  backBtn?.addEventListener("click", () => {
    window.location.href = "index.html?onboardingHabitSetup=1";
  });
}

// --------------------------------------
// Status Message Helper
// --------------------------------------
function showSaveStatus(message, isError = false) {
  const status = document.getElementById("saveStatus");
  if (!status) return;

  status.textContent = message;
  status.style.color = isError ? "#dc2626" : "#16a34a";

  setTimeout(() => {
    status.textContent = "";
  }, 3000);
}

// --------------------------------------
// Build DB Row
// --------------------------------------
function buildEntryFromForm(userId) {
  return {
    timestamp: document.getElementById("date").value,

    time_up: document.getElementById("timeUp").value || null,
    time_in_bed: document.getElementById("timeBed").value || null,

    worked_out: getTrackedHabitValue("workout"),
    journaled: getTrackedHabitValue("journal"),
    read_books: getTrackedHabitValue("read"),
    drank: getTrackedHabitValue("drink"),
    low_media: getTrackedHabitValue("media"),
    piano: getTrackedHabitValue("piano"),
    office: getTrackedHabitValue("office"),
    hit_goal: getTrackedHabitValue("hitGoal"),

    hours_worked: Number(document.getElementById("hoursWorked").value),
    hours_personal: Number(document.getElementById("hoursPersonal").value),

    overall_feeling: Number(document.getElementById("overall").value),
    physical_feeling: Number(document.getElementById("physical").value),
    mental_feeling: Number(document.getElementById("mental").value),
    energy: Number(document.getElementById("energy").value),

    keyword: document.getElementById("keyword").value.trim() || null,
    summary: document.getElementById("summary").value.trim() || null,

    user_id: userId
  };
}

// --------------------------------------
// Helpers
// --------------------------------------
function getHidden(id) {
  const v = document.getElementById(id)?.value;
  if (v === "Yes") return true;
  if (v === "No") return false;
  return null;
}

function getTrackedHabitValue(id) {
  if (typeof isHabitEnabled === "function" && !isHabitEnabled(id)) {
    return null;
  }
  return getHidden(id);
}

