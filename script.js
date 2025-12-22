console.log("✅ script.js loaded");
console.log("Chart available?", typeof Chart);

// -------------------------
// State
// -------------------------
let allData = [];
let ratingsChart = null;
let sleepChart = null;
let habitChart = null;

// -------------------------
// Chart theme helper
// -------------------------
function getChartTheme() {
  const isDark = document.body.classList.contains("dark");
  return {
    textColor: isDark ? "#f9fafb" : "#374151",
    gridColor: isDark ? "rgba(255,255,255,0.15)" : "#e5e7eb",
  };
}

// -------------------------
// Auth guard
// -------------------------
async function requireDashboardAuth() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return false;
  }

  const userEmailEl = document.getElementById("userEmail");
  if (userEmailEl) {
    userEmailEl.textContent = `Logged in as ${data.session.user.email}`;
  }

  return true;
}

// -------------------------
// Date helpers
// -------------------------
function normalizeDateOnlyISO(dateLike) {
  // Accepts: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ss...", Date, etc.
  if (!dateLike) return "";

  if (dateLike instanceof Date) {
    const y = dateLike.getFullYear();
    const m = String(dateLike.getMonth() + 1).padStart(2, "0");
    const d = String(dateLike.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(dateLike);
  // If ISO timestamp, split off time
  const datePart = s.includes("T") ? s.split("T")[0] : s;
  // If already YYYY-MM-DD, return as-is (basic sanity)
  return datePart;
}

function isoDateToLocalDate(isoDateOnly) {
  // Treat date-only as local midnight for stable comparisons
  if (!isoDateOnly) return null;
  return new Date(`${isoDateOnly}T00:00:00`);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const clean = normalizeDateOnlyISO(dateString);
  const [y, m, d] = clean.split("-");
  if (!y || !m || !d) return "";
  return `${m}/${d}/${y.slice(-2)}`;
}

// -------------------------
// Map DB row → internal format
// -------------------------
function mapRow(row) {
  const dateOnly = normalizeDateOnlyISO(row.timestamp);

  return {
    // Store as YYYY-MM-DD only (no time)
    date: dateOnly,

    overallFeeling: Number(row.overall_feeling),
    physicalFeeling: row.physical_feeling != null ? Number(row.physical_feeling) : null,
    mentalFeeling: row.mental_feeling != null ? Number(row.mental_feeling) : null,
    energyFeeling: row.energy != null ? Number(row.energy) : null,

    workoutYes: !!row.worked_out,
    journalYes: !!row.journaled,
    readYes: !!row.read_books,
    drinkYes: !!row.drank,
    mediaYes: !!row.low_media,
    pianoYes: !!row.piano,
    officeYes: !!row.office,
    goalYes: !!row.hit_goal,

    timeUpHours: parseTimeToHours(row.time_up),
    timeInBedHours: parseTimeToHours(row.time_in_bed),

    dailyKeyword: row.keyword || "",
    dailySummary: row.summary || "",
  };
}

// -------------------------
// Time parsing
// -------------------------
function parseTimeToHours(str) {
  if (!str) return null;

  let s = String(str).toLowerCase().trim();
  const isPM = s.endsWith("pm") || s.endsWith("p");
  const isAM = s.endsWith("am") || s.endsWith("a");

  s = s.replace(/[ap]m?$/, "").trim();
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;
  if (hours < 0 || hours > 12) {
    // If someone enters 13:00 style, allow it (24-hr) if no AM/PM detected
    if (!isAM && !isPM && hours <= 23) {
      // keep as-is
    } else {
      return null;
    }
  }

  // 12-hr conversion if AM/PM provided
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  let value = hours + minutes / 60;

  // Your chart expects late night / early morning to show as 24+ (e.g., 1am -> 25)
  if (value < 12) value += 24;

  return value;
}

// -------------------------
// Filters
// -------------------------
function setupFilters() {
  document.getElementById("applyFilter")?.addEventListener("click", () => {
    buildCharts(getFilteredData());
  });

  document.getElementById("resetFilter")?.addEventListener("click", () => {
    const startEl = document.getElementById("startMonth");
    const endEl = document.getElementById("endMonth");
    if (startEl) startEl.value = "";
    if (endEl) endEl.value = "";
    buildCharts(allData);
  });
}

function getFilteredData() {
  const start = document.getElementById("startMonth")?.value || "";
  const end = document.getElementById("endMonth")?.value || "";

  let startDate = null;
  let endDate = null;

  // start/end are expected as "YYYY-MM"
  if (start) {
    startDate = new Date(`${start}-01T00:00:00`);
  }

  if (end) {
    const [y, m] = end.split("-").map(v => parseInt(v, 10));
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      // last day of end month
      const lastDay = new Date(y, m, 0).getDate();
      endDate = new Date(`${end}-${String(lastDay).padStart(2, "0")}T23:59:59`);
    }
  }

  return allData.filter(d => {
    const dDate = isoDateToLocalDate(d.date);
    if (!dDate) return false;

    if (startDate && dDate < startDate) return false;
    if (endDate && dDate > endDate) return false;
    return true;
  });
}

// -------------------------
// Destroy charts
// -------------------------
function destroyCharts() {
  try {
    ratingsChart?.destroy();
  } catch (e) {
    console.warn("ratingsChart destroy failed:", e);
  } finally {
    ratingsChart = null;
  }

  try {
    sleepChart?.destroy();
  } catch (e) {
    console.warn("sleepChart destroy failed:", e);
  } finally {
    sleepChart = null;
  }

  try {
    habitChart?.destroy();
  } catch (e) {
    console.warn("habitChart destroy failed:", e);
  } finally {
    habitChart = null;
  }
}

// -------------------------
// BUILD CHARTS
// -------------------------
function buildCharts(data) {
  if (typeof Chart !== "function") {
    console.error("Chart.js is not available. Cannot build charts.");
    return;
  }

  destroyCharts();
  const theme = getChartTheme();

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(d => formatDate(d.date));

  const feelingValues = sorted.map(d => d.overallFeeling);
  const physicalValues = sorted.map(d => d.physicalFeeling);
  const mentalValues = sorted.map(d => d.mentalFeeling);
  const energyValues = sorted.map(d => d.energyFeeling);

  const timeUpValues = sorted.map(d => d.timeUpHours);
  const bedTimeValues = sorted.map(d => d.timeInBedHours);

  // ---- Ratings chart (SMOOTH)
  const ratingsCanvas = document.getElementById("ratingsChart");
  if (ratingsCanvas) {
    ratingsChart = new Chart(ratingsCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Overall", data: feelingValues, borderColor: "#3b82f6", tension: 0.3 },
          { label: "Physical", data: physicalValues, borderColor: "#f97316", tension: 0.3 },
          { label: "Mental", data: mentalValues, borderColor: "#22c55e", tension: 0.3 },
          { label: "Energy", data: energyValues, borderColor: "#a855f7", tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: theme.textColor } } },
        scales: {
          x: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
          y: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
        },
      },
    });
  } else {
    console.warn("ratingsChart canvas not found.");
  }

  // ---- Sleep chart (SMOOTH)
  const sleepCanvas = document.getElementById("sleepChart");
  if (sleepCanvas) {
    sleepChart = new Chart(sleepCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Time Up", data: timeUpValues, borderColor: "#0ea5e9", tension: 0.3 },
          { label: "Time in Bed", data: bedTimeValues, borderColor: "#ef4444", tension: 0.3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: theme.textColor } } },
        scales: {
          y: {
            min: 20,
            max: 35,
            ticks: {
              color: theme.textColor,
              callback: v => {
                const h = v % 24;
                const ampm = h >= 12 ? "pm" : "am";
                return `${((h + 11) % 12) + 1}${ampm}`;
              },
            },
            grid: { color: theme.gridColor },
          },
          x: {
            ticks: { color: theme.textColor },
            grid: { color: theme.gridColor },
          },
        },
      },
    });
  } else {
    console.warn("sleepChart canvas not found.");
  }

  // ---- Habit bar chart
  const monthGroups = {};

  sorted.forEach(d => {
    // d.date is YYYY-MM-DD
    const [year, month] = d.date.split("-");
    if (!year || !month) return;

    const key = `${year}-${month}`;

    if (!monthGroups[key]) {
      monthGroups[key] = {
        total: 0,
        workout: 0,
        journal: 0,
        read: 0,
        drink: 0,
        media: 0,
        piano: 0,
        office: 0,
        goal: 0,
      };
    }

    const g = monthGroups[key];
    g.total++;
    if (d.workoutYes) g.workout++;
    if (d.journalYes) g.journal++;
    if (d.readYes) g.read++;
    if (d.drinkYes) g.drink++;
    if (d.mediaYes) g.media++;
    if (d.pianoYes) g.piano++;
    if (d.officeYes) g.office++;
    if (d.goalYes) g.goal++;
  });

  const keys = Object.keys(monthGroups).sort();
  const pct = (v, t) => (t ? (v / t) * 100 : 0);

  const habitCanvas = document.getElementById("habitChart");
  if (habitCanvas) {
    habitChart = new Chart(habitCanvas, {
      type: "bar",
      data: {
        labels: keys.map(k => {
          const [y, m] = k.split("-");
          return new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });
        }),
        datasets: [
          { label: "Workout", data: keys.map(k => pct(monthGroups[k].workout, monthGroups[k].total)), backgroundColor: "#10b981" },
          { label: "Journal", data: keys.map(k => pct(monthGroups[k].journal, monthGroups[k].total)), backgroundColor: "#3b82f6" },
          { label: "Read", data: keys.map(k => pct(monthGroups[k].read, monthGroups[k].total)), backgroundColor: "#6366f1" },
          { label: "Drink", data: keys.map(k => pct(monthGroups[k].drink, monthGroups[k].total)), backgroundColor: "#ef4444" },
          { label: "< 2 hrs Media", data: keys.map(k => pct(monthGroups[k].media, monthGroups[k].total)), backgroundColor: "#f59e0b" },
          { label: "Piano", data: keys.map(k => pct(monthGroups[k].piano, monthGroups[k].total)), backgroundColor: "#a855f7" },
          { label: "Office", data: keys.map(k => pct(monthGroups[k].office, monthGroups[k].total)), backgroundColor: "#0ea5e9" },
          { label: "Hit Goal", data: keys.map(k => pct(monthGroups[k].goal, monthGroups[k].total)), backgroundColor: "#22c55e" },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: theme.textColor } } },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { color: theme.textColor, callback: v => `${v}%` },
            grid: { color: theme.gridColor },
          },
          x: {
            ticks: { color: theme.textColor },
            grid: { color: theme.gridColor },
          },
        },
      },
    });
  } else {
    console.warn("habitChart canvas not found.");
  }

  // ---- Daily notes table
  const tbody = document.getElementById("dailyTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    sorted.forEach(d => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatDate(d.date)}</td>
        <td>${d.dailyKeyword}</td>
        <td>${d.dailySummary}</td>
        <td>${d.overallFeeling ?? ""}</td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    console.warn("dailyTableBody not found.");
  }
}

// -------------------------
// Load data
// -------------------------
window.addEventListener("load", async () => {
  if (!(await requireDashboardAuth())) return;

  const { data, error } = await supabaseClient
    .from("daily_entries")
    .select("*")
    .order("timestamp", { ascending: true });

  if (error) return console.error(error);

  allData = (data || []).map(mapRow);
  setupFilters();
  buildCharts(allData);
});

// -------------------------
// Logout
// -------------------------
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
});


