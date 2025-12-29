# Word Meaning History (Browser Extension)

> Extract all single-word “\<word> meaning” searches directly from your browser history.

**Word Meaning History** is a lightweight browser extension that scans your local browsing history and compiles a list of words you’ve searched the meaning of — for example `altruism meaning`, `ephemeral meaning`, etc.

The extension works entirely **locally**, supports **Google**, **Bing**, and **DuckDuckGo**, and lets you export results in **JSON** or **CSV** format.

---

## ✨ Features

- 🔍 Scans browser history for `<word> meaning` queries
- 🌐 Supports Google (all TLDs), Bing, and DuckDuckGo
- 📊 Frequency counts per word
- 📤 Export results as:
  - JSON (with optional example URLs)
  - CSV
- 🔐 Local-only processing — **no data leaves your browser**
- ⚡ Works even with large histories

---

## 🧭 How It Works

1. The extension uses the browser’s `history` API to retrieve visited URLs.
2. It detects search result pages from supported search engines.
3. The search query (`q` parameter) is parsed and decoded.
4. If the query matches the pattern `<single-word> meaning`, the word is extracted and counted.
5. Results are stored locally using `storage.local`.

No external services, analytics, or tracking are used.

---

## 🛡️ Privacy & Permissions

### Required permissions
- **`history`** — to scan past searches
- **`storage`** — to save extracted words locally

### Privacy guarantees
- ✅ No network requests
- ✅ No telemetry
- ✅ No uploads
- ✅ No third-party services

All data remains on your machine and can be cleared at any time via the extension UI.

---

## Why two manifests?

Firefox currently rejects MV3 `background.service_worker` in many environments, so this repo builds:

- **Chrome build**: Manifest V3 (service worker background)
- **Firefox build**: Manifest V2 (background scripts)

A small build script outputs two `dist/` folders.

---

## Build

Requirements:
- Node.js 18+ (any modern Node should work)

```bash
npm run build
```

Outputs:

* `dist/chrome/`
* `dist/firefox/`

## 📦 Installation (Development)

### Chrome / Chromium
1. Clone this repository
2. Build: `npm run build:chrome`
3. Open `chrome://extensions`
4. Enable **Developer Mode**
5. Click **Load unpacked**
5. Select `dist/chrome/`

### Firefox
1. Clone this repository
2. Build: `npm run build:firefox`
3. Open `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**
5. Select `dist/firefox/manifest.json`

---

## 🖥️ Usage

1. Click the extension icon
2. Select the search engine(s) to include
3. Click **Scan History**
4. Review extracted words and counts
5. Export results as JSON or CSV if desired

You can re-run scans at any time or clear stored data from the popup.

---

## 📤 Export Formats

### CSV
```csv
word,count
altruism,3
ephemeral,1
```

### JSON

```json
{
  "words": [
    {
      "word": "altruism",
      "count": 3,
      "examples": [
        "https://www.google.com/search?q=altruism+meaning"
      ]
    }
  ]
}
```

---

## Permissions

* `history` — required to scan your history entries.
* `storage` — stores extracted words and counts locally.
* `tabs` — optional; used for convenience / future improvements.
* `alarms` — optional; allows scheduled scans.

---

## 🤖 Attribution

The core implementation of this project was generated with the assistance of **ChatGPT**.
All code was **reviewed, refined, and integrated** by me before publication.

This project also serves as an experiment in AI-assisted tooling development, emphasizing careful human review, privacy awareness, and maintainable design.

---

## 🛣️ Roadmap

* Date-range filtering (e.g. last 30 days)
* Live tracking of new “meaning” searches
* Word allowlist / blocklist
* Optional statistics view (timeline, trends)
* Extension store releases (Chrome Web Store, Firefox Add-ons)

---

## 📜 License

MIT License — see [`LICENSE`](./LICENSE).

---

## ⚠️ Disclaimer

This extension analyzes your browsing history.
Only install it if you are comfortable granting history access and reviewing the source code.

