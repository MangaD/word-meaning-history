 We can turn **Word Meaning History** into a browser extension that runs inside the user’s browser, reads (or watches) search activity, extracts single-word `"<word> meaning"` queries, and shows/export them in a small UI — all processed locally, no external servers. Below I’ll give you a full, practical plan plus starter code you can drop in a repo and iterate on.

I’ll include:

* high-level design and UX
* required permissions & privacy notes
* a ready-to-use code skeleton (Manifest V3-style, compatible with modern Firefox & Chromium browsers that support MV3)
* background/service-worker logic that scans history (and optionally listens for live searches)
* popup UI (HTML + JS) to view/export words
* testing & publishing notes

---

# 1) High-level design

Features:

* On-demand scan of browser history for `"<word> meaning"` queries (Google/Bing/DuckDuckGo).
* Optional live capture of new searches (via `webRequest` or `history.onVisited`).
* Local-only processing; results kept in `storage.local` and exportable to `CSV` / `JSON`.
* Filter by engine (Google/Bing/DDG), time range, min frequency, top N.
* Small popup UI to view/export and a simple options page.

Why extension vs script:

* Extension gives one-click access, does not require copying DB files, works cross-platform, and can run continuously or on demand.
* Requires user permission to access history — this is the biggest UX/privacy tradeoff.

---

# 2) Permissions & privacy

Permissions needed:

* `"history"` — to read `history` entries.
* `"storage"` — to persist results.
* `"activeTab"` / `"tabs"` — optional if you want to inspect active tabs or add a context menu.
* `"alarms"` — optional for scheduled periodic scans.
* optionally `"webRequest", "webRequestBlocking", "<all_urls>"` if you want to capture searches in real time (careful: more intrusive and often requires additional manifest host permissions and review).

Privacy:

* All processing happens locally in the extension.
* Make clear in the README/manifest `description` that no data is transmitted externally.
* Provide an options toggle (enable/disable history access or live capture) and a way to clear stored data.

---

# 3) Starter project structure

```
browser-extension-extract-meaning/
├── manifest.json
├── icons/
│   └── icon-48.png
├── src/
│   ├── background.js        # service worker (MV3)
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── utils.js
├── README.md
└── LICENSE
```

---

# 4) Manifest (MV3) — minimal

```json
{
  "manifest_version": 3,
  "name": "Word Meaning History",
  "version": "0.1.0",
  "description": "Extracts single-word '<word> meaning' searches from browser history (Google, Bing, DuckDuckGo). Local-only processing.",
  "icons": {
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "history",
    "storage",
    "tabs",
    "alarms"
  ],
  "action": {
    "default_popup": "src/popup.html",
    "default_title": "Word Meaning History"
  },
  "background": {
    "service_worker": "src/background.js"
  },
  "options_ui": {
    "page": "src/popup.html",
    "open_in_tab": false
  },
  "host_permissions": []
}
```

Notes:

* This manifest is MV3-style (service worker). Most modern browsers support MV3—including Firefox (with some differences historically) and Chromium-based browsers. If you need MV2 for older browsers, adjust accordingly.
* `webRequest` is intentionally omitted to keep review friction low; we rely on the `history` API and optional `history.onVisited` for live capture.

---

# 5) Core logic (utils.js)

This is the JavaScript equivalent of your Python extraction logic.

```javascript
// src/utils.js

// Engines host checks
function isGoogleHost(host) {
  return /(^|\.)google\.[^/]+$/i.test(host);
}
function isBingHost(host) {
  return /(^|\.)bing\.com$/i.test(host);
}
function isDDGHost(host) {
  return /(^|\.)duckduckgo\.com$/i.test(host);
}

// Extract the q param from a URL (returns decoded string or "")
function extractQueryParam(url) {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('q') || '';
    // decode plus signs and percent encoding
    return decodeURIComponent(q.replace(/\+/g, ' '));
  } catch (e) {
    return '';
  }
}

// Candidate extraction: single token before 'meaning'
function candidateFromQuery(q) {
  if (!q) return null;
  const qLower = q.toLowerCase();

  // ignore patterns like "meaning of ..."
  if (qLower.includes('meaning of')) return null;

  // find 'meaning' token
  const idx = qLower.indexOf('meaning');
  if (idx === -1) return null;

  let left = q.slice(0, idx).trim();
  if (!left) return null;

  // split into tokens; only accept a single token
  const tokens = left.split(/\s+/);
  if (tokens.length !== 1) return null;

  // sanity check token — allow letters, hyphen, apostrophe
  const word = tokens[0].replace(/^["']|["']$/g, '');
  if (!/^[\p{L}\-'\u2019]+$/u.test(word)) return null; // letters/hyphen/apostrophe

  return word.toLowerCase();
}
```

---

# 6) Background service worker (scan + storage)

