(function attachHabitCoach(globalScope) {
  const MIN_WEEKLY_RATINGS = 3;
  const MIN_HABIT_GROUP_SIZE = 4;
  const MIN_ASSOCIATION_DIFFERENCE = 0.25;
  const MAX_ASSOCIATION_ENTRIES = 90;

  function average(values) {
    const valid = values.filter(value => Number.isFinite(value));
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function round(value, digits = 1) {
    return Number(value.toFixed(digits));
  }

  function validRatedEntries(data) {
    return (Array.isArray(data) ? data : [])
      .filter(entry => {
        const rating = Number(entry?.overallFeeling);
        return !entry?.isPlaceholder && entry?.date && Number.isFinite(rating) && rating > 0;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-MAX_ASSOCIATION_ENTRIES);
  }

  function describeWeeklyMovement(weeklySummary) {
    const current = weeklySummary?.current?.ratings || {};
    const previous = weeklySummary?.previous?.ratings || {};
    const currentAverage = current.overallAvg;
    const previousAverage = previous.overallAvg;
    const currentCount = current.overallCount || 0;
    const previousCount = previous.overallCount || 0;

    if (
      !Number.isFinite(currentAverage) ||
      !Number.isFinite(previousAverage) ||
      currentCount < MIN_WEEKLY_RATINGS ||
      previousCount < MIN_WEEKLY_RATINGS
    ) {
      return {
        kind: "movement",
        eyebrow: "Recent movement",
        title: "A little more data will sharpen the trend",
        body: `Log at least ${MIN_WEEKLY_RATINGS} rated days in both the current and prior 7-day windows to compare them responsibly.`,
        tone: "neutral",
      };
    }

    const difference = currentAverage - previousAverage;
    const direction = Math.abs(difference) < 0.15
      ? "held steady"
      : difference > 0
        ? "moved up"
        : "moved down";
    const tone = Math.abs(difference) < 0.15 ? "neutral" : difference > 0 ? "positive" : "attention";

    return {
      kind: "movement",
      eyebrow: "Recent movement",
      title: `Your overall rating ${direction}`,
      body: `The last 7-day window averaged ${currentAverage.toFixed(1)}, versus ${previousAverage.toFixed(1)} before it (${currentCount} and ${previousCount} rated days).`,
      tone,
      value: round(difference),
    };
  }

  function findHabitAssociation(data, habitDefinitions) {
    const entries = validRatedEntries(data);
    const habits = Array.isArray(habitDefinitions) ? habitDefinitions : [];

    const candidates = habits.map(habit => {
      const tracked = entries.filter(entry => typeof entry[habit.dataKey] === "boolean");
      const favorable = tracked.filter(entry => habit.lowerIsBetter ? !entry[habit.dataKey] : entry[habit.dataKey]);
      const comparison = tracked.filter(entry => habit.lowerIsBetter ? entry[habit.dataKey] : !entry[habit.dataKey]);

      if (favorable.length < MIN_HABIT_GROUP_SIZE || comparison.length < MIN_HABIT_GROUP_SIZE) return null;

      const favorableAverage = average(favorable.map(entry => Number(entry.overallFeeling)));
      const comparisonAverage = average(comparison.map(entry => Number(entry.overallFeeling)));
      const difference = favorableAverage - comparisonAverage;

      if (!Number.isFinite(difference) || difference < MIN_ASSOCIATION_DIFFERENCE) return null;

      return {
        habit,
        favorableAverage,
        comparisonAverage,
        difference,
        favorableCount: favorable.length,
        comparisonCount: comparison.length,
        tracked,
      };
    }).filter(Boolean);

    return candidates.sort((a, b) => b.difference - a.difference)[0] || null;
  }

  function favorableDayLabel(habit, count) {
    if (habit?.id === "drink") return `${count} alcohol-free ${count === 1 ? "day" : "days"}`;
    return `${count} ${(habit?.label || "habit").toLowerCase()} ${count === 1 ? "day" : "days"}`;
  }

  function describeHabitPattern(data, habitDefinitions) {
    const association = findHabitAssociation(data, habitDefinitions);

    if (!association) {
      return {
        insight: {
          kind: "pattern",
          eyebrow: "Habit pattern",
          title: "No reliable habit signal yet",
          body: `A pattern appears only after a habit has at least ${MIN_HABIT_GROUP_SIZE} rated days in both comparison groups and a meaningful rating gap.`,
          tone: "neutral",
        },
        association: null,
      };
    }

    const { habit, favorableAverage, comparisonAverage, difference, favorableCount, comparisonCount } = association;
    const favorableLabel = habit.lowerIsBetter ? "days without it" : "days you did it";
    const comparisonLabel = habit.lowerIsBetter ? "days with it" : "days you skipped it";

    return {
      insight: {
        kind: "pattern",
        eyebrow: "Possible pattern",
        title: `${habit.label} lines up with better-rated days`,
        body: `Overall ratings averaged ${favorableAverage.toFixed(1)} on ${favorableLabel} and ${comparisonAverage.toFixed(1)} on ${comparisonLabel} (${favorableCount} vs. ${comparisonCount} days). That ${difference.toFixed(1)}-point gap is an association, not proof of cause.`,
        tone: "positive",
        value: round(difference),
      },
      association,
    };
  }

  function describeFocus(association) {
    if (!association) {
      return {
        kind: "focus",
        eyebrow: "Suggested focus",
        title: "Keep the next week simple",
        body: "Log your overall rating and selected habits consistently. A complete week is more useful than acting on an early pattern.",
        tone: "focus",
      };
    }

    const recentTracked = association.tracked.slice(-7);
    const favorableCount = recentTracked.filter(entry =>
      association.habit.lowerIsBetter ? !entry[association.habit.dataKey] : entry[association.habit.dataKey]
    ).length;
    const target = Math.min(5, Math.max(3, favorableCount + 1));

    return {
      kind: "focus",
      eyebrow: "Suggested focus",
      title: association.habit.id === "drink"
        ? "Try a small alcohol-free experiment"
        : `Run a small ${association.habit.label} experiment`,
      body: `Aim for ${favorableDayLabel(association.habit, target)} over your next 7 logged days, without changing everything else at once. Then compare your ratings again.`,
      tone: "focus",
    };
  }

  function buildInsights(data, weeklySummary, habitDefinitions) {
    const pattern = describeHabitPattern(data, habitDefinitions);
    return [
      describeWeeklyMovement(weeklySummary),
      pattern.insight,
      describeFocus(pattern.association),
    ];
  }

  function render(containerOrId, insights) {
    if (typeof document === "undefined") return;
    const container = typeof containerOrId === "string"
      ? document.getElementById(containerOrId)
      : containerOrId;
    if (!container) return;

    container.replaceChildren();
    (Array.isArray(insights) ? insights : []).forEach(insight => {
      const card = document.createElement("article");
      card.className = `coach-card coach-card--${insight.tone || "neutral"}`;

      const eyebrow = document.createElement("p");
      eyebrow.className = "coach-card__eyebrow";
      eyebrow.textContent = insight.eyebrow;

      const title = document.createElement("h3");
      title.textContent = insight.title;

      const body = document.createElement("p");
      body.className = "coach-card__body";
      body.textContent = insight.body;

      card.append(eyebrow, title, body);
      container.appendChild(card);
    });
  }

  const api = {
    buildInsights,
    describeWeeklyMovement,
    findHabitAssociation,
    render,
  };

  globalScope.HabitCoach = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
