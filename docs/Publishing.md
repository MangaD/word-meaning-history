Nice — congrats 🎉
If **everything is fixed**, here’s the **exact, no-nonsense checklist** to publish properly on **Firefox Add-ons (AMO)** and **Chrome Web Store**, given your current setup (dual manifests, build script, dark UI, history access).

I’ll keep this practical and linear.

---

# 0️⃣ Final sanity check (5 minutes, do this once)

Before publishing anywhere:

### Code

* ✅ `candidateFromQuery` matches **queries ending in `" meaning"`**
* ✅ Multi-word phrases work (`modus operandi meaning`)
* ✅ Scan finds expected volume of results
* ✅ Clear → Scan → Reload works as expected

### Permissions

If you are **not using** these yet, remove them now:

* ❌ `tabs`
* ❌ `alarms`

Both stores **scrutinize permissions**.
If you keep them, reviewers may ask *why*.

**Recommended permissions list:**

```json
"permissions": ["history", "storage"]
```

---

# 1️⃣ Build the release artifacts

From repo root:

```bash
npm run build:firefox
npm run build:chrome
```

You should now have:

```
dist/
├── firefox/
│   ├── manifest.json   (MV2)
│   ├── src/
│   └── icons/
└── chrome/
    ├── manifest.json   (MV3)
    ├── src/
    └── icons/
```

---

# 2️⃣ Prepare store assets (same for both stores)

You need **once**, reuse everywhere:

### Icons

You already have:

* ✅ 48×48 PNG
* ✅ 128×128 PNG

Optional but recommended:

* 96×96
* 512×512 (for Chrome listing)

---

### Screenshots (required)

Take **at least 2**:

1. **Popup – before scan**

   * Dark UI
   * Engine selector + Scan button
2. **Popup – after scan**

   * Word list + counts + examples

Optional (good):

* Export buttons visible
* Multi-word example shown

---

### Short description (store blurb)

You’ll paste this verbatim:

> Extracts all “<word> meaning” searches from your browser history.
> Supports Google, Bing, and DuckDuckGo.
> Local-only processing. Export results as CSV or JSON.

---

### Long description (use this)

(Stores love clarity + privacy emphasis)

> This extension scans your browser history to find searches that end in “meaning” (for example: “altruism meaning” or “modus operandi meaning”).
>
> It supports Google, Bing, and DuckDuckGo, stores results locally, and allows exporting the extracted words as CSV or JSON.
>
> All processing happens locally in your browser. No data is transmitted or collected.

---

### Privacy policy (yes, even for simple extensions)

Create **PRIVACY.md** (or paste into store field):

```
This extension processes browser history locally to extract search queries
that end in the word "meaning".

No data is transmitted, collected, or shared.
No analytics or tracking are used.
All extracted data is stored locally using browser extension storage
and can be cleared at any time by the user.
```

---

# 3️⃣ Publish to Firefox Add-ons (AMO)

### A) Zip the Firefox build

From `dist/firefox/`:

```bash
zip -r word-meaning-history-firefox.zip .
```

### B) Go to

👉 [https://addons.mozilla.org/developers/](https://addons.mozilla.org/developers/)

### C) Upload

* Choose **“On this site”**
* Upload the ZIP
* Select:

  * Category: **Productivity** or **Developer Tools**
  * Type: **Extension**

### D) Answer reviewer questions

When asked:

* **Why history permission?**
  → “Required to scan search URLs in browsing history.”
* **Data collection?**
  → “None.”

### E) Review time

* Usually **minutes to a few hours** for simple extensions
* If rejected, it’s almost always:

  * unnecessary permissions
  * unclear privacy wording

---

# 4️⃣ Publish to Chrome Web Store

### A) Zip the Chrome build

From `dist/chrome/`:

```bash
zip -r word-meaning-history-chrome.zip .
```

### B) Go to

👉 [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)

### C) One-time fee

* **$5 USD** (only once per developer account)

### D) Upload ZIP

* Category: **Productivity**
* Visibility: Public (or Unlisted first)

### E) Permissions justification

Chrome is strict. For `history`, explain:

> This permission is required to read search URLs from browser history in order to extract queries ending in the word “meaning”.

---

# 5️⃣ Versioning & future updates

You’re good with:

```json
"version": "0.1.0"
```

Next updates:

* Bugfix → `0.1.1`
* UI improvement → `0.2.0`
* Feature (date filtering, stats) → `0.3.0`

Keep versions **identical** across both manifests.

---

# 6️⃣ GitHub release (recommended)

Tag a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Create a GitHub Release:

* Title: `v0.1.0 – Initial release`
* Attach:

  * Firefox ZIP
  * Chrome ZIP
* Mention:

  * Multi-word support
  * Local-only privacy
  * Firefox + Chrome support

---

# 7️⃣ Portfolio update (you should do this)

On your site / JSON:

* Mark as **Published**
* Add store links once approved
* Mention:

  * Browser APIs
  * Privacy-first design
  * Dual MV2/MV3 strategy

This is *very* attractive for reviewers/employers.

---

## TL;DR checklist

✅ Build both targets
✅ Remove unused permissions
✅ Prepare screenshots + privacy text
✅ Zip & upload Firefox build
✅ Zip & upload Chrome build
✅ Create GitHub release

If you want, next I can:

* write **exact AMO answers** (copy/paste)
* review your **Chrome Web Store listing text**
* or help you **deprecate MV2 cleanly later** when Firefox fully enables MV3

Just say the word.
