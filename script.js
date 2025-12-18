// script.js

// ---- Supabase client setup ----
// Replace these with your real values from Supabase → Project Settings → API
const SUPABASE_URL = "https://jqbtpdtvsgmpedddnerp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxYnRwZHR2c2dtcGVkZGRuZXJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyOTMwNTAsImV4cCI6MjA4MDg2OTA1MH0.z9qLJ2zJZSwq3NPC98fEQDm3vPY8YKgG6Z43cfn28vs";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- State ----
let allData = [];
let ratingsChart, habitChart, sleepChart;

// Load data on page load
window.addEventListener('load', loadDataFromSupabase);

async function loadDataFromSupabase() {
  try {
    const { data, error } = await supabaseClient
      .from('daily_entries')
      .select('*')
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Error loading from Supabase:', error);
      return;
    }

    // 🔍 Debug logs
    console.log('Loaded rows from Supabase. Count:', data.length);
    console.log('First row from Supabase:', data[0]);

    allData = data
      .map(mapRow)
      // TEMP: don't filter anything out yet
      // .filter(d => !isNaN(d.date) && !isNaN(d.overallFeeling))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 🔍 See what one mapped entry looks like
    console.log('First mapped entry:', allData[0]);

    buildCharts(allData);
    setupFilters();
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

async function requireDashboardAuth() {
  const { data } = await supabaseClient.auth.getSession();

  if (!data.session) {
    window.location.href = "login.html";
    return;
  }

  const user = data.session.user;
  document.getElementById("userEmail").textContent =
    `Logged in as ${user.email}`;
}

requireDashboardAuth();

function formatDate(dateString) {
  if (!dateString) return '';

  // Handle both "YYYY-MM-DD" and full ISO strings
  const cleanDate = dateString.split('T')[0]; // take only YYYY-MM-DD
  const [year, month, day] = cleanDate.split('-');

  // Return MM/DD/YY
  return `${month}/${day}/${year.slice(-2)}`;
}



// ---- Map DB row → internal format used by charts ----
function mapRow(row) {
  const date = row.timestamp; // "YYYY-MM-DD" (keep raw, sortable)

;

  const overallFeeling  = Number(row.overall_feeling);
  const physicalFeeling = row.physical_feeling != null ? Number(row.physical_feeling) : null;
  const mentalFeeling   = row.mental_feeling   != null ? Number(row.mental_feeling)   : null;
  const energyFeeling   = row.energy           != null ? Number(row.energy)           : null;

  const workoutYes = !!row.worked_out;
  const journalYes = !!row.journaled;
  const readYes    = !!row.read_books;
  const drinkYes   = !!row.drank;
  const mediaYes   = !!row.low_media;
  const pianoYes   = !!row.piano;
  const officeYes  = !!row.office;
  const goalYes    = !!row.hit_goal;

  const dailyKeyword = row.keyword || '';
  const dailySummary = row.summary || '';

  const timeUpHours    = parseTimeToHours(row.time_up);
  const timeInBedHours = parseTimeToHours(row.time_in_bed);

  const hoursWorked   = row.hours_worked   != null ? Number(row.hours_worked)   : null;
  const hoursPersonal = row.hours_personal != null ? Number(row.hours_personal) : null;

  return {
    date,
    overallFeeling,
    physicalFeeling,
    mentalFeeling,
    energyFeeling,
    workoutYes,
    journalYes,
    readYes,
    drinkYes,
    mediaYes,
    pianoYes,
    officeYes,
    goalYes,
    timeUpHours,
    timeInBedHours,
    dailyKeyword,
    dailySummary,
    hoursWorked,
    hoursPersonal
  };
}

// ---------- Time parsing helper ----------
function parseTimeToHours(str) {
  if (!str) return null;
  let s = str.toString().trim().toLowerCase();

  let isPM = false;
  let isAM = false;

  if (s.endsWith('am')) {
    isAM = true;
    s = s.replace(/am$/, '').trim();
  } else if (s.endsWith('pm')) {
    isPM = true;
    s = s.replace(/pm$/, '').trim();
  } else if (s.endsWith('a')) {
    isAM = true;
    s = s.replace(/a$/, '').trim();
  } else if (s.endsWith('p')) {
    isPM = true;
    s = s.replace(/p$/, '').trim();
  }

  const match = s.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10) || 0;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  return hours + minutes / 60;
}

