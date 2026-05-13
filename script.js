console.log("✅ script.js loaded");
console.log("Chart available?", typeof Chart);

// -------------------------
// State
// -------------------------
let allData = [];
let ratingsChart = null;
let sleepChart = null;
let habitChart = null;
let hoursChart = null;

const IS_DASHBOARD =
  document.getElementById("ratingsChart") !== null;

// -------------------------
// Session / Persistent Login
// -------------------------
// V1: store a minimal Supabase session snapshot in localStorage.
// No passwords stored. No backend changes.
const SESSION_STORAGE_KEY = "habitdash_session_v1";

function _sessionToStorable(session) {
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user ? { id: session.user.id, email: session.user.email } : null,
  };
}

function saveSessionToLocalStorage(session) {
  try {
    const payload = _sessionToStorable(session);
    if (!payload) return;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("⚠️ Could not save session to localStorage", e);
  }
}

function loadSessionFromLocalStorage() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("⚠️ Could not read session from localStorage", e);
    return null;
  }
}

function clearSessionFromLocalStorage() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn("⚠️ Could not clear session from localStorage", e);
  }
}

// Try to ensure Supabase has an active session.
// 1) If Supabase already has one, keep localStorage in sync.
// 2) Else if localStorage has one, restore via setSession().
async function ensureSession() {
  // First: see if Supabase already has a session
  const { data: existing } = await supabaseClient.auth.getSession();
  if (existing?.session) {
    saveSessionToLocalStorage(existing.session);
    return existing.session;
  }

  // Second: try to restore from our localStorage snapshot
  const saved = loadSessionFromLocalStorage();
  if (saved?.access_token && saved?.refresh_token) {
    const { data: restored, error } = await supabaseClient.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
    });

    if (!error && restored?.session) {
      saveSessionToLocalStorage(restored.session);
      return restored.session;
    }
  }

  return null;
}

// Keep localStorage synced as Supabase refreshes tokens / signs out
try {
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session) saveSessionToLocalStorage(session);
    else clearSessionFromLocalStorage();
  });
} catch (e) {
  // If auth listeners aren’t available for some reason, fail silently.
  console.warn("⚠️ auth.onAuthStateChange unavailable", e);
}

// -------------------------
// Time Allocation config (logic only)
// -------------------------
const HOURS_CHART_CONFIG = {
  stacked: false,
  weekly: false,
  workGoal: 8,
  personalGoal: 2,
};

window.HOURS_CHART_CONFIG = HOURS_CHART_CONFIG;

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
// Average marker label plugin
// Draws value text next to the right-side average markers
// -------------------------
const averageLabelPlugin = {
  id: "averageLabelPlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();

    chart.data.datasets.forEach((ds, i) => {
      if (!ds || !ds._isAverageMarker) return;

      const meta = chart.getDatasetMeta(i);
      const lastPoint = meta?.data?.[meta.data.length - 1];
      if (!lastPoint) return;

      const labelText = ds._labelText;
      if (!labelText) return;

      ctx.fillStyle = ds.borderColor || "#000";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      ctx.fillText(labelText, lastPoint.x + 8, lastPoint.y);
    });

    ctx.restore();
  },
};

// -------------------------
// Auth guard
// -------------------------
async function requireDashboardAuth() {
  // ✅ NEW: attempt to restore / ensure session before redirecting
  const session = await ensureSession();

  if (!session) {
    window.location.href = "login.html";
    return false;
  }

  const userEmailEl = document.getElementById("userEmail");
  if (userEmailEl) {
    userEmailEl.textContent = `Logged in as ${session.user.email}`;
  }

  return session;
}

