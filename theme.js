// theme.js
// -------------------------
// Global Theme Manager
// -------------------------

function isDarkMode() {
  return document.body.classList.contains("dark");
}

function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");

  const toggle = document.getElementById("darkModeToggle");
  if (toggle) {
    toggle.textContent =
      theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode";
  }
}

// Load saved theme immediately
const savedTheme = localStorage.getItem("theme") || "light";
applyTheme(savedTheme);

// Attach toggle (if present on page)
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const newTheme = isDarkMode() ? "light" : "dark";
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);

    // Optional hook for pages with charts
    if (typeof rebuildChartsForTheme === "function") {
      rebuildChartsForTheme();
    }
  });
});
