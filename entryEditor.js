(function attachEntryEditor(globalScope) {
  const HABIT_FIELD_MAP = {
    workout: "worked_out",
    journal: "journaled",
    read: "read_books",
    drink: "drank",
    media: "low_media",
    piano: "piano",
    office: "office",
    hitGoal: "hit_goal",
  };

  function normalizeDate(value) {
    if (!value) return "";
    const text = String(value);
    return text.includes("T") ? text.split("T")[0] : text.slice(0, 10);
  }

  function normalizeStoredTime(value) {
    if (!value) return "";
    const text = String(value).trim().toLowerCase();
    const twelveHour = text.match(/^(\d{1,2}):(\d{2})\s*([ap])m?$/);
    if (twelveHour) {
      return `${Number(twelveHour[1])}:${twelveHour[2]}${twelveHour[3]}`;
    }

    const twentyFourHour = text.match(/^(\d{1,2}):(\d{2})/);
    if (!twentyFourHour) return text;
    const hour24 = Number(twentyFourHour[1]) % 24;
    const suffix = hour24 >= 12 ? "p" : "a";
    const hour12 = ((hour24 + 11) % 12) + 1;
    return `${hour12}:${twentyFourHour[2]}${suffix}`;
  }

  function numberOrDefault(value, fallback) {
    if (value == null || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function mapDatabaseEntryToForm(row) {
    const entry = row || {};
    const habits = {};
    Object.entries(HABIT_FIELD_MAP).forEach(([habitId, field]) => {
      habits[habitId] = entry[field] === true;
    });

    return {
      id: entry.id || null,
      date: normalizeDate(entry.timestamp),
      timeBed: normalizeStoredTime(entry.time_in_bed),
      timeUp: normalizeStoredTime(entry.time_up),
      hoursWorked: numberOrDefault(entry.hours_worked, 0),
      hoursPersonal: numberOrDefault(entry.hours_personal, 0),
      ratings: {
        overall: numberOrDefault(entry.overall_feeling, 3),
        physical: numberOrDefault(entry.physical_feeling, 3),
        mental: numberOrDefault(entry.mental_feeling, 3),
        energy: numberOrDefault(entry.energy, 3),
      },
      habits,
      keyword: entry.keyword || "",
      summary: entry.summary || "",
    };
  }

  function preserveDisabledHabitValues(nextEntry, storedEntry, enabledHabitIds) {
    const enabled = new Set(Array.isArray(enabledHabitIds) ? enabledHabitIds : []);
    Object.entries(HABIT_FIELD_MAP).forEach(([habitId, field]) => {
      if (!enabled.has(habitId) && Object.prototype.hasOwnProperty.call(storedEntry || {}, field)) {
        nextEntry[field] = storedEntry[field];
      }
    });
    return nextEntry;
  }

  function formatEditDateLabel(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return String(dateKey || "this day");
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const api = {
    HABIT_FIELD_MAP,
    formatEditDateLabel,
    mapDatabaseEntryToForm,
    normalizeStoredTime,
    preserveDisabledHabitValues,
  };

  globalScope.EntryEditor = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
