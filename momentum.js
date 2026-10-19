(function attachMomentum(globalScope) {
  const DAY_MS = 24 * 60 * 60 * 1000;

  function normalizeDate(value) {
    if (!value) return "";
    const match = String(value).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  function localDateKey(value = new Date()) {
    if (typeof value === "string") return normalizeDate(value);
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function toDayNumber(dateKey) {
    const [year, month, day] = normalizeDate(dateKey).split("-").map(Number);
    if (!year || !month || !day) return null;
    return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
  }

  function fromDayNumber(dayNumber) {
    return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
  }

  function uniqueEntriesByDate(data, maxDay = null) {
    const entries = new Map();
    (Array.isArray(data) ? data : []).forEach(entry => {
      const date = normalizeDate(entry?.date || entry?.timestamp);
      const day = toDayNumber(date);
      if (date && !entry?.isPlaceholder && (maxDay == null || day <= maxDay)) {
        entries.set(date, entry);
      }
    });
    return entries;
  }

  function calculateCurrentStreak(successDays, trackedDays, todayKey) {
    const today = toDayNumber(todayKey);
    if (today == null) return { count: 0, anchorDate: "" };

    let cursor = today;
    if (trackedDays.has(today)) {
      if (!successDays.has(today)) return { count: 0, anchorDate: fromDayNumber(today) };
    } else {
      cursor -= 1;
      if (!trackedDays.has(cursor) || !successDays.has(cursor)) {
        return { count: 0, anchorDate: "" };
      }
    }

    const anchorDate = fromDayNumber(cursor);
    let count = 0;
    while (successDays.has(cursor)) {
      count += 1;
      cursor -= 1;
    }
    return { count, anchorDate };
  }

  function calculateLongestStreak(successDays) {
    const days = [...successDays].sort((a, b) => a - b);
    let longest = 0;
    let current = 0;
    let previous = null;

    days.forEach(day => {
      current = previous != null && day === previous + 1 ? current + 1 : 1;
      longest = Math.max(longest, current);
      previous = day;
    });
    return longest;
  }

  function daySetsForEntries(entries) {
    const days = new Set();
    entries.forEach((_entry, date) => {
      const day = toDayNumber(date);
      if (day != null) days.add(day);
    });
    return days;
  }

  function buildHabitStreak(entryMap, habit, todayKey, recentDayNumbers) {
    const trackedDays = new Set();
    const successDays = new Set();

    entryMap.forEach((entry, date) => {
      const value = entry?.[habit.dataKey];
      if (typeof value !== "boolean") return;
      const day = toDayNumber(date);
      if (day == null) return;
      trackedDays.add(day);
      if (habit.lowerIsBetter ? !value : value) successDays.add(day);
    });

    const current = calculateCurrentStreak(successDays, trackedDays, todayKey);
    const recentDays = recentDayNumbers.map(day => {
      const date = fromDayNumber(day);
      const entry = entryMap.get(date);
      const value = entry?.[habit.dataKey];
      if (typeof value !== "boolean") return { date, status: "remaining" };
      const succeeded = habit.lowerIsBetter ? !value : value;
      return { date, status: succeeded ? "success" : "remaining" };
    });
    const recentTracked = recentDayNumbers.filter(day => trackedDays.has(day)).length;
    const recentSuccess = recentDays.filter(day => day.status === "success").length;
    const weeklyGoal = Math.min(7, Math.max(1, Math.round(Number(habit.weeklyGoal) || 1)));

    return {
      id: habit.id,
      label: habit.id === "drink" ? "Alcohol-free" : habit.label,
      current: current.count,
      currentThrough: current.anchorDate,
      longest: calculateLongestStreak(successDays),
      recentSuccess,
      recentTracked,
      recentDays,
      weeklyGoal,
      goalMet: recentSuccess >= weeklyGoal,
    };
  }

  function buildMomentum(data, habitDefinitions, todayValue = new Date()) {
    const todayKey = localDateKey(todayValue);
    const todayDay = toDayNumber(todayKey);
    const entryMap = uniqueEntriesByDate(data, todayDay);
    const loggingDays = daySetsForEntries(entryMap);
    const current = calculateCurrentStreak(loggingDays, loggingDays, todayKey);
    const latestRecordedDay = loggingDays.size ? Math.max(...loggingDays) : todayDay;
    const recentDayNumbers = latestRecordedDay == null
      ? []
      : Array.from({ length: 7 }, (_unused, index) => latestRecordedDay - 6 + index);
    const recentDays = recentDayNumbers.map(day => {
      const date = fromDayNumber(day);
      return {
        date,
        logged: loggingDays.has(day),
        isToday: date === todayKey,
      };
    });

    return {
      today: todayKey,
      recentWindowEnd: latestRecordedDay == null ? "" : fromDayNumber(latestRecordedDay),
      totalEntries: entryMap.size,
      currentCheckInStreak: current.count,
      currentCheckInThrough: current.anchorDate,
      longestCheckInStreak: calculateLongestStreak(loggingDays),
      recentLoggedDays: recentDays.filter(day => day.logged).length,
      recentDays,
      habits: (Array.isArray(habitDefinitions) ? habitDefinitions : [])
        .filter(habit => habit?.dataKey)
        .map(habit => buildHabitStreak(entryMap, habit, todayKey, recentDayNumbers)),
    };
  }

  function formatDayLabel(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short" });
  }

  function dayWord(count) {
    return count === 1 ? "day" : "days";
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function renderWeek(days) {
    const container = document.getElementById("momentum-week");
    if (!container) return;
    container.replaceChildren();

    days.forEach(day => {
      const item = document.createElement("div");
      item.className = `momentum-day${day.logged ? " is-logged" : ""}${day.isToday ? " is-today" : ""}`;
      item.setAttribute("aria-label", `${day.date}: ${day.logged ? "entry saved" : "no entry"}${day.isToday ? ", today" : ""}`);

      const weekday = document.createElement("span");
      weekday.textContent = formatDayLabel(day.date).slice(0, 2);
      const marker = document.createElement("i");
      marker.setAttribute("aria-hidden", "true");
      const date = document.createElement("small");
      date.textContent = String(Number(day.date.slice(-2)));
      item.append(weekday, marker, date);
      container.appendChild(item);
    });
  }

  function renderHabits(habits) {
    const container = document.getElementById("momentum-habits");
    if (!container) return;
    container.replaceChildren();

    if (!habits.length) {
      const empty = document.createElement("p");
      empty.className = "momentum-empty";
      empty.textContent = "Choose habits in Settings to see their weekly goals here.";
      container.appendChild(empty);
      return;
    }

    habits.forEach(habit => {
      const card = document.createElement("article");
      card.className = "momentum-habit";
      if (habit.goalMet) card.classList.add("is-goal-met");

      const header = document.createElement("div");
      header.className = "momentum-habit__header";
      const title = document.createElement("div");
      title.className = "momentum-habit__title";
      const label = document.createElement("strong");
      label.textContent = habit.label;
      const goal = document.createElement("span");
      goal.className = "momentum-habit__goal";
      goal.textContent = `Goal — ${habit.weeklyGoal} ${dayWord(habit.weeklyGoal)} / week`;
      title.append(label, goal);
      header.append(title);

      const track = document.createElement("div");
      track.className = "momentum-habit__track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${habit.label}: ${habit.recentSuccess} successful days out of 7; goal ${habit.weeklyGoal}`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", "7");
      track.setAttribute("aria-valuenow", String(habit.recentSuccess));
      const statusOrder = { success: 0, remaining: 1 };
      const progressDays = [...habit.recentDays].sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      progressDays.forEach((day, index) => {
        const segment = document.createElement("span");
        segment.className = `momentum-habit__segment is-${day.status}`;
        if (index === habit.weeklyGoal - 1) segment.classList.add("is-goal-boundary");
        segment.title = day.status === "success" ? `${day.date}: successful` : "Available day";
        segment.setAttribute("aria-hidden", "true");
        track.appendChild(segment);
      });

      card.append(header, track);
      container.appendChild(card);
    });
  }

  function render(containerOrId, momentum) {
    if (typeof document === "undefined" || !momentum) return;
    const container = typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;
    if (!container) return;

    setText("momentum-entry-count", `${momentum.totalEntries} ${momentum.totalEntries === 1 ? "entry" : "entries"} total`);
    setText("momentum-current", String(momentum.currentCheckInStreak));
    setText("momentum-current-unit", dayWord(momentum.currentCheckInStreak));
    setText("momentum-best", String(momentum.longestCheckInStreak));
    setText("momentum-best-unit", dayWord(momentum.longestCheckInStreak));
    setText("momentum-recent", `${momentum.recentLoggedDays}/7`);
    setText(
      "momentum-current-note",
      momentum.currentCheckInStreak
        ? momentum.currentCheckInThrough === momentum.today ? "Includes today" : "Active through yesterday"
        : "Log today to begin"
    );
    renderWeek(momentum.recentDays);
    renderHabits(momentum.habits);
    container.classList.add("is-ready");
  }

  const api = {
    buildMomentum,
    calculateCurrentStreak,
    calculateLongestStreak,
    normalizeDate,
    render,
    toDayNumber,
  };

  globalScope.Momentum = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
