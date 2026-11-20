# Chrono — Calendar Invite + QR Generator

Chrono is a static calendar-reminder app: compose an event, download an `.ics`, open Google Calendar, or share a QR — no account, no backend.

## Features

- Professional UI with dark mode default and a light/dark toggle
- One-click `.ics` download with reminder alarms
- Google Calendar deep link
- QR code for the full event link (title, time, location, description)
- Auto end-time (+1 hour) when start changes
- Live preview, Web Share / clipboard fallback
- PWA shell (`manifest.json` + `service-worker.js`)
- SEO basics (meta, Open Graph, Twitter, JSON-LD, `robots.txt`, `sitemap.xml`)

## Structure

- `index.html` — markup + SEO shell
- `css/styles.css` — layout and theme
- `js/app.js` — validation, ICS, Google URL, QR, share
- `assets/` — local icon and social preview SVGs
- `tests/smoke.mjs` — logic smoke tests

## Run locally

Default production/nginx serve port is **80**. Any static file server works; use whatever port you need.

Optional local Python example (port 4173 is not required):

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Tests

```bash
node tests/smoke.mjs
```

## Security notes

- ICS fields escape `\`, `,`, `;`, and newlines
- Start/end validation and reminder clamped to `0..40320`
- `window.open(..., "noopener,noreferrer")`
- Previews use `textContent`; CSP restricts script/style sources
- Icons and previews are local SVGs (no remote branding assets)

## Live

GitHub Pages: https://comptech-admin.github.io/Chrono/