This scans the history when the extension loads or on-demand, collects counts, and stores results.

```javascript
// src/background.js
importScripts(); // not necessary but left to indicate worker

// You can import utils code using modules in MV3 if bundling; for simplicity, re-include functions here
// for the prototype we paste candidateFromQuery and extractQueryParam (or bundle via a build step)

(async function() {
  // Re-declare helper functions (or import if bundling)
  function extractQueryParam(url) {
    try {
      const u = new URL(url);
      const q = u.searchParams.get('q') || '';
      return decodeURIComponent(q.replace(/\+/g, ' '));
    } catch (e) {
      return '';
    }
  }
  function isGoogleHost(host) { return /(^|\.)google\.[^/]+$/i.test(host); }
  function isBingHost(host) { return /(^|\.)bing\.com$/i.test(host); }
  function isDDGHost(host) { return /(^|\.)duckduckgo\.com$/i.test(host); }
  function candidateFromQuery(q) {
    if (!q) return null;
    const qLower = q.toLowerCase();
    if (qLower.includes('meaning of')) return null;
    const idx = qLower.indexOf('meaning');
    if (idx === -1) return null;
    let left = q.slice(0, idx).trim();
    if (!left) return null;
    const tokens = left.split(/\s+/);
    if (tokens.length !== 1) return null;
    const word = tokens[0].replace(/^["']|["']$/g, '');
    if (!/^[\p{L}\-'\u2019]+$/u.test(word)) return null;
    return word.toLowerCase();
  }

  // Main scan function
  async function scanHistory({limit = null, engines = ['google','bing','ddg']} = {}) {
    return new Promise((resolve, reject) => {
      const query = { text: '', maxResults: limit || 100000 }; // large default
      chrome.history.search(query, function(results) {
        const counts = {};
        const examples = {};
        for (const item of results) {
          try {
            const url = item.url;
            if (!url) continue;
            const host = (new URL(url)).hostname;
            const engine = isGoogleHost(host) ? 'google' : (isBingHost(host) ? 'bing' : (isDDGHost(host) ? 'ddg' : 'other'));
            if (engine === 'other') continue;
            if (!engines.includes(engine)) continue;
            const q = extractQueryParam(url);
            const candidate = candidateFromQuery(q);
            if (!candidate) continue;
            counts[candidate] = (counts[candidate] || 0) + 1;
            if (!examples[candidate]) examples[candidate] = [];
            if (examples[candidate].length < 3) examples[candidate].push(url);
          } catch (e) {
            // ignore per-url parse errors
          }
        }
        resolve({counts, examples});
      });
    });
  }

  // Expose functions via runtime message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.cmd === 'scanHistory') {
      scanHistory(message.options).then(result => {
        // Save to storage
        chrome.storage.local.set({ emw_counts: result.counts, emw_examples: result.examples }, () => {
          sendResponse({ ok: true, result });
        });
      }).catch(err => {
        sendResponse({ ok: false, error: err && err.message });
      });
      return true; // keep channel open for async sendResponse
    } else if (message && message.cmd === 'getResults') {
      chrome.storage.local.get(['emw_counts', 'emw_examples'], data => {
        sendResponse({ ok: true, data });
      });
      return true;
    }
    return false;
  });

  // Optional: run a scan on install
  chrome.runtime.onInstalled.addListener(() => {
    scanHistory({limit: 20000}).then(r => {
      chrome.storage.local.set({ emw_counts: r.counts, emw_examples: r.examples });
    });
  });

})();
```

Notes:

* This uses `chrome.history.search()` which is standard in Chrome/Firefox (WebExtensions).
* The service worker exposes runtime messages so popup can ask it to `scanHistory` or `getResults`.

---

# 7) Popup UI (popup.html + popup.js)

A simple UI to trigger scans and show/export results.

**popup.html**

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link rel="stylesheet" href="popup.css" />
  <title>Word Meaning History</title>
</head>
<body>
  <div id="app">
    <h2>Word Meaning History</h2>
    <div class="controls">
      <label>Engine:
        <select id="engine">
          <option value="all">All</option>
          <option value="google">Google</option>
          <option value="bing">Bing</option>
          <option value="ddg">DuckDuckGo</option>
        </select>
      </label>
      <button id="scanBtn">Scan History</button>
      <button id="refreshBtn">Load Results</button>
    </div>

    <div id="summary"></div>
    <ul id="wordsList"></ul>

    <div class="actions">
      <button id="exportJson">Export JSON</button>
      <button id="exportCsv">Export CSV</button>
      <button id="clearData">Clear</button>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**popup.js**

