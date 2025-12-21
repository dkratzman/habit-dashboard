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
// Date formatting
// -------------------------
function formatDate(dateString) {
  if (!dateString) return "";
  const clean = dateString.split("T")[0];
  const [y, m, d] = clean.split("-");
  return `${m}/${d}/${y.slice(-2)}`;
}

// -------------------------
// Map DB row → internal format
// -------------------------
function mapRow(row) {
  return {
    date: row.timestamp,

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

  let s = str.toLowerCase().trim();
  const isPM = s.endsWith("pm") || s.endsWith("p");
  const isAM = s.endsWith("am") || s.endsWith("a");

  s = s.replace(/[ap]m?$/, "").trim();
  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  let value = hours + minutes / 60;
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
    document.getElementById("startMonth").value = "";
    document.getElementById("endMonth").value = "";
    buildCharts(allData);
  });
}

function getFilteredData() {
  const start = document.getElementById("startMonth").value;
  const end = document.getElementById("endMonth").value;

  return allData.filter(d => {
    if (start && d.date < `${start}-01`) return false;
    if (end) {
      const [y, m] = end.split("-");
      const last = new Date(y, m, 0).getDate();
      if (d.date > `${end}-${last}`) return false;
    }
    return true;
  });
}

// -------------------------
// Destroy charts
// -------------------------
function destroyCharts() {
  ratingsChart?.destroy();
  sleepChart?.destroy();
  habitChart?.destroy();
}

// -------------------------
// BUILD CHARTS
// -------------------------
function buildCharts(data) {
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
  ratingsChart = new Chart(document.getElementById("ratingsChart"), {
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

  // ---- Sleep chart (SMOOTH)
  sleepChart = new Chart(document.getElementById("sleepChart"), {
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
        },
        x: { ticks: { color: theme.textColor } },
      },
    },
  });

  // ---- Habit bar chart (FIXED)
  const monthGroups = {};

  sorted.forEach(d => {
    const [year, month] = d.date.split("T")[0].split("-");
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

  habitChart = new Chart(document.getElementById("habitChart"), {
    type: "bar",
    data: {
      labels: keys.map(k => {
        const [y, m] = k.split("-");
        return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
        x: { ticks: { color: theme.textColor } },
      },
    },
  });

  // ---- Daily notes table
  const tbody = document.getElementById("dailyTableBody");
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

  allData = data.map(mapRow);
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

