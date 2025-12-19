// --------------------------------------
// Supabase Setup
// --------------------------------------
const SUPABASE_URL = "https://jqbtpdtvsgmpedddnerp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxYnRwZHR2c2dtcGVkZGRuZXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTMwNTAsImV4cCI6MjA4MDg2OTA1MH0.z9qLJ2zJZSwq3NPC98fEQDm3vPY8YKgG6Z43cfn28vs";

const supabaseClient = window.supabaseClient;


async function getCurrentUserId() {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user?.id || null;
}

async function requireInputAuth() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return;
  }
}

requireInputAuth();

// --------------------------------------
// Main Initialization
// --------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupAllButtonGroups();
  setupFormSubmit();
});

// --------------------------------------
// Button Group Logic (Universal)
// --------------------------------------
function setupButtonGroup(group) {
  const inputId = group.dataset.inputId;     // e.g. "timeUp"
  const hiddenInput = document.getElementById(inputId);
  const buttons = group.querySelectorAll(".btn-option");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Remove selected from siblings
      buttons.forEach((b) => b.classList.remove("selected"));

      // Add selected to clicked one
      btn.classList.add("selected");

      // Store value
      hiddenInput.value = btn.dataset.value;

      console.log(`${inputId} selected:`, hiddenInput.value);
    });
  });
}

function setupAllButtonGroups() {
  document
    .querySelectorAll(".button-group")
    .forEach((group) => setupButtonGroup(group));
}

// --------------------------------------
// Form Submission
// --------------------------------------

function setupFormSubmit() {
  const form = document.getElementById("dailyForm");
  const status = document.getElementById("saveStatus");

  if (!form) {
    console.error("ERROR: dailyForm not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userId = await getCurrentUserId();

  if (!userId) {
    status.textContent = "You must be logged in to save entries.";
    status.style.color = "red";
    return; // ✅ legal here
  }

  const entry = buildEntryFromForm(userId);

  console.log("Submitting entry:", entry);

  const { error } = await supabaseClient
    .from("daily_entries")
    .insert([entry]);

  if (error) {
    console.error("Insert error:", error);
    status.textContent = "Error saving entry.";
    status.style.color = "red";
  } else {
    status.textContent = "Entry saved successfully!";
    status.style.color = "green";
    form.reset();
  }
});

}

// --------------------------------------
// Build Database Row From Form
// --------------------------------------
function buildEntryFromForm(userId) {
  return {
    // Timestamp comes from HTML id="date"
    timestamp: document.getElementById("date").value,

    // Time selectors
    time_up: document.getElementById("timeUp").value || null,
    time_in_bed: document.getElementById("timeBed").value || null,

    // Yes/No habits (button groups)
    worked_out: getHidden("workout"),
    journaled: getHidden("journal"),
    read_books: getHidden("read"),
    drank: getHidden("drink"),
    low_media: getHidden("media"),
    piano: getHidden("piano"),
    office: getHidden("office"),
    hit_goal: getHidden("hitGoal"),

    // Hours worked / personal
    hours_worked: Number(document.getElementById("hoursWorked").value),
    hours_personal: Number(document.getElementById("hoursPersonal").value),

    // Ratings
    overall_feeling: Number(document.getElementById("overall").value),
    physical_feeling: Number(document.getElementById("physical").value),
    mental_feeling: Number(document.getElementById("mental").value),
    energy: Number(document.getElementById("energy").value),

    // Keyword + Summary
    keyword: document.getElementById("keyword").value.trim(),
    summary: document.getElementById("summary").value.trim(),

    user_id: userId
  };
}

// Helper for hidden Yes/No fields
function getHidden(id) {
  const v = document.getElementById(id)?.value;
  if (v === "Yes") return true;
  if (v === "No") return false;
  return null;
}


function getNumber(id) {
  const v = document.getElementById(id).value;
  return v ? Number(v) : null;
}
