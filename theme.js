// theme.js
// -------------------------
// Global Theme Manager
// -------------------------

const THEME_SEQUENCE = ["light", "dark", "journal"];
const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  journal: "Journal",
};

function isDarkMode() {
  return document.body.classList.contains("dark");
}

function getCurrentTheme() {
  if (document.body.classList.contains("journal")) return "journal";
  if (document.body.classList.contains("dark")) return "dark";
  return "light";
}

function getThemeToggle() {
  return document.getElementById("themeToggle") || document.getElementById("darkModeToggle");
}

function applyTheme(theme) {
  const nextTheme = THEME_SEQUENCE.includes(theme) ? theme : "light";
  document.body.classList.toggle("dark", nextTheme === "dark");
  document.body.classList.toggle("journal", nextTheme === "journal");

  const toggle = getThemeToggle();
  if (toggle) {
    const label = toggle.querySelector("strong");
    const currentIndex = THEME_SEQUENCE.indexOf(nextTheme);
    const followingTheme = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
    if (label) label.textContent = `${THEME_LABELS[nextTheme]} theme`;
    else toggle.textContent = `${THEME_LABELS[nextTheme]} theme`;
    toggle.setAttribute(
      "aria-label",
      `Current appearance: ${THEME_LABELS[nextTheme]}. Switch to ${THEME_LABELS[followingTheme]}.`
    );
    toggle.title = `Switch to ${THEME_LABELS[followingTheme]} theme`;
  }

  if (typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent("habitdash:theme-changed", { detail: { theme: nextTheme } }));
  }
}

// Load saved theme immediately
const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

// Attach toggle (if present on page)
document.addEventListener("DOMContentLoaded", () => {
  const toggle = getThemeToggle();
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const currentIndex = THEME_SEQUENCE.indexOf(getCurrentTheme());
    const newTheme = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);

    // Optional hook for pages with charts
    if (typeof rebuildChartsForTheme === "function") {
      rebuildChartsForTheme();
    }
  });
});
