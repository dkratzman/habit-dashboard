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
    const recentTracked = recentDayNumbers.filter(day => trackedDays.has(day)).length;
    const recentSuccess = recentDayNumbers.filter(day => successDays.has(day)).length;

    return {
      id: habit.id,
      label: habit.id === "drink" ? "Alcohol-free" : habit.label,
      current: current.count,
      currentThrough: current.anchorDate,
      longest: calculateLongestStreak(successDays),
      recentSuccess,
      recentTracked,
    };
  }

  function buildMomentum(data, habitDefinitions, todayValue = new Date()) {
    const todayKey = localDateKey(todayValue);
    const todayDay = toDayNumber(todayKey);
    const entryMap = uniqueEntriesByDate(data, todayDay);
    const loggingDays = daySetsForEntries(entryMap);
    const current = calculateCurrentStreak(loggingDays, loggingDays, todayKey);
    const recentDayNumbers = todayDay == null
      ? []
      : Array.from({ length: 7 }, (_unused, index) => todayDay - 6 + index);
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

  function streakProgress(current, longest) {
    const safeCurrent = Math.max(0, Number(current) || 0);
    const safeLongest = Math.max(safeCurrent, Number(longest) || 0);
    if (!safeLongest) return 0;
    return Math.round((safeCurrent / safeLongest) * 100);
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
      empty.textContent = "Choose habits in Settings to see their streaks here.";
      container.appendChild(empty);
      return;
    }

    habits.forEach(habit => {
      const card = document.createElement("article");
      card.className = "momentum-habit";
      const progress = streakProgress(habit.current, habit.longest);
      if (habit.current > 0 && habit.current === habit.longest) {
        card.classList.add("is-personal-best");
      }

      const header = document.createElement("div");
      header.className = "momentum-habit__header";
      const label = document.createElement("strong");
      label.textContent = habit.label;
      const value = document.createElement("span");
      value.className = "momentum-habit__value";
      value.textContent = `${habit.current}`;
      value.setAttribute("aria-label", `${habit.current} current ${dayWord(habit.current)}`);
      const suffix = document.createElement("em");
      suffix.textContent = dayWord(habit.current);
      value.appendChild(suffix);
      header.append(label, value);

      const track = document.createElement("div");
      track.className = "momentum-habit__track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-label", `${habit.label}: current streak ${habit.current} ${dayWord(habit.current)}, personal best ${habit.longest} ${dayWord(habit.longest)}`);
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(Math.max(1, habit.longest)));
      track.setAttribute("aria-valuenow", String(habit.current));
      const fill = document.createElement("span");
      fill.style.width = `${progress}%`;
      track.appendChild(fill);

      const footer = document.createElement("div");
      footer.className = "momentum-habit__footer";
      const recent = document.createElement("small");
      recent.textContent = `${habit.recentSuccess}/${habit.recentTracked || 0} recent days`;
      const best = document.createElement("small");
      best.className = "momentum-habit__best";
      best.textContent = `Best ${habit.longest} ${dayWord(habit.longest)}`;
      footer.append(recent, best);

      card.append(header, track, footer);
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
    streakProgress,
    toDayNumber,
  };

  globalScope.Momentum = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
