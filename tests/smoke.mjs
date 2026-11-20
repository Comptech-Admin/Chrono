import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";

function loadAppApi() {
  const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  const attrs = { "data-theme": "dark" };
  const documentElement = {
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    },
    setAttribute(name, value) {
      attrs[name] = String(value);
    }
  };
  const document = {
    _els: {},
    documentElement,
    querySelector(sel) {
      if (sel === 'meta[name="theme-color"]') {
        return { setAttribute() {} };
      }
      return null;
    },
    getElementById(id) {
      if (!this._els[id]) {
        this._els[id] = {
          id,
          value: "",
          textContent: "",
          style: {},
          classList: { toggle() {}, remove() {}, add() {} },
          addEventListener() {},
          replaceChildren() {},
          appendChild() {},
          offsetWidth: 0,
          setAttribute() {}
        };
      }
      return this._els[id];
    },
    createElement(tag) {
      return { tagName: tag, style: {}, setAttribute() {}, click() {}, href: "", download: "" };
    }
  };

  const localStorage = {
    _data: {},
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(this._data, key) ? this._data[key] : null;
    },
    setItem(key, value) {
      this._data[key] = String(value);
    }
  };

  const sandbox = {
    window: {},
    document,
    navigator: {},
    localStorage,
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    Blob: class {
      constructor(parts) {
        this.parts = parts;
      }
    },
    requestAnimationFrame: (cb) => cb(),
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Array,
    Object,
    Error,
    setTimeout,
    clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "app.js" });
  const api = sandbox.window.Chrono;
  assert.ok(api, "Chrono API should be exported on window");
  return { api, documentElement, localStorage };
}

function run() {
  const { api, documentElement, localStorage } = loadAppApi();

  assert.equal(api.getTheme(), "dark");
  api.setTheme("light");
  assert.equal(api.getTheme(), "light");
  assert.equal(documentElement.getAttribute("data-theme"), "light");
  assert.equal(localStorage.getItem("chrono-theme"), "light");
  api.setTheme("dark");
  assert.equal(api.getTheme(), "dark");

  assert.equal(api.safeText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  assert.equal(api.clampReminder(-5), 0);
  assert.equal(api.clampReminder(999999), 40320);
  assert.equal(api.clampReminder("15"), 15);
  assert.equal(api.plusOneHour("2030-06-01T10:00"), "2030-06-01T11:00");

  const event = api.validateEvent({
    title: "Launch",
    startLocal: "2030-06-01T10:00",
    endLocal: "2030-06-01T11:00",
    timezone: "UTC",
    location: "HQ, Room 1",
    description: "Line1\nLine2; note",
    recurring: "FREQ=WEEKLY",
    reminder: 30
  });

  const ics = api.buildICS(event);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /PRODID:-\/\/Chrono\/\/EN/);
  assert.match(ics, /SUMMARY:Launch/);
  assert.match(ics, /LOCATION:HQ\\, Room 1/);
  assert.match(ics, /DESCRIPTION:Line1\\nLine2\\; note/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /TRIGGER:-PT30M/);

  const url = api.buildGoogleURL(event);
  assert.match(url, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(url, /text=Launch/);
  assert.match(url, /ctz=UTC/);

  assert.throws(
    () => api.validateEvent({ title: "", startLocal: "2030-06-01T10:00", endLocal: "2030-06-01T11:00" }),
    /title/i
  );
  assert.throws(
    () =>
      api.validateEvent({
        title: "X",
        startLocal: "2030-06-01T11:00",
        endLocal: "2030-06-01T10:00"
      }),
    /after start/i
  );

  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /Chrono/);
  assert.doesNotMatch(html, /Datepin|Daywire|EventPulse|📅/);
  assert.equal((html.match(/<!DOCTYPE html>/gi) || []).length, 1);
  assert.match(html, /data-theme="dark"/);
  assert.match(html, /id="themeToggle"/);
  assert.match(html, /css\/styles\.css/);
  assert.match(html, /js\/app\.js/);
  assert.match(html, /family=Syne/);
  assert.match(html, /family=Figtree/);

  const css = readFileSync(new URL("../css/styles.css", import.meta.url), "utf8");
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /\[data-theme="light"\]/);
  assert.match(css, /--accent:\s*#0f6d63/);
  assert.match(css, /Syne/);
  assert.match(css, /Figtree/);
  assert.doesNotMatch(css, /Inter|Roboto|#5b6cff|#0b1020/);

  const js = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(js, /chrono-theme/);
  assert.match(js, /api\.setTheme/);
  assert.match(js, /api\.getTheme/);

  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /^# Chrono/m);
  assert.doesNotMatch(readme, /Datepin|Daywire|EventPulse/);

  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.short_name, "Chrono");
  assert.match(manifest.name, /Chrono/);

  const sw = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.match(sw, /chrono-v3/);
  assert.match(html, /comptech-admin\.github\.io\/Chrono\//);
  assert.match(sw, /css\/styles\.css/);
  assert.match(sw, /js\/app\.js/);

  console.log("smoke.mjs: all checks passed");
}

run();
