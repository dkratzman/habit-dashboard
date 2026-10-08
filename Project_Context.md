# DayMark Habit Dashboard - Project Context

Last updated: October 7, 2026

DayMark is a personal habit dashboard built as a vanilla HTML/CSS/JavaScript app with Supabase auth/database persistence and Chart.js visualizations. The browser app still lives at the repository root, and the current branch also includes a Capacitor iOS shell so the same local web files can be bundled into a mobile app.

## Current Tech Stack

- HTML, CSS, and JavaScript with no frontend build framework.
- Chart.js loaded from CDN for dashboard charts.
- Supabase for authentication and database persistence.
- LocalStorage for display preferences, onboarding state, theme state, and local time-goal defaults.
- Capacitor 8 for the iOS app shell.

## Repository And GitHub State

- Current local branch: `main`.
- GitHub remote: `https://github.com/dkratzman/habit-dashboard.git`.
- The working tree was clean at commit `3be9fdedfea0d70ba53f0da6f91a353f5ddb71f4` before the Habit Coach upgrade began.
- Local checkpoint branch `codex/pre-habit-coach-20261007` preserves that pre-upgrade commit.
- The Habit Coach and validation workflow changes from the current upgrade are intentionally left uncommitted for review.
- Nothing is automatically updated on GitHub unless changes are committed and pushed with Git.

## Core Files

- `index.html`: main dashboard, dashboard section tabs, onboarding/walkthrough modals, weekly summary markup, chart canvases, Daily Notes table, mobile bottom nav.
- `script.js`: dashboard data loading, data mapping, date filters, chart building, weekly summary computation, onboarding behavior, Daily Notes rendering.
- `habitCoach.js`: local-only Habit Coach analysis and safe UI rendering for movement, habit associations, and a suggested focus.
- `input.html`: daily entry page with date calendar, habit toggles, time/number steppers, ratings, daily keyword/summary, overwrite modal, recent entry table, mobile bottom nav.
- `input.js`: entry calendar behavior, habit toggle behavior, time and number steppers, goal comparison coloring, duplicate-date overwrite flow, Supabase insert/update, form reset and submission summary.
- `settings.html`: habit choice setup, time-goal setup, walkthrough/example modals, settings actions, mobile bottom nav.
- `habitPreferences.js`: fixed habit catalog, enabled habit preferences, local time-goal defaults, setup rendering, and app-wide preference update events.
- `style.css`: shared responsive styling, dark/light theme variables, dashboard tabs, weekly summary, entry calendar, input controls, onboarding/settings modals, mobile bottom navigation.
- `theme.js`: dark/light mode handling.
- `supabaseClient.js`: Supabase initialization.
- `login.html` and `login.js`: auth UI and login/signup flow.
- `CAPACITOR.md`: mobile shell setup notes and commands.
- `scripts/copy-to-www.js`: copies root web app files into `www` for Capacitor.
- `scripts/check-habit-coach.js`: deterministic checks for coach thresholds, cautious wording, and sparse-data fallbacks.
- `scripts/verify-cap-bundle.js`: confirms required web files are present and current in the generated Capacitor bundle.
- `.github/workflows/validate.yml`: installs dependencies and runs `npm run check` for pushes and pull requests.
- `capacitor.config.json`: Capacitor app config for DayMark.

## Important Implementation Rules

1. Do not refactor broadly unless explicitly requested.
2. Preserve working features and existing Supabase schema.
3. Make small, high-confidence changes.
4. Explain every file changed.
5. Before editing, inspect the existing code and identify the exact section to modify.
6. Keep chart logic and UI logic separated where practical.
7. Prefer existing local helper functions and events over adding new architecture.
8. Treat localStorage preferences as display/setup state, not canonical tracked habit data.

## Current Stable Behavior

