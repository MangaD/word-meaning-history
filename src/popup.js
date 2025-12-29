// src/popup.js

// Use wrappers so it works with both chrome(callback) and browser(Promise) styles.
const hasBrowser = typeof browser !== "undefined";
const api = hasBrowser ? browser : chrome;

function sendMessage(msg) {
  // browser.* returns a Promise
  if (hasBrowser) return api.runtime.sendMessage(msg);
  // chrome.* uses callbacks
  return new Promise((resolve, reject) => {
    api.runtime.sendMessage(msg, (resp) => {
      const err = api.runtime.lastError;
      if (err) reject(err);
      else resolve(resp);
    });
  });
}

function storageGet(keys) {
  if (hasBrowser) return api.storage.local.get(keys);
  return new Promise((resolve, reject) => {
    api.storage.local.get(keys, (data) => {
      const err = api.runtime.lastError;
      if (err) reject(err);
      else resolve(data);
    });
  });
}

function storageRemove(keys) {
  if (hasBrowser) return api.storage.local.remove(keys);
  return new Promise((resolve, reject) => {
    api.storage.local.remove(keys, () => {
      const err = api.runtime.lastError;
      if (err) reject(err);
      else resolve();
    });
  });
}

function escapeCsv(value) {
  const s = String(value ?? "");
  // Escape quotes by doubling them, wrap in quotes if needed
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function renderResults(counts, examples) {
  const list = document.getElementById("wordsList");
  const summary = document.getElementById("summary");
  list.innerHTML = "";

  const entries = Object.entries(counts || {}).sort((a, b) => {
    const dc = b[1] - a[1];
    if (dc !== 0) return dc;
    return a[0].localeCompare(b[0]);
  });

  summary.textContent = `Found ${entries.length} unique words.`;

  function shortenUrl(u, max = 48) {
    try {
      const nu = new URL(u);
      const s = `${nu.hostname}${nu.pathname}${nu.search ? "?…" : ""}`;
      return s.length > max ? s.slice(0, max - 1) + "…" : s;
    } catch {
      return u.length > max ? u.slice(0, max - 1) + "…" : u;
    }
  }

  for (const [word, count] of entries) {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "word-block";

    const wordEl = document.createElement("div");
    wordEl.className = "word-main";
    const strong = document.createElement("strong");
    strong.textContent = word;
    strong.className = "word";
    wordEl.appendChild(strong);

    // examples
    const exList = examples && examples[word];
    if (Array.isArray(exList) && exList.length) {
      const exDiv = document.createElement("div");
      exDiv.className = "examples";

      for (const u of exList) {
        const a = document.createElement("a");
        a.href = u;
        a.target = "_blank";
        a.rel = "noreferrer noopener";
        a.textContent = shortenUrl(u);
        a.title = u; // full url on hover
        exDiv.appendChild(a);
      }

      wordEl.appendChild(exDiv);
    }

    left.appendChild(wordEl);

    const right = document.createElement("div");
    right.className = "word-meta";
    const span = document.createElement("span");
    span.className = "count";
    span.textContent = `${count}`;
    right.appendChild(span);

    li.appendChild(left);
    li.appendChild(right);

    list.appendChild(li);
  }
}

async function loadResults() {
  const summary = document.getElementById("summary");
  try {
    const resp = await sendMessage({ cmd: "getResults" });
    if (resp && resp.ok) {
      const data = resp.data || {};
      renderResults(data.emw_counts || {}, data.emw_examples || {});
    } else {
      summary.textContent = "No data.";
    }
  } catch (e) {
    summary.textContent = `Failed to load data: ${e?.message ?? e}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const scanBtn = document.getElementById("scanBtn");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportJsonBtn = document.getElementById("exportJson");
  const exportCsvBtn = document.getElementById("exportCsv");
  const clearBtn = document.getElementById("clearData");
  const engineSelect = document.getElementById("engine");
  const summary = document.getElementById("summary");

  scanBtn.addEventListener("click", async () => {
    const engine = engineSelect.value;
    const engines = engine === "all" ? ["google", "bing", "ddg"] : [engine];

    scanBtn.disabled = true;
    summary.textContent = "Scanning…";

    try {
      const resp = await sendMessage({
        cmd: "scanHistory",
        options: { engines, chunkDays: 30 }
      });

      if (resp && resp.ok) {
        renderResults(resp.result.counts, resp.result.examples);
      } else {
        summary.textContent = "Scan failed.";
      }
    } catch (e) {
      summary.textContent = `Scan failed: ${e?.message ?? e}`;
    } finally {
      scanBtn.disabled = false;
    }
  });

  refreshBtn.addEventListener("click", loadResults);

  exportJsonBtn.addEventListener("click", async () => {
    const data = await storageGet(["emw_counts", "emw_examples"]);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meaning_words.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  exportCsvBtn.addEventListener("click", async () => {
    const data = await storageGet(["emw_counts"]);
    const counts = data.emw_counts || {};
    const rows = [["word", "count"]];

    for (const [w, c] of Object.entries(counts)) rows.push([w, String(c)]);

    // stable-ish output
    rows.sort((a, b) => (a[0] === "word" ? -1 : a[0].localeCompare(b[0])));

    const csv = rows.map(r => `${escapeCsv(r[0])},${escapeCsv(r[1])}`).join("\n") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "meaning_words.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  clearBtn.addEventListener("click", async () => {
    const ok = confirm("Clear stored data? This cannot be undone.");
    if (!ok) return;
    await storageRemove(["emw_counts", "emw_examples"]);
    summary.textContent = "Cleared data.";
    document.getElementById("wordsList").innerHTML = "";
  });

  loadResults();
});
