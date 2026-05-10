console.log("input.js loaded");

const ONBOARDING_ENTRY_REDIRECT_KEY = "habitdash_onboarding_entry_redirect_v1";

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
  setupFirstEntryGuide();
  setupAllButtonGroups();
  loadLastSubmissionSummary();
  setupFormSubmit();
});

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
      form.reset();

      document
        .querySelectorAll(".btn-option.selected")
        .forEach(btn => btn.classList.remove("selected"));

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

  if (dateInput && !dateInput.value) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, "0");
    const d = String(yesterday.getDate()).padStart(2, "0");
    dateInput.value = `${y}-${m}-${d}`;
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

