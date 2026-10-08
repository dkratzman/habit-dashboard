const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function createClassList() {
  const classes = new Set();
  return {
    contains: value => classes.has(value),
    toggle(value, force) {
      if (force) classes.add(value);
      else classes.delete(value);
    },
  };
}

const label = { textContent: "" };
let clickHandler = null;
const toggle = {
  title: "",
  querySelector: selector => selector === "strong" ? label : null,
  setAttribute(name, value) { this[name] = value; },
  addEventListener(eventName, handler) {
    if (eventName === "click") clickHandler = handler;
  },
};
const storage = new Map();
const body = { classList: createClassList() };
const sandbox = {
  document: {
    body,
    getElementById: id => id === "themeToggle" ? toggle : null,
    addEventListener: (eventName, handler) => {
      if (eventName === "DOMContentLoaded") handler();
    },
  },
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
  window: { dispatchEvent() {} },
};

const themeSource = fs.readFileSync(path.resolve(__dirname, "..", "theme.js"), "utf8");
vm.runInNewContext(themeSource, sandbox);

assert.strictEqual(label.textContent, "Light theme");
assert(clickHandler, "theme toggle should attach a click handler");

clickHandler();
assert(body.classList.contains("dark"));
assert.strictEqual(storage.get("theme"), "dark");
assert.strictEqual(label.textContent, "Dark theme");

clickHandler();
assert(!body.classList.contains("dark"));
assert(body.classList.contains("journal"));
assert.strictEqual(storage.get("theme"), "journal");
assert.strictEqual(label.textContent, "Journal theme");

clickHandler();
assert(!body.classList.contains("journal"));
assert.strictEqual(storage.get("theme"), "light");
assert.strictEqual(label.textContent, "Light theme");

console.log("Theme cycle checks passed.");