```javascript
// src/popup.js

function renderResults(counts, examples) {
  const list = document.getElementById('wordsList');
  list.innerHTML = '';
  const entries = Object.entries(counts || {}).sort((a,b) => b[1]-a[1]);
  document.getElementById('summary').textContent = `Found ${entries.length} unique words.`;
  for (const [word, count] of entries) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${word}</strong> <span class="count">(${count})</span>`;
    if (examples && examples[word]) {
      const ex = document.createElement('div');
      ex.className = 'examples';
      ex.innerHTML = examples[word].map(u => `<a href="${u}" target="_blank">${u}</a>`).join('<br>');
      li.appendChild(ex);
    }
    list.appendChild(li);
  }
}

function loadResults() {
  chrome.runtime.sendMessage({cmd:'getResults'}, resp => {
    if (resp && resp.ok) {
      const data = resp.data || {};
      renderResults(data.emw_counts || {}, data.emw_examples || {});
    } else {
      document.getElementById('summary').textContent = 'No data.';
    }
  });
}

document.getElementById('scanBtn').addEventListener('click', () => {
  const engine = document.getElementById('engine').value;
  const engines = engine === 'all' ? ['google','bing','ddg'] : [engine];
  document.getElementById('summary').textContent = 'Scanning…';
  chrome.runtime.sendMessage({cmd:'scanHistory', options:{engines, limit: 50000}}, resp => {
    if (resp && resp.ok) {
      renderResults(resp.result.counts, resp.result.examples);
    } else {
      document.getElementById('summary').textContent = 'Scan failed.';
    }
  });
});

document.getElementById('refreshBtn').addEventListener('click', loadResults);

document.getElementById('exportJson').addEventListener('click', () => {
  chrome.storage.local.get(['emw_counts','emw_examples'], data => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meaning_words.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('exportCsv').addEventListener('click', () => {
  chrome.storage.local.get(['emw_counts'], data => {
    const counts = data.emw_counts || {};
    let csv = 'word,count\n';
    for (const [w, c] of Object.entries(counts)) {
      csv += `${w},${c}\n`;
    }
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'meaning_words.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('clearData').addEventListener('click', () => {
  chrome.storage.local.remove(['emw_counts','emw_examples'], () => {
    document.getElementById('summary').textContent = 'Cleared data.';
    document.getElementById('wordsList').innerHTML = '';
  });
});

// load on open
loadResults();
```

**popup.css**

```css
/* src/popup.css */
body { font-family: Arial, sans-serif; width: 360px; padding: 12px; }
h2 { margin: 0 0 8px; font-size: 16px; }
.controls { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
.controls select { padding:4px; }
button { padding:6px 8px; }
#wordsList { list-style:none; padding-left:0; max-height:240px; overflow:auto; margin-top:8px; }
#wordsList li { margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:6px; }
.examples a { display:block; font-size:11px; color:#0066cc; text-decoration:none; }
.count { color:#666; margin-left:6px; font-size:12px; }
.actions { margin-top:8px; display:flex; gap:6px; }
```

---

# 8) Testing locally

1. Open Chrome (or Firefox).
2. Go to `chrome://extensions/` (Chrome) or `about:debugging#/runtime/this-firefox` (Firefox).
3. Enable Developer Mode (Chrome) or click “Load Temporary Add-on” (Firefox).
4. Load the extension directory (in Chrome: "Load unpacked" → choose root dir; in Firefox: point to `manifest.json`).
5. Click the extension icon and press **Scan History**. Grant history permission when prompted.
6. Verify results, export CSV/JSON.

---

# 9) Publishing & review notes

* Chrome Web Store: include privacy policy and note you only use history locally; reviewers may ask for justification for history permission.
* Firefox Add-ons (AMO): similar—provide detailed descriptions and privacy notes. Keep `webRequest` out if you want lower friction.
* Keep the code open-source and clear where everything runs (local only).

---

# 10) Next development ideas / enhancements

* Show time ranges and allow filtering by date.
* Use `history.search({text:'', startTime, endTime})` to limit scan by date.
* Add a scheduled background scan with `alarms` and a notification when new words appear.
* Add a context menu to add a highlighted word to a user whitelist/blacklist.
* Add unit tests via a simple headless browser test (Puppeteer) or extension unit test harness.
* Provide a one-click export to your portfolio repo (if you want to publish derived statistics).

---

# 11) Do you want me to generate the full repo files?

I can:

* create the complete repository files (manifest, all `src/*` files, icons, README and LICENSE) and show them here,
* or produce a ZIP-ready archive layout you can copy/paste into your repo,
* or produce a step-by-step GitHub Actions workflow to lint/build and automatically publish (if you want to publish).

Tell me which of these you want next (full repo files in the chat, a ZIP, or GitHub Actions), and I’ll produce them right away.

---


---

If you want, I can next:
- tailor a **Chrome Web Store / Firefox Add-ons listing description** (those have strict wording requirements),
- generate **store screenshots text + captions**,
- or align this README stylistically with your **portfolio project page** so they cross-reference perfectly.

Just tell me the next step.
