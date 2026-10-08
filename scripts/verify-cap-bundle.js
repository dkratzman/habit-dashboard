const assert = require("assert");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const requiredFiles = [
  "index.html",
  "style.css",
  "script.js",
  "habitPreferences.js",
  "habitCoach.js",
];

requiredFiles.forEach(relativePath => {
  const source = path.join(rootDir, relativePath);
  const bundled = path.join(rootDir, "www", relativePath);
  assert(fs.existsSync(bundled), `Missing Capacitor bundle file: ${relativePath}`);
  assert.strictEqual(
    fs.readFileSync(bundled, "utf8"),
    fs.readFileSync(source, "utf8"),
    `Capacitor bundle is stale: ${relativePath}`
  );
});

const bundledIndex = fs.readFileSync(path.join(rootDir, "www", "index.html"), "utf8");
assert.match(bundledIndex, /<script src="habitCoach\.js"><\/script>/);

console.log("Capacitor web bundle checks passed.");
