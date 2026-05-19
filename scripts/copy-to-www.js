const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "www");

const rootFiles = [
  "index.html",
  "input.html",
  "data.html",
  "settings.html",
  "login.html",
  "style.css",
  "script.js",
  "input.js",
  "login.js",
  "habitPreferences.js",
  "theme.js",
  "supabaseClient.js"
];

const optionalAssetDirs = [
  "assets",
  "icons",
  "images"
];

function copyFile(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(webDir, relativePath);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing required app file: ${relativePath}`);
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(relativePath) {
  const source = path.join(rootDir, relativePath);
  const target = path.join(webDir, relativePath);

  if (!fs.existsSync(source)) return;

  fs.cpSync(source, target, {
    recursive: true,
    force: true,
    filter: copiedPath => !copiedPath.includes(`${path.sep}.git${path.sep}`)
  });
}

fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });

rootFiles.forEach(copyFile);
optionalAssetDirs.forEach(copyDirectory);

console.log(`Copied ${rootFiles.length} app files into ${path.relative(rootDir, webDir)}.`);
