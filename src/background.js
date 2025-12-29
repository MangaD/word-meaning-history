// src/background.js

// Use callback-style API consistently across Chrome and Firefox.
const api = (typeof browser !== "undefined") ? browser : chrome;

(function () {
  function extractQueryParam(url) {
    try {
      const u = new URL(url);
      const q = u.searchParams.get("q") || "";
      return decodeURIComponent(q.replace(/\+/g, " "));
    } catch {
      return "";
    }
  }

  function isGoogleHost(host) { return /(^|\.)google\.[^/]+$/i.test(host); }
  function isBingHost(host) { return /(^|\.)bing\.com$/i.test(host); }
  function isDDGHost(host) { return /(^|\.)duckduckgo\.com$/i.test(host); }

  function candidateFromQuery(q) {
    if (!q) return null;

    // Normalize whitespace
    const normalized = String(q).trim();

    // Must end with " meaning" (case-insensitive), allowing trailing spaces already trimmed
    // Capture everything before the final " meaning"
    const m = normalized.match(/^(.*)\s+meaning$/i);
    if (!m) return null;

    const phrase = m[1].trim();
    if (!phrase) return null;

    return phrase.toLowerCase();
  }

  async function scanHistory({ engines = ["google", "bing", "ddg"], chunkDays = 30, limit } = {}) {
    const counts = {};
    const examples = {};

    // Track how many history entries we've processed; 'limit' bounds the work if provided.
    let processed = 0;
    const maxToProcess = (typeof limit === "number" && isFinite(limit)) ? limit : Infinity;

    const now = Date.now();
    const chunkMs = chunkDays * 24 * 60 * 60 * 1000;

    // Go backwards in time in chunks
    for (let endTime = now; endTime > 0 && processed < maxToProcess; endTime -= chunkMs) {
      const startTime = Math.max(0, endTime - chunkMs);

      // For a 30-day window, 10k is usually plenty; keep it modest for performance.
      const results = await new Promise((resolve) => {
        api.history.search(
          { text: "", startTime, endTime, maxResults: 10000 },
          (r) => resolve(r || [])
        );
      });

      for (const item of results) {
        try {
          // Respect the processing limit if supplied
          processed += 1;
          if (processed > maxToProcess) break;

          const url = item.url;
          if (!url) continue;

          const host = new URL(url).hostname;
          const engine =
            isGoogleHost(host) ? "google" :
            isBingHost(host) ? "bing" :
            isDDGHost(host) ? "ddg" : "other";

          if (engine === "other") continue;
          if (!engines.includes(engine)) continue;

          const q = extractQueryParam(url);
          const candidate = candidateFromQuery(q);
          if (!candidate) continue;

          counts[candidate] = (counts[candidate] || 0) + 1;

          if (!examples[candidate]) examples[candidate] = [];
          if (examples[candidate].length < 3) examples[candidate].push(url);
        } catch {
          // ignore per-url parse errors
        }
      }

      // Small early exit: if we hit a chunk with zero results and we're going far back,
      // you can keep scanning anyway; leaving it out is safest.
    }

    return { counts, examples };
  }

  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.cmd === "scanHistory") {
      scanHistory(message.options)
        .then((result) => {
          api.storage.local.set(
            { emw_counts: result.counts, emw_examples: result.examples },
            () => sendResponse({ ok: true, result })
          );
        })
        .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));

      return true;
    }

    if (message?.cmd === "getResults") {
      api.storage.local.get(["emw_counts", "emw_examples"], (data) => {
        sendResponse({ ok: true, data });
      });
      return true;
    }

    return false;
  });

  api.runtime.onInstalled?.addListener?.(() => {
    // Populate initial cache by scanning recent history (limit work to 20k entries)
    scanHistory({ chunkDays: 90, limit: 20000 }).then((r) => {
      api.storage.local.set({ emw_counts: r.counts, emw_examples: r.examples });
    });
  });
})();
