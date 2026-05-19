# DayMark Capacitor Shell

This branch wraps the existing vanilla multi-page web app in a minimal Capacitor shell.

The source web app still lives at the repository root, so the browser and Live Server workflow remains unchanged. Capacitor uses the generated `www` folder.

## Build the Web Bundle

```sh
npm run build:cap
```

This copies the required HTML, CSS, and JavaScript files into `www`.

## Sync iOS

First install dependencies:

```sh
npm install
```

Then create the iOS project:

```sh
npm run cap:add:ios
```

After the iOS project exists, sync updates:

```sh
npm run cap:sync
```

## Open iOS in Xcode

```sh
npm run cap:open:ios
```

The iOS app is named `DayMark` and uses bundle id `com.daymark.app`.

## Notes

- This setup bundles local web files instead of loading a hosted URL.
- Supabase and Chart.js are still loaded from CDN in the HTML files.
- Supabase auth uses WebView storage through the existing browser-oriented logic.
- No push notification work is included in this branch.
