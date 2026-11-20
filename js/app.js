(function () {
  "use strict";

  const form = document.getElementById("eventForm");
  const statusEl = document.getElementById("status");
  const timezone = document.getElementById("timezone");
  const start = document.getElementById("start");
  const end = document.getElementById("end");
  const title = document.getElementById("title");
  const locationInput = document.getElementById("location");
  const description = document.getElementById("description");
  const reminder = document.getElementById("reminder");
  const recurring = document.getElementById("recurring");
  let endAutofilled = false;

  const api = window.Chrono = window.Chrono || {};

  api.safeText = function safeText(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  };

  api.toICSDate = function toICSDate(date) {
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  api.plusOneHour = function plusOneHour(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  api.clampReminder = function clampReminder(value) {
    return Math.max(0, Math.min(40320, Number(value) || 0));
  };

  api.buildICS = function buildICS(e) {
    return [
      "BEGIN:VCALENDAR",
      "PRODID:-//Chrono//EN",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))}@chrono.local`,
      `DTSTAMP:${api.toICSDate(new Date())}`,
      `DTSTART:${api.toICSDate(e.startDate)}`,
      `DTEND:${api.toICSDate(e.endDate)}`,
      `SUMMARY:${api.safeText(e.title)}`,
      `DESCRIPTION:${api.safeText(e.description)}`,
      `LOCATION:${api.safeText(e.location)}`,
      e.recurring ? `RRULE:${e.recurring}` : "",
      "BEGIN:VALARM",
      `TRIGGER:-PT${e.reminder}M`,
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder",
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");
  };

  api.buildGoogleURL = function buildGoogleURL(e) {
    return "https://calendar.google.com/calendar/render?action=TEMPLATE"
      + `&text=${encodeURIComponent(e.title)}`
      + `&dates=${api.toICSDate(e.startDate)}/${api.toICSDate(e.endDate)}`
      + `&details=${encodeURIComponent(e.description)}`
      + `&location=${encodeURIComponent(e.location)}`
      + `&ctz=${encodeURIComponent(e.timezone)}`;
  };

  api.validateEvent = function validateEvent(raw) {
    const event = {
      title: String(raw.title || "").trim(),
      startLocal: raw.startLocal,
      endLocal: raw.endLocal,
      timezone: raw.timezone || "UTC",
      location: String(raw.location || "").trim(),
      description: String(raw.description || "").trim(),
      recurring: raw.recurring || "",
      reminder: api.clampReminder(raw.reminder)
    };
    const startDate = new Date(event.startLocal);
    const endDate = new Date(event.endLocal);
    if (!event.title || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error("Please provide title, start, and end time.");
    }
    if (endDate <= startDate) {
      throw new Error("End time must be after start time.");
    }
    event.startDate = startDate;
    event.endDate = endDate;
    return event;
  };

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle("error", !!isError);
    statusEl.classList.remove("show");
    void statusEl.offsetWidth;
    statusEl.classList.add("show");
  }

  function populateTimezones() {
    const supported = Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : ["UTC"];
    const preferred = [
      "UTC",
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Los_Angeles",
      "Europe/London",
      "Asia/Singapore"
    ];
    const ordered = [...new Set([...preferred.filter((t) => supported.includes(t)), ...supported])];
    timezone.replaceChildren();
    for (const zone of ordered) {
      const opt = document.createElement("option");
      opt.value = zone;
      opt.textContent = zone;
      timezone.appendChild(opt);
    }
    const userZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (ordered.includes(userZone)) timezone.value = userZone;
  }

  function getEventData() {
    return api.validateEvent({
      title: title.value,
      startLocal: start.value,
      endLocal: end.value,
      timezone: timezone.value,
      location: locationInput.value,
      description: description.value,
      recurring: recurring.value,
      reminder: reminder.value
    });
  }

  function refreshPreview() {
    const nodes = [
      document.getElementById("previewTitle"),
      document.getElementById("previewTime"),
      document.getElementById("previewZone"),
      document.getElementById("previewLocation"),
      document.getElementById("previewDesc")
    ];
    nodes.forEach((n) => { n.style.opacity = "0.45"; });

    document.getElementById("previewTitle").textContent = title.value.trim() || "Untitled event";
    document.getElementById("previewZone").textContent = `Timezone · ${timezone.value || "—"}`;
    document.getElementById("previewLocation").textContent = `Place · ${locationInput.value.trim() || "—"}`;
    document.getElementById("previewDesc").textContent = `Notes · ${description.value.trim() || "—"}`;

    if (start.value && end.value) {
      const format = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
      document.getElementById("previewTime").textContent =
        `${format.format(new Date(start.value))} → ${format.format(new Date(end.value))}`;
    } else {
      document.getElementById("previewTime").textContent = "Choose start and end times";
    }

    requestAnimationFrame(() => {
      nodes.forEach((n) => { n.style.opacity = "1"; });
    });
  }

  function downloadICS() {
    const e = getEventData();
    const blob = new Blob([api.buildICS(e)], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(e.title || "event").replace(/[^a-z0-9_-]+/gi, "_")}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
    setStatus("ICS file downloaded.");
  }

  async function generateQR() {
    if (typeof QRCode === "undefined") {
      throw new Error("QR library failed to load.");
    }
    const e = getEventData();
    const container = document.getElementById("qrcode");
    container.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.id = "qrCanvas";
    canvas.setAttribute("aria-label", "Event QR code");
    container.appendChild(canvas);
    await QRCode.toCanvas(canvas, api.buildGoogleURL(e), {
      width: 220,
      margin: 1,
      color: { dark: "#18212b", light: "#ffffff" }
    });
    setStatus("QR ready with full event details.");
  }

  function downloadQR() {
    const canvas = document.getElementById("qrCanvas");
    if (!canvas) {
      setStatus("Generate a QR code first.", true);
      return;
    }
    const link = document.createElement("a");
    link.download = "chrono-qr.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    setStatus("QR image downloaded.");
  }

  async function shareEvent() {
    const e = getEventData();
    const url = api.buildGoogleURL(e);
    if (navigator.share) {
      await navigator.share({
        title: e.title,
        text: `Add this event: ${e.title}`,
        url
      });
      setStatus("Event shared.");
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      setStatus("Share link copied to clipboard.");
      return;
    }
    setStatus("Sharing unsupported here. Copy the Google Calendar URL manually.", true);
  }

  function syncEndWithStart() {
    const computed = api.plusOneHour(start.value);
    if (!end.value || endAutofilled) {
      end.value = computed;
      endAutofilled = true;
    }
    refreshPreview();
  }

  start.addEventListener("change", syncEndWithStart);
  start.addEventListener("input", syncEndWithStart);
  end.addEventListener("input", () => {
    endAutofilled = false;
    refreshPreview();
  });

  [title, locationInput, description, reminder, recurring, timezone].forEach((el) => {
    el.addEventListener("input", refreshPreview);
    el.addEventListener("change", refreshPreview);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      downloadICS();
    } catch (error) {
      setStatus(error.message || "Unable to generate file.", true);
    }
  });

  document.getElementById("googleBtn").addEventListener("click", () => {
    try {
      window.open(api.buildGoogleURL(getEventData()), "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatus(error.message || "Unable to open Google Calendar.", true);
    }
  });

  document.getElementById("qrBtn").addEventListener("click", async () => {
    try {
      await generateQR();
    } catch (error) {
      setStatus(error.message || "Unable to generate QR.", true);
    }
  });

  document.getElementById("qrDownloadBtn").addEventListener("click", downloadQR);

  document.getElementById("shareBtn").addEventListener("click", async () => {
    try {
      await shareEvent();
    } catch (error) {
      setStatus(error.message || "Unable to share event.", true);
    }
  });

  form.addEventListener("reset", () => {
    setTimeout(() => {
      endAutofilled = false;
      document.getElementById("qrcode").replaceChildren();
      setStatus("Form cleared.");
      refreshPreview();
    }, 0);
  });

  const THEME_KEY = "chrono-theme";
  const themeToggle = document.getElementById("themeToggle");
  const root = document.documentElement;

  function applyTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    const isDark = next === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute("content", isDark ? "#12181f" : "#f2f5f7");
  }

  api.getTheme = function getTheme() {
    return root.getAttribute("data-theme") === "light" ? "light" : "dark";
  };

  api.setTheme = function setTheme(theme) {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, api.getTheme());
    } catch (_) { /* ignore quota / private mode */ }
  };

  try {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === "light" || saved === "dark" ? saved : "dark");
  } catch (_) {
    applyTheme("dark");
  }

  themeToggle.addEventListener("click", () => {
    api.setTheme(api.getTheme() === "dark" ? "light" : "dark");
  });

  populateTimezones();
  refreshPreview();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
})();