// ---------- Filters ----------
function setupFilters() {
  const applyBtn = document.getElementById('applyFilter');
  const resetBtn = document.getElementById('resetFilter');

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const filtered = getFilteredData();
      buildCharts(filtered);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const startInput = document.getElementById('startMonth');
      const endInput = document.getElementById('endMonth');
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';

      buildCharts(allData);
    });
  }
}

function getFilteredData() {
  const startInput = document.getElementById('startMonth');
  const endInput = document.getElementById('endMonth');

  let startDate = null;
  let endDate = null;

  if (startInput && startInput.value) {
    startDate = `${startInput.value}-01`; // YYYY-MM-01
  }

  if (endInput && endInput.value) {
    const [y, m] = endInput.value.split('-');
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    endDate = `${endInput.value}-${String(lastDay).padStart(2, '0')}`;
  }

  if (!startDate && !endDate) {
    return allData;
  }

  return allData.filter(d => {
    if (startDate && d.date < startDate) return false;
    if (endDate && d.date > endDate) return false;
    return true;
  });
}


// ---------- Build all charts + daily notes ----------
function buildCharts(data) {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const labels = sorted.map(d => formatDate(d.date));


  const feelingValues  = sorted.map(d => d.overallFeeling);
  const physicalValues = sorted.map(d => d.physicalFeeling);
  const mentalValues   = sorted.map(d => d.mentalFeeling);
  const energyValues   = sorted.map(d => d.energyFeeling);

  const timeUpValues   = sorted.map(d => d.timeUpHours);
  const bedTimeValues  = sorted.map(d => d.timeInBedHours);

  if (ratingsChart) ratingsChart.destroy();
  if (habitChart)   habitChart.destroy();
  if (sleepChart)   sleepChart.destroy();

  // --- Ratings chart ---
  const ratingsCtx = document.getElementById('ratingsChart');
  if (ratingsCtx) {
    ratingsChart = new Chart(ratingsCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Overall',
            data: feelingValues,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          },
          {
            label: 'Physical',
            data: physicalValues,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          },
          {
            label: 'Mental',
            data: mentalValues,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          },
          {
            label: 'Energy',
            data: energyValues,
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'nearest', intersect: false },
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 5,
            ticks: { stepSize: 1 },
            title: { display: true, text: 'Rating (1–5)' }
          },
          x: { title: { display: true, text: 'Date' } }
        }
      }
    });
  }

  // --- Sleep chart ---
  const sleepCtx = document.getElementById('sleepChart');
  if (sleepCtx) {
    sleepChart = new Chart(sleepCtx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Time Up',
            data: timeUpValues,
            borderColor: '#0ea5e9',
            backgroundColor: 'rgba(14, 165, 233, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          },
          {
            label: 'Time in Bed',
            data: bedTimeValues,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            fill: false,
            pointRadius: 2,
            pointHoverRadius: 4,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const h = ctx.raw;
                if (h == null || isNaN(h)) return `${ctx.dataset.label}: n/a`;
                const hours = Math.floor(h);
                const minutes = Math.round((h - hours) * 60);
                const ampm = hours >= 12 ? 'pm' : 'am';
                const displayHour = ((hours + 11) % 12) + 1;
                const displayMin = minutes.toString().padStart(2, '0');
                return `${ctx.dataset.label}: ${displayHour}:${displayMin}${ampm}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: 0,
            max: 24,
            ticks: {
              callback: (value) => {
                const h = Number(value);
                const ampm = h >= 12 ? 'pm' : 'am';
                const displayHour = ((h + 11) % 12) + 1;
                return `${displayHour}${ampm}`;
              }
            },
            title: { display: true, text: 'Time of Day' }
          },
          x: { title: { display: true, text: 'Date' } }
        }
      }
    });
  }

  // --- Habit percentages by month ---
  const monthGroups = {};

  sorted.forEach(d => {
    const [year, month] = d.date.split('-');
    const key = `${year}-${month}`;


    if (!monthGroups[key]) {
      monthGroups[key] = {
        totalDays: 0,
        workoutYesDays: 0,
        journalYesDays: 0,
        readYesDays: 0,
        drinkYesDays: 0,
        mediaYesDays: 0,
        pianoYesDays: 0,
        officeYesDays: 0,
        goalYesDays: 0
      };
    }

    const group = monthGroups[key];
    group.totalDays += 1;
    if (d.workoutYes) group.workoutYesDays += 1;
    if (d.journalYes) group.journalYesDays += 1;
    if (d.readYes)    group.readYesDays    += 1;
    if (d.drinkYes)   group.drinkYesDays   += 1;
    if (d.mediaYes)   group.mediaYesDays   += 1;
    if (d.pianoYes)   group.pianoYesDays   += 1;
    if (d.officeYes)  group.officeYesDays  += 1;
    if (d.goalYes)    group.goalYesDays    += 1;
  });

  const monthKeys = Object.keys(monthGroups).sort();
  const pct = (yes, total) => (total === 0 ? 0 : (yes / total) * 100);

  const workoutPercentages = monthKeys.map(k => pct(monthGroups[k].workoutYesDays, monthGroups[k].totalDays));
  const journalPercentages = monthKeys.map(k => pct(monthGroups[k].journalYesDays, monthGroups[k].totalDays));
  const readPercentages    = monthKeys.map(k => pct(monthGroups[k].readYesDays,    monthGroups[k].totalDays));
  const drinkPercentages   = monthKeys.map(k => pct(monthGroups[k].drinkYesDays,   monthGroups[k].totalDays));
  const mediaPercentages   = monthKeys.map(k => pct(monthGroups[k].mediaYesDays,   monthGroups[k].totalDays));
  const pianoPercentages   = monthKeys.map(k => pct(monthGroups[k].pianoYesDays,   monthGroups[k].totalDays));
  const officePercentages  = monthKeys.map(k => pct(monthGroups[k].officeYesDays,  monthGroups[k].totalDays));
  const goalPercentages    = monthKeys.map(k => pct(monthGroups[k].goalYesDays,    monthGroups[k].totalDays));

  const monthLabels = monthKeys.map(key => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  });

  const habitCtx = document.getElementById('habitChart');
  if (habitCtx) {
    habitChart = new Chart(habitCtx, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          { label: 'Workout', data: workoutPercentages, backgroundColor: '#10b981' },
          { label: 'Journal', data: journalPercentages, backgroundColor: '#3b82f6' },
          { label: 'Read',    data: readPercentages,    backgroundColor: '#6366f1' },
          { label: 'Drink',   data: drinkPercentages,   backgroundColor: '#ef4444' },
          { label: '< 2 hrs Media', data: mediaPercentages, backgroundColor: '#f59e0b' },
          { label: 'Piano',   data: pianoPercentages,   backgroundColor: '#a855f7' },
          { label: 'Office',  data: officePercentages,  backgroundColor: '#0ea5e9' },
          { label: 'Hit Goal',data: goalPercentages,    backgroundColor: '#22c55e' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%`
            }
          },
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: { callback: v => `${v}%` },
            title: { display: true, text: 'Days with "Yes" (%)' }
          },
          x: { title: { display: true, text: 'Month' } }
        }
      }
    });
  }

  // --- Daily notes table ---
  const tbody = document.getElementById('dailyTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    sorted.forEach(d => {
      const tr = document.createElement('tr');

      const dateTd = document.createElement('td');
      dateTd.textContent = formatDate(d.date);


      const keywordTd = document.createElement('td');
      keywordTd.textContent = d.dailyKeyword || '';

      const summaryTd = document.createElement('td');
      summaryTd.textContent = d.dailySummary || '';

      const overallTd = document.createElement('td');
      overallTd.textContent = d.overallFeeling != null ? d.overallFeeling : '';

      tr.appendChild(dateTd);
      tr.appendChild(keywordTd);
      tr.appendChild(summaryTd);
      tr.appendChild(overallTd);

      tbody.appendChild(tr);
    });
  }
}
// --------------------------------------
// Logout
// --------------------------------------
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  });
}