- Supabase login works.
- Dashboard charts work.
- Date filters use `startMonth` and `endMonth`.
- `buildCharts(getFilteredData())` is the main dashboard rebuild trigger.
- Weekly summary compares recent 7 days against previous 7 days.
- Habit Coach shows three local, automatic cards on the Week page and uses minimum sample sizes before reporting an association.
- Daily Notes table renders Date, Keyword, Summary, and Overall.
- Dark mode affects chart colors through `getChartTheme()` and `body.dark`.
- Appearance settings now cycle through Light, Dark, and a scoped Journal theme; Journal uses paper texture, ink typography, and muted chart colors without changing the original themes.
- Dashboard can switch between weekly summary and chart sections.
- Mobile bottom navigation is present across main app pages.
- Entry page supports one entry per day and asks before overwriting an existing entry.

## Major Updates Made

- Added a more complete onboarding/walkthrough flow for new users.
- Added habit preference setup so users can choose which habits are visible and tracked in the UI.
- Added reusable habit definitions in `habitPreferences.js`.
- Added time-goal setup for bedtime, wake time, hours worked, and personal hours.
- Added goal-aware input steppers that visually indicate whether a value meets or misses its goal.
- Added an entry calendar with entered/waiting/upcoming day states.
- Added duplicate-date detection and overwrite confirmation for daily entries.
- Added daily keyword and daily summary fields.
- Added recent submission summary feedback after saving an entry.
- Added dashboard section navigation so weekly summary and charts are separated.
- Added weekly summary cards for ratings, sleep, time, and habits.
- Added dynamic habit chart/summary behavior based on enabled habits.
- Added Daily Notes rendering on the dashboard.
- Added dark-mode-friendly chart and table styling.
- Added mobile bottom navigation and responsive mobile layouts.
- Added a local-only Habit Coach MVP with recent movement, statistically cautious habit associations, and a suggested one-week focus.
- Added automated coach checks and a GitHub Actions validation workflow for the Capacitor web bundle.
- Added an optional Journal appearance with warm paper texture, restrained natural colors, and matching charts across dashboard, entry, data, settings, and login pages.
- Added a Capacitor iOS shell for bundling the web app as DayMark.
- Added a `www` bundle output generated from root app files.
- Added npm scripts for Capacitor build/sync/open workflows.

## Most Recent Local UI Tweaks

- Shortened rating button text from `3 Average` to `3 Avg.` on the input page.
- Reduced habit grid minimum width and gaps so habit toggles fit better on smaller screens.
- Added a two-column mobile habit layout below 520px.
- Added `touch-action: manipulation` to steppers, habit toggles, calendar buttons, option buttons, and calendar days to reduce accidental double-tap behavior on mobile.
- Prevented double-click default behavior on time and number stepper buttons.

## Capacitor / iOS Notes

- App name: `DayMark`.
- Bundle id: `com.daymark.app`.
- Source web app remains at the repository root.
- Capacitor uses the generated `www` folder.
- Build the web bundle with:

```sh
npm run build:cap
```

- Sync iOS after web changes with:

```sh
npm run cap:sync
```

- Open the iOS project in Xcode with:

```sh
npm run cap:open:ios
```

- Supabase and Chart.js are still loaded from CDN in the HTML files.
- No push notification work is included yet.

## Suggested ChatGPT Handoff Prompt

Use this when setting the project up in ChatGPT:

```text
I am working on DayMark, a vanilla HTML/CSS/JavaScript personal habit dashboard with Supabase auth/database persistence, Chart.js dashboard charts, localStorage-based habit/time-goal preferences, and a Capacitor iOS shell. Please read Project_Context.md first and preserve the existing architecture. Do not make broad refactors unless I explicitly ask. Keep Supabase schema changes off-limits unless requested. Prefer small, high-confidence edits that preserve the current dashboard, input, settings, onboarding, mobile navigation, and Capacitor workflows.
```

## Good Next Steps

- Commit the current local changes when they look good.
- Push branch `capacitor-app-shell` to GitHub when ready.
- Verify the browser app after UI changes.
- Run `npm run build:cap` before syncing iOS.
- Run `npm run check` before proposing or committing app changes.
- Decide whether `www/` should stay committed or be treated as generated output.
- Decide whether the Capacitor branch should be merged into the main GitHub branch.
