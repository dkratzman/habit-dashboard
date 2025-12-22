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

// -------------------------
// Time Allocation config (logic only)
// -------------------------
const HOURS_CHART_CONFIG = {
  stacked: false,
  weekly: false,
  workGoal: 8,
  personalGoal: 2,
};

// expose config for UX debugging
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
  if (!dateLike) return "";
  if (dateLike instanceof Date) {
    const y = dateLike.getFullYear();
    const m = String(dateLike.getMonth() + 1).padStart(2, "0");
    const d = String(dateLike.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(dateLike);
  return s.includes("T") ? s.split("T")[0] : s;
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

// -------------------------
// Weekly aggregation (hours only)
// -------------------------
function aggregateWeeklyHours(data) {
  const weeks = {};

  data.forEach(d => {
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
  return {
    date: normalizeDateOnlyISO(row.timestamp),

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
function setupFilters() {
  const startEl = document.getElementById("startMonth");
  const endEl = document.getElementById("endMonth");

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

function getFilteredData() {
  const start = document.getElementById("startMonth").value;
  const end = document.getElementById("endMonth").value;

  let startDate = start ? new Date(`${start}-01T00:00:00`) : null;
  let endDate = end ? new Date(`${end}-31T23:59:59`) : null;

  return allData.filter(d => {
    const dDate = isoDateToLocalDate(d.date);
    if (startDate && dDate < startDate) return false;
    if (endDate && dDate > endDate) return false;
    return true;
  });
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

  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const labels = sorted.map(d => formatDate(d.date));

  /* RATINGS */
  ratingsChart = new Chart(document.getElementById("ratingsChart"), { /* unchanged */ type:"line",data:{labels,datasets:[{label:"Overall",data:sorted.map(d=>d.overallFeeling),borderColor:"#3b82f6",tension:0.3},{label:"Physical",data:sorted.map(d=>d.physicalFeeling),borderColor:"#f97316",tension:0.3},{label:"Mental",data:sorted.map(d=>d.mentalFeeling),borderColor:"#22c55e",tension:0.3},{label:"Energy",data:sorted.map(d=>d.energyFeeling),borderColor:"#a855f7",tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme.textColor}}},scales:{x:{ticks:{color:theme.textColor},grid:{color:theme.gridColor}},y:{ticks:{color:theme.textColor},grid:{color:theme.gridColor}}}}});

  /* SLEEP */
  sleepChart = new Chart(document.getElementById("sleepChart"), { /* unchanged */ type:"line",data:{labels,datasets:[{label:"Time Up",data:sorted.map(d=>d.timeUpHours),borderColor:"#0ea5e9",tension:0.3},{label:"Time in Bed",data:sorted.map(d=>d.timeInBedHours),borderColor:"#ef4444",tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme.textColor}}},scales:{y:{min:20,max:35,ticks:{color:theme.textColor,callback:v=>{const h=v%24;const ampm=h>=12?"pm":"am";return`${((h+11)%12)+1}${ampm}`;}},grid:{color:theme.gridColor}},x:{ticks:{color:theme.textColor},grid:{color:theme.gridColor}}}}});

  /* HABITS */
  const monthGroups = {};
  sorted.forEach(d => {
    const [y,m]=d.date.split("-");
    const key=`${y}-${m}`;
    if(!monthGroups[key])monthGroups[key]={total:0,workout:0,journal:0,read:0,drink:0,media:0,piano:0,office:0,goal:0};
    const g=monthGroups[key];
    g.total++;
    if(d.workoutYes)g.workout++;
    if(d.journalYes)g.journal++;
    if(d.readYes)g.read++;
    if(d.drinkYes)g.drink++;
    if(d.mediaYes)g.media++;
    if(d.pianoYes)g.piano++;
    if(d.officeYes)g.office++;
    if(d.goalYes)g.goal++;
  });

  const keys=Object.keys(monthGroups).sort();
  const pct=(v,t)=>(t?(v/t)*100:0);

  habitChart=new Chart(document.getElementById("habitChart"),{type:"bar",data:{labels:keys.map(k=>new Date(k+"-01").toLocaleDateString("en-US",{month:"short",year:"numeric"})),datasets:[{label:"Workout",data:keys.map(k=>pct(monthGroups[k].workout,monthGroups[k].total)),backgroundColor:"#10b981"},{label:"Journal",data:keys.map(k=>pct(monthGroups[k].journal,monthGroups[k].total)),backgroundColor:"#3b82f6"},{label:"Read",data:keys.map(k=>pct(monthGroups[k].read,monthGroups[k].total)),backgroundColor:"#6366f1"},{label:"Drink",data:keys.map(k=>pct(monthGroups[k].drink,monthGroups[k].total)),backgroundColor:"#ef4444"},{label:"< 2 hrs Media",data:keys.map(k=>pct(monthGroups[k].media,monthGroups[k].total)),backgroundColor:"#f59e0b"},{label:"Piano",data:keys.map(k=>pct(monthGroups[k].piano,monthGroups[k].total)),backgroundColor:"#a855f7"},{label:"Office",data:keys.map(k=>pct(monthGroups[k].office,monthGroups[k].total)),backgroundColor:"#0ea5e9"},{label:"Hit Goal",data:keys.map(k=>pct(monthGroups[k].goal,monthGroups[k].total)),backgroundColor:"#22c55e"}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:theme.textColor}}},scales:{y:{max:100,ticks:{color:theme.textColor,callback:v=>`${v}%`},grid:{color:theme.gridColor}},x:{ticks:{color:theme.textColor},grid:{color:theme.gridColor}}}}});

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
          {
            label: "Work Hours",
            data: workData,
            backgroundColor: "#3b82f6",
            stack: HOURS_CHART_CONFIG.stacked ? "time" : undefined,
          },
          {
            label: "Personal Project Hours",
            data: personalData,
            backgroundColor: "#10b981",
            stack: HOURS_CHART_CONFIG.stacked ? "time" : undefined,
          },
          {
            label: "Work Goal",
            type: "line",
            data: new Array(hoursLabels.length).fill(HOURS_CHART_CONFIG.workGoal),
            borderColor: "#93c5fd",
            borderDash: [5, 5],
            pointRadius: 0,
          },
          {
            label: "Personal Goal",
            type: "line",
            data: new Array(hoursLabels.length).fill(HOURS_CHART_CONFIG.personalGoal),
            borderColor: "#6ee7b7",
            borderDash: [5, 5],
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: theme.textColor } } },
        scales: {
          x: {
            stacked: HOURS_CHART_CONFIG.stacked,
            ticks: { color: theme.textColor },
            grid: { color: theme.gridColor },
          },
          y: {
            stacked: HOURS_CHART_CONFIG.stacked,
            min: 0,
            max: 14,
            ticks: { color: theme.textColor },
            grid: { color: theme.gridColor },
          },
        },
      },
    });
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