// -------------------------
// Date helpers
// -------------------------
function normalizeDateOnlyISO(dateLike) {
  if (!dateLike) return "";
  if (dateLike instanceof Date) {
    const y = dateLike.getFullYear();
    const m = String(dateLike.getMonth() + 1).padStart(2, "0");
    const d = String(dateLike.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(dateLike);
  const dateMatch = s.match(/\d{4}-\d{2}-\d{2}/);
  const dateOnly = dateMatch ? dateMatch[0] : (s.includes("T") ? s.split("T")[0] : s);
  return dateOnly.trim();
}

function isoDateToLocalDate(isoDateOnly) {
  if (!isoDateOnly) return null;
  return new Date(`${isoDateOnly}T00:00:00`);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const [y, m, d] = normalizeDateOnlyISO(dateString).split("-");
  return `${m}/${d}/${y.slice(-2)}`;
}

function formatTimeFromHours(v) {
  if (v == null || Number.isNaN(v)) return "";
  const h24 = ((Math.floor(v) % 24) + 24) % 24;
  let mins = Math.round((v - Math.floor(v)) * 60);
  let hh = h24;
  if (mins === 60) {
    mins = 0;
    hh = (hh + 1) % 24;
  }
  const ampm = hh >= 12 ? "pm" : "am";
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mins).padStart(2, "0")}${ampm}`;
}

// -------------------------
// Weekly aggregation (hours only) - used by Time Allocation chart
// -------------------------
function aggregateWeeklyHours(data) {
  const weeks = {};

  data.forEach(d => {
    if (d.isPlaceholder || (d.hoursWorked == null && d.hoursPersonal == null)) return;
    const date = isoDateToLocalDate(d.date);
    if (!date) return;

    const monday = new Date(date);
    const day = monday.getDay() || 7;
    monday.setDate(monday.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    const key = monday.toISOString().slice(0, 10);

    if (!weeks[key]) {
      weeks[key] = {
        count: 0,
        work: 0,
        personal: 0,
        label: `Week of ${monday.getMonth() + 1}/${monday.getDate()}`
      };
    }

    weeks[key].count++;
    weeks[key].work += d.hoursWorked;
    weeks[key].personal += d.hoursPersonal;
  });

  const keys = Object.keys(weeks).sort();

  return {
    labels: keys.map(k => weeks[k].label),
    work: keys.map(k => weeks[k].work / weeks[k].count),
    personal: keys.map(k => weeks[k].personal / weeks[k].count),
  };
}

// -------------------------
// Map DB row → internal format
// -------------------------
function mapRow(row) {
  const boolOrNull = (value) => value == null ? null : !!value;

  return {
    date: normalizeDateOnlyISO(row.timestamp),
    rawTimestamp: row.timestamp,

    overallFeeling: Number(row.overall_feeling),
    physicalFeeling: row.physical_feeling != null ? Number(row.physical_feeling) : null,
    mentalFeeling: row.mental_feeling != null ? Number(row.mental_feeling) : null,
    energyFeeling: row.energy != null ? Number(row.energy) : null,

    workoutYes: boolOrNull(row.worked_out),
    journalYes: boolOrNull(row.journaled),
    readYes: boolOrNull(row.read_books),
    drinkYes: boolOrNull(row.drank),
    mediaYes: boolOrNull(row.low_media),
    pianoYes: boolOrNull(row.piano),
    officeYes: boolOrNull(row.office),
    goalYes: boolOrNull(row.hit_goal),

    timeUpHours: parseTimeToHours(row.time_up),
    timeInBedHours: parseTimeToHours(row.time_in_bed),

    hoursWorked: Number(row.hours_worked) || 0,
    hoursPersonal: Number(row.hours_personal) || 0,

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

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  let value = hours + minutes / 60;
  if (value < 12) value += 24;

  return value;
}

// -------------------------
// Filters + persistence
// -------------------------
function setupFiltersLegacy() {
  const startEl = document.getElementById("startMonth");
  const endEl = document.getElementById("endMonth");

  // ✅ NEW GUARD
  if (!startEl || !endEl) return;

  startEl.value = localStorage.getItem("filterStart") || "";
  endEl.value = localStorage.getItem("filterEnd") || "";

  document.getElementById("applyFilter")?.addEventListener("click", () => {
    localStorage.setItem("filterStart", startEl.value);
    localStorage.setItem("filterEnd", endEl.value);
    buildCharts(getFilteredData());
  });

  document.getElementById("resetFilter")?.addEventListener("click", () => {
    startEl.value = "";
    endEl.value = "";
    localStorage.removeItem("filterStart");
    localStorage.removeItem("filterEnd");
    buildCharts(allData);
  });
}

function setupFilters() {
  const presetButtons = document.querySelectorAll("[data-range-preset]");
  if (!presetButtons.length) return;

  const setPreset = (preset, shouldBuild = true) => {
    localStorage.setItem("filterPreset", preset);
    localStorage.removeItem("filterStart");
    localStorage.removeItem("filterEnd");
    presetButtons.forEach((button) => {
      const isActive = button.dataset.rangePreset === preset;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (shouldBuild) buildCharts(getFilteredData());
  };

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setPreset(button.dataset.rangePreset || "1m");
    });
  });

  setPreset(localStorage.getItem("filterPreset") || "1m", false);
}

function getPresetDateRange() {
  const preset = localStorage.getItem("filterPreset") || "1m";
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  let startDate = null;

  if (preset === "1w") {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
  } else if (preset === "1m") {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
  } else if (preset === "3m") {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 89);
  } else if (preset === "ytd") {
    startDate = new Date(endDate.getFullYear(), 0, 1);
  } else if (preset === "1y") {
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);
  }

  if (startDate) startDate.setHours(0, 0, 0, 0);
  return { preset, startDate, endDate };
}

function getFilteredData() {
  const { preset, startDate, endDate } = getPresetDateRange();
  if (preset === "all") return allData;

  return allData.filter(d => {
    const dDate = isoDateToLocalDate(d.date);
    if (!dDate) return false;
    if (startDate && dDate < startDate) return false;
    if (endDate && dDate > endDate) return false;
    return true;
  });
}

function buildDisplayTimeline(data, range = getPresetDateRange()) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (!range.startDate) return sorted;

  const byDate = new Map();
  sorted.forEach((entry) => {
    const existing = byDate.get(entry.date);
    byDate.set(entry.date, existing ? { ...existing, ...entry } : entry);
  });
  const display = [];
  const cursor = new Date(range.startDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const date = normalizeDateOnlyISO(cursor);
    display.push(byDate.get(date) || {
      date,
      isPlaceholder: true,
      overallFeeling: null,
      physicalFeeling: null,
      mentalFeeling: null,
      energyFeeling: null,
      timeUpHours: null,
      timeInBedHours: null,
      hoursWorked: null,
      hoursPersonal: null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return display;
}

function getMonthKeysForRange(data, range = getPresetDateRange()) {
  if (!range.startDate) {
    return [...new Set(data.map((entry) => entry.date.slice(0, 7)))].sort();
  }

  const keys = [];
  const cursor = new Date(range.startDate.getFullYear(), range.startDate.getMonth(), 1);
  const end = new Date(range.endDate.getFullYear(), range.endDate.getMonth(), 1);

  while (cursor <= end) {
    keys.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
}

// -------------------------
// Destroy charts
// -------------------------
function destroyCharts() {
  ratingsChart?.destroy(); ratingsChart = null;
  sleepChart?.destroy(); sleepChart = null;
  habitChart?.destroy(); habitChart = null;
  hoursChart?.destroy(); hoursChart = null;
}

// -------------------------
// BUILD CHARTS
// -------------------------
function buildCharts(data) {
  destroyCharts();
  const theme = getChartTheme();

  const actualSorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const sorted = buildDisplayTimeline(actualSorted);
  console.log("Chart range render:", {
    preset: localStorage.getItem("filterPreset") || "1m",
    entries: actualSorted.length,
    firstEntry: actualSorted[0]?.date || null,
    lastEntry: actualSorted[actualSorted.length - 1]?.date || null,
    axisStart: sorted[0]?.date || null,
    axisEnd: sorted[sorted.length - 1]?.date || null,
  });
  window.habitDashboardDebug = {
    allDates: allData.map((entry) => entry.date),
    allRawTimestamps: allData.map((entry) => entry.rawTimestamp),
    filteredDates: actualSorted.map((entry) => entry.date),
    filteredRows: actualSorted,
    axisDates: sorted.map((entry) => entry.date),
  };
  const labels = sorted.map(d => formatDate(d.date));
  const n = labels.length;

  // averages
  const avg = arr => {
    const v = arr.filter(x => x != null && !Number.isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const avgOverall = avg(actualSorted.map(d => d.overallFeeling));
  const avgPhysical = avg(actualSorted.map(d => d.physicalFeeling));
  const avgMental = avg(actualSorted.map(d => d.mentalFeeling));
  const avgEnergy = avg(actualSorted.map(d => d.energyFeeling));

  const avgTimeUp = avg(actualSorted.map(d => d.timeUpHours));
  const avgTimeBed = avg(actualSorted.map(d => d.timeInBedHours));

  const markerData = (value) => {
    if (!n) return [];
    const arr = new Array(n).fill(null);
    arr[n - 1] = value;
    return arr;
  };

  const legendFilter = (legendItem, chartData) => {
    const ds = chartData.datasets?.[legendItem.datasetIndex];
    return !(ds && ds._isAverageMarker);
  };

  /* RATINGS */
  ratingsChart = new Chart(document.getElementById("ratingsChart"), {
    type: "line",
    plugins: [averageLabelPlugin],
    data: {
      labels,
      datasets: [
        { label: "Overall", data: sorted.map(d => d.overallFeeling), borderColor: "#3b82f6", tension: 0.3, spanGaps: true, pointRadius: 3 },
        { label: "Physical", data: sorted.map(d => d.physicalFeeling), borderColor: "#f97316", tension: 0.3, spanGaps: true, pointRadius: 3 },
        { label: "Mental", data: sorted.map(d => d.mentalFeeling), borderColor: "#22c55e", tension: 0.3, spanGaps: true, pointRadius: 3 },
        { label: "Energy", data: sorted.map(d => d.energyFeeling), borderColor: "#a855f7", tension: 0.3, spanGaps: true, pointRadius: 3 },

        { label: "Avg", data: markerData(avgOverall), borderColor: "#93c5fd", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: avgOverall != null ? avgOverall.toFixed(1) : "" },
        { label: "Avg", data: markerData(avgPhysical), borderColor: "#fdba74", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: avgPhysical != null ? avgPhysical.toFixed(1) : "" },
        { label: "Avg", data: markerData(avgMental), borderColor: "#86efac", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: avgMental != null ? avgMental.toFixed(1) : "" },
        { label: "Avg", data: markerData(avgEnergy), borderColor: "#d8b4fe", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: avgEnergy != null ? avgEnergy.toFixed(1) : "" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 48 } },
      plugins: {
        legend: { labels: { color: theme.textColor, filter: legendFilter } },
      },
      scales: {
        x: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
        y: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
      },
    },
  });

  /* SLEEP */
  sleepChart = new Chart(document.getElementById("sleepChart"), {
    type: "line",
    plugins: [averageLabelPlugin],
    data: {
      labels,
      datasets: [
        { label: "Time Up", data: sorted.map(d => d.timeUpHours), borderColor: "#0ea5e9", tension: 0.3, spanGaps: true, pointRadius: 3 },
        { label: "Time in Bed", data: sorted.map(d => d.timeInBedHours), borderColor: "#ef4444", tension: 0.3, spanGaps: true, pointRadius: 3 },

        { label: "Avg", data: markerData(avgTimeUp), borderColor: "#7dd3fc", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: formatTimeFromHours(avgTimeUp) },
        { label: "Avg", data: markerData(avgTimeBed), borderColor: "#fca5a5", pointRadius: 4, showLine: false, _isAverageMarker: true, _labelText: formatTimeFromHours(avgTimeBed) },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 48 } },
      plugins: {
        legend: { labels: { color: theme.textColor, filter: legendFilter } },
      },
      scales: {
        y: {
          min: 20,
          max: 35,
          ticks: {
            color: theme.textColor,
            callback: v => formatTimeFromHours(v),
          },
          grid: { color: theme.gridColor },
        },
        x: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
      },
    },
  });

  /* HABITS */
  const habitDefs = typeof getEnabledHabitDefinitions === "function"
    ? getEnabledHabitDefinitions()
    : [
        { label: "Workout", dataKey: "workoutYes", chartKey: "workout", color: "#10b981" },
        { label: "Journal", dataKey: "journalYes", chartKey: "journal", color: "#3b82f6" },
        { label: "Read", dataKey: "readYes", chartKey: "read", color: "#6366f1" },
        { label: "Drink", dataKey: "drinkYes", chartKey: "drink", color: "#ef4444" },
        { label: "< 2 hrs Media", dataKey: "mediaYes", chartKey: "media", color: "#f59e0b" },
        { label: "Piano", dataKey: "pianoYes", chartKey: "piano", color: "#a855f7" },
        { label: "Office", dataKey: "officeYes", chartKey: "office", color: "#0ea5e9" },
        { label: "Hit Goal", dataKey: "goalYes", chartKey: "goal", color: "#22c55e" },
      ];
  const monthGroups = {};
  const keys = getMonthKeysForRange(actualSorted);
  keys.forEach((key) => {
    monthGroups[key] = { total: 0 };
    habitDefs.forEach(habit => {
      monthGroups[key][habit.chartKey] = { yes: 0, tracked: 0 };
    });
  });

  actualSorted.forEach(d => {
    const key = d.date.slice(0, 7);
    if (!monthGroups[key]) return;
    const g = monthGroups[key];
    g.total++;
    habitDefs.forEach(habit => {
      if (d[habit.dataKey] == null) return;
      g[habit.chartKey].tracked++;
      if (d[habit.dataKey]) g[habit.chartKey].yes++;
    });
  });

  const pct = (v, t) => (t ? (v / t) * 100 : null);

  habitChart = new Chart(document.getElementById("habitChart"), {
    type: "bar",
    data: {
      // IMPORTANT: Avoid `new Date('YYYY-MM-DD')` here.
      // That string format is commonly parsed as UTC, which can shift into the previous local day/month
      // in negative offsets (e.g., America/Indiana/Indianapolis). Instead, construct the Date from
      // numeric parts so month labels match the actual data dates.
      labels: keys.map(k => {
        const [yy, mm] = k.split("-");
        const dt = new Date(Number(yy), Number(mm) - 1, 1); // local time
        return dt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      }),
      datasets: habitDefs.map(habit => ({
        label: habit.label,
        data: keys.map(k => {
          const habitMonth = monthGroups[k][habit.chartKey];
          return pct(habitMonth.yes, habitMonth.tracked);
        }),
        backgroundColor: habit.color,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: theme.textColor } } },
      scales: {
        y: { max: 100, ticks: { color: theme.textColor, callback: v => `${v}%` }, grid: { color: theme.gridColor } },
        x: { ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
      },
    },
  });

  /* TIME ALLOCATION */
  const hoursCanvas = document.getElementById("hoursChart");
  if (hoursCanvas) {
    let workData = sorted.map(d => d.hoursWorked);
    let personalData = sorted.map(d => d.hoursPersonal);
    let hoursLabels = labels;

    if (HOURS_CHART_CONFIG.weekly) {
      const weekly = aggregateWeeklyHours(sorted);
      hoursLabels = weekly.labels;
      workData = weekly.work;
      personalData = weekly.personal;
    }

    hoursChart = new Chart(hoursCanvas, {
      type: "bar",
      data: {
        labels: hoursLabels,
        datasets: [
          { label: "Work Hours", data: workData, backgroundColor: "#3b82f6", stack: HOURS_CHART_CONFIG.stacked ? "time" : undefined },
          { label: "Personal Project Hours", data: personalData, backgroundColor: "#10b981", stack: HOURS_CHART_CONFIG.stacked ? "time" : undefined },
          { label: "Work Goal", type: "line", data: new Array(hoursLabels.length).fill(HOURS_CHART_CONFIG.workGoal), borderColor: "#93c5fd", borderDash: [5, 5], pointRadius: 0 },
          { label: "Personal Goal", type: "line", data: new Array(hoursLabels.length).fill(HOURS_CHART_CONFIG.personalGoal), borderColor: "#6ee7b7", borderDash: [5, 5], pointRadius: 0 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: theme.textColor } } },
        scales: {
          x: { stacked: HOURS_CHART_CONFIG.stacked, ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
          y: { stacked: HOURS_CHART_CONFIG.stacked, min: 0, max: 14, ticks: { color: theme.textColor }, grid: { color: theme.gridColor } },
        },
      },
    });
  }
}

// -------------------------
// Weekly Summary (Data Only)
// -------------------------
function computeWeeklySummary(data) {
  // "last 7 completed days" = yesterday back 6 more days (exclude today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endCurrent = new Date(today);
  endCurrent.setDate(endCurrent.getDate() - 1); // yesterday 00:00

  const startCurrent = new Date(endCurrent);
  startCurrent.setDate(startCurrent.getDate() - 6);

  const endPrevious = new Date(startCurrent);
  endPrevious.setDate(endPrevious.getDate() - 1);

  const startPrevious = new Date(endPrevious);
  startPrevious.setDate(startPrevious.getDate() - 6);

  const inRange = (d, start, end) => {
    const dt = isoDateToLocalDate(d.date);
    if (!dt) return false;
    dt.setHours(0, 0, 0, 0);
    return dt >= start && dt <= end;
  };

  const currentDays = data.filter(d => inRange(d, startCurrent, endCurrent));
  const previousDays = data.filter(d => inRange(d, startPrevious, endPrevious));

  const safeAvg = (arr) => {
    const v = arr.filter(x => x != null && !Number.isNaN(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const safeDelta = (cur, prev) => {
    if (cur == null || prev == null || Number.isNaN(cur) || Number.isNaN(prev)) return null;
    return cur - prev;
  };

  const safeCount = (arr, predicate) => arr.reduce((sum, x) => sum + (predicate(x) ? 1 : 0), 0);

  const summarizePeriod = (days) => {
    const ratings = {
      overallAvg: safeAvg(days.map(d => d.overallFeeling)),
      physicalAvg: safeAvg(days.map(d => d.physicalFeeling)),
      mentalAvg: safeAvg(days.map(d => d.mentalFeeling)),
      energyAvg: safeAvg(days.map(d => d.energyFeeling)),
    };

    const sleep = {
      avgTimeInBedHours: safeAvg(days.map(d => d.timeInBedHours)),
      avgTimeUpHours: safeAvg(days.map(d => d.timeUpHours)),
    };

    const timeAllocation = {
      avgWorkHoursPerDay: safeAvg(days.map(d => d.hoursWorked)),
      avgPersonalHoursPerDay: safeAvg(days.map(d => d.hoursPersonal)),
      daysMeetingWorkGoal: safeCount(days, d => (d.hoursWorked ?? 0) >= HOURS_CHART_CONFIG.workGoal),
      daysMeetingPersonalGoal: safeCount(days, d => (d.hoursPersonal ?? 0) >= HOURS_CHART_CONFIG.personalGoal),
    };

    // All binary habits currently tracked
    const habits = {
      workouts: safeCount(days, d => !!d.workoutYes),
      journaling: safeCount(days, d => !!d.journalYes),
      reading: safeCount(days, d => !!d.readYes),
      drinking: safeCount(days, d => !!d.drinkYes),
      lowMedia: safeCount(days, d => !!d.mediaYes),
      piano: safeCount(days, d => !!d.pianoYes),
      office: safeCount(days, d => !!d.officeYes),
      hitGoal: safeCount(days, d => !!d.goalYes),
    };

    return {
      window: {
        startISO: normalizeDateOnlyISO(startCurrent),
        endISO: normalizeDateOnlyISO(endCurrent),
        daysIncluded: days.length,
      },
      ratings,
      sleep: {
        ...sleep,
        avgTimeInBedLabel: formatTimeFromHours(sleep.avgTimeInBedHours),
        avgTimeUpLabel: formatTimeFromHours(sleep.avgTimeUpHours),
      },
      timeAllocation,
      habits,
    };
  };

  const current = summarizePeriod(currentDays);
  const previous = summarizePeriod(previousDays);

  const deltas = {
    ratings: {
      overallAvg: safeDelta(current.ratings.overallAvg, previous.ratings.overallAvg),
      physicalAvg: safeDelta(current.ratings.physicalAvg, previous.ratings.physicalAvg),
      mentalAvg: safeDelta(current.ratings.mentalAvg, previous.ratings.mentalAvg),
      energyAvg: safeDelta(current.ratings.energyAvg, previous.ratings.energyAvg),
    },
    sleep: {
      avgTimeInBedHours: safeDelta(current.sleep.avgTimeInBedHours, previous.sleep.avgTimeInBedHours),
      avgTimeUpHours: safeDelta(current.sleep.avgTimeUpHours, previous.sleep.avgTimeUpHours),
    },
    timeAllocation: {
      avgWorkHoursPerDay: safeDelta(current.timeAllocation.avgWorkHoursPerDay, previous.timeAllocation.avgWorkHoursPerDay),
      avgPersonalHoursPerDay: safeDelta(current.timeAllocation.avgPersonalHoursPerDay, previous.timeAllocation.avgPersonalHoursPerDay),
      daysMeetingWorkGoal: safeDelta(current.timeAllocation.daysMeetingWorkGoal, previous.timeAllocation.daysMeetingWorkGoal),
      daysMeetingPersonalGoal: safeDelta(current.timeAllocation.daysMeetingPersonalGoal, previous.timeAllocation.daysMeetingPersonalGoal),
    },
    habits: {
      workouts: safeDelta(current.habits.workouts, previous.habits.workouts),
      journaling: safeDelta(current.habits.journaling, previous.habits.journaling),
      reading: safeDelta(current.habits.reading, previous.habits.reading),
      drinking: safeDelta(current.habits.drinking, previous.habits.drinking),
      lowMedia: safeDelta(current.habits.lowMedia, previous.habits.lowMedia),
      piano: safeDelta(current.habits.piano, previous.habits.piano),
      office: safeDelta(current.habits.office, previous.habits.office),
      hitGoal: safeDelta(current.habits.hitGoal, previous.habits.hitGoal),
    },
  };

  const weeklySummary = { current, previous, deltas };
  return weeklySummary;
}

// -------------------------
// Load data
// -------------------------
window.addEventListener("load", async () => {
  const session = await requireDashboardAuth();
  if (!session) return;

  window.dispatchEvent(new CustomEvent("habitdash:dashboard-ready"));

  const { data, error } = await supabaseClient
    .from("daily_entries")
    .select("*")
    .eq("user_id", session.user.id)
    .order("timestamp", { ascending: true });

  if (error) return console.error(error);

  allData = data.map(mapRow);
  window.allData = allData;

  if (IS_DASHBOARD) {
    setupFilters();
    buildCharts(getFilteredData());
  }

  // Weekly Summary is computed after data loads. No UI yet.
  window.weeklySummary = computeWeeklySummary(allData);
  window.dispatchEvent(new CustomEvent("habitdash:weekly-summary-ready"));
  console.log("📊 weeklySummary", window.weeklySummary);
});

// -------------------------
// Weekly Summary UI Compatibility Layer
// (prevents renderWeeklySummary crashes)
// -------------------------
if (window.weeklySummary?.current) {
  const c = window.weeklySummary.current;

  window.wsOverall   = c.ratings?.overallAvg ?? null;
  window.wsEnergy    = c.ratings?.energyAvg ?? null;
  window.wsMental    = c.ratings?.mentalAvg ?? null;
  window.wsPhysical  = c.ratings?.physicalAvg ?? null;

  window.wsTimeInBed = c.sleep?.avgTimeInBedHours ?? null;
  window.wsTimeUp    = c.sleep?.avgTimeUpHours ?? null;

  window.wsWorkAvg   = c.timeAllocation?.avgWorkHoursPerDay ?? null;
  window.wsPersonalAvg = c.timeAllocation?.avgPersonalHoursPerDay ?? null;

  window.wsWorkGoalDays     = c.timeAllocation?.daysMeetingWorkGoal ?? 0;
  window.wsPersonalGoalDays = c.timeAllocation?.daysMeetingPersonalGoal ?? 0;

  window.wsWorkout  = c.habits?.workouts ?? 0;
  window.wsJournal  = c.habits?.journaling ?? 0;
  window.wsRead     = c.habits?.reading ?? 0;
  window.wsDrink    = c.habits?.drinking ?? 0;
  window.wsMedia    = c.habits?.lowMedia ?? 0;
  window.wsPiano    = c.habits?.piano ?? 0;
  window.wsOffice   = c.habits?.office ?? 0;
  window.wsGoal     = c.habits?.hitGoal ?? 0;
}

// -------------------------
// Logout
// -------------------------
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  // ✅ NEW: clear persistent session snapshot
  clearSessionFromLocalStorage();
  window.location.href = "login.html";
});


