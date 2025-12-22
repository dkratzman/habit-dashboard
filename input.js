console.log("input.js loaded");

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
  setupAllButtonGroups();
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

      const { error } = await supabaseClient
        .from("daily_entries")
        .insert([entry]);

      if (error) {
        console.error("Insert error:", error);
        showSaveStatus("Error saving entry.", true);
        return;
      }

      showSaveStatus("Entry saved successfully!");
      form.reset();

      document
        .querySelectorAll(".btn-option.selected")
        .forEach(btn => btn.classList.remove("selected"));

    } catch (err) {
      console.error("Unexpected submit error:", err);
      showSaveStatus("Unexpected error occurred.", true);
    }
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

    worked_out: getHidden("workout"),
    journaled: getHidden("journal"),
    read_books: getHidden("read"),
    drank: getHidden("drink"),
    low_media: getHidden("media"),
    piano: getHidden("piano"),
    office: getHidden("office"),
    hit_goal: getHidden("hitGoal"),

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

