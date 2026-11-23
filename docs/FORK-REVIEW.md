# Fork Review — Tab Session Manager (history only)

> **History only — not a status source.** Review of 2026-08-07 at commit `113b272` (v7.4.0), with the
> QA-01 evidence and the original feature write-ups. Values such as the 500 px thumbnails, the 2,000-event
> log and the automatic post-restore sweep describe those versions. Current facts: [`../AGENTS.md`](../AGENTS.md),
> [`STATUS.md`](STATUS.md), [`BACKLOG.md`](BACKLOG.md), [`ARCHITECTURE.md`](ARCHITECTURE.md),
> [`UI-UX.md`](UI-UX.md), [`CHANGELOG.md`](CHANGELOG.md). Section numbers are kept because other docs cite them.

---

## 1. What this project is

A cross-browser WebExtension (Chrome MV3 + Firefox MV3) that saves and restores browser
window/tab state, with auto-save, tagging, search, undo/redo, backup-to-disk, and optional
Google Drive sync.

| Area | Stack |
| --- | --- |
| UI | React 16 + react-router 5, SCSS, `@svgr/webpack` |
| Build | webpack 5, Babel, `zip-webpack-plugin` → `dist/*.zip` |
| Storage | IndexedDB (`sessions` object store), `storage.local` for settings, `storage.session` for ephemeral state |
| Sync | Google Drive `appDataFolder` via OAuth2 (`identity.launchWebAuthFlow`) |
| i18n | 34 locales via Crowdin |
| License | MPL-2.0 |

Roughly 8.3k lines of JS/JSX across `src/background`, `src/popup`, `src/options`,
`src/settings`, `src/common`, `src/offscreen`, `src/replaced`.

### Architecture at a glance

- `background/background.js` — service worker; single `onMessage` switch is the app's whole RPC surface.
  Every listener calls a lazy `init()` guard because MV3 service workers restart constantly.
- `background/sessions.js` — thin hand-rolled IndexedDB wrapper (put/get/getAll/delete/search + a
  cursor-streaming `getAllWithStream` used to page large session lists into the popup).
- `background/autoSave.js` — a `temp`-tagged session is continuously rewritten (debounced 1.5 s) so
  that window-close / browser-exit can be reconstructed from it.
- `background/track.js` — "tracking" sessions keep a saved session in sync with a live window.
- `background/export.js` + `offscreen/` — Chrome MV3 service workers have no `URL.createObjectURL`,
  so exports round-trip through an offscreen document.
- `replaced/` — the lazy-loading placeholder page; tab URL/title/favicon are carried in query params.

---

## 2. Build & tooling status (as of 2026-08-27)

| Check | Result |
| --- | --- |
| `npm ci` | ✅ 634 packages, exit 0 (not re-run 2026-08-27 — `node_modules/` already present) |
| Dev build (`webpack.config.dev.js`) | ✅ v7.4.25: 0 errors, 27 warnings (26 upstream `moment` dynamic-locale requires plus the debug stylesheet's Sass-loader deprecation) — produces `dev/chrome` + `dev/firefox` |
| Real-browser load | ✅ Chrome 152.0.7977.64, `dev/chrome` loaded unpacked, ID `pheckpgfalekjmbbodbggfohpghjceog`, Allow in Incognito on. **`--load-extension` is ignored by Chrome 152 stable** — use `chrome://extensions` → Load unpacked (see QA-01, section 5) |
| `npm run build` (dist zips) | not run since the toolchain was restored — not needed for local unpacked use (see section 4) |
| `npm audit` | ⚠️ 5 vulnerabilities (1 moderate, 4 high) — dev-only transitive deps in the webpack toolchain, not yet triaged, nothing shipped/reachable at runtime |
| `npm run format:check` | ❌ 7 files unformatted, all pre-existing upstream (see B-07, retired) |
| Tests | ❌ none exist — no test runner, no test files |
| CI | ❌ none — `.github/` has only FUNDING + issue templates |
| Lint | ❌ none — Prettier only, no ESLint |

Dev bundle sizes: popup 2.89 MiB, options 2.01 MiB, background 1.68 MiB, replaced 48 KiB,
offscreen 43 KiB. Size-only, no code splitting; not a blocker for local unpacked use.

**Note:** `src/credentials.js` is gitignored and imported by `background/cloudAuth.js`; the build
cannot resolve without it. A placeholder (empty `clientId`/`clientSecret`) is in place. If the
working tree is ever reset from a fresh clone, recreate it before building — **Drive sync will not
work with the placeholder** (see S-01, retired — sync is not used in this fork).

---

## 3. Findings

> Status on 2026-11-24: B-02, B-03, B-04, B-06 and B-09 were fixed in v7.4.1. The others were retired in section 4.

### Security / fork-specific

**S-01 — You must register your own Google OAuth client. (blocking for sync)**
`src/credentials.js` is gitignored and holds `clientId` / `clientSecret`. It is imported by
`background/cloudAuth.js` and **bundled into the shipped extension**, so the "secret" is not secret —
that is inherent to the installed-app OAuth flow and is fine, but it means the fork cannot reuse
upstream's client. `identity.getRedirectURL()` is derived from the extension ID, so a fork with a
different ID needs its own Google Cloud project, its own client, and its own registered redirect URI.

**S-02 — `credentials.js` is packaged into `dist/copiedSource-*.zip`. (verified)**
`webpack.config.dist.js` copies the whole `src` tree into the source zip (this zip exists for
Mozilla's add-on source-review requirement). Confirmed by inspecting the built artifact: the entry
`credentials.js` is present. Upstream publishes that zip. If you ever publish or share yours, your
client secret goes with it. Add an ignore for `**/credentials.js` in that `CopyWebpackPlugin`
pattern, or never distribute the source zip.

**S-03 — Permission surface is broad but justified.**
`tabs` (full URL + title of every tab), `downloads`, `unlimitedStorage`, `identity`, `alarms`,
`offscreen`. Google host permission and `tabGroups` are correctly optional and requested on demand
(`options/components/SignInButton.js:13`, `common/tabGroups.js:37`). Nothing exfiltrates data except
the user-initiated Drive sync. No `content_scripts`, no remote code. Chrome and Firefox manifests
diverge: `manifest-ff.json` additionally requests `cookies` and non-optional `tabGroups`.

**S-04 — `replaced/replaced.js` HTML-escapes injected values.** `favIconUrl` is escaped before
`insertAdjacentHTML`, and the theme value is whitelisted. Title/URL go through `innerText`/`.value`.
No injection found. Worth keeping in mind if you extend that page — its inputs come from a URL the
extension itself constructs, but they originate from arbitrary page titles.

### Correctness bugs (all pre-existing upstream)

**B-02 — `background/sessions.js:45` references an undefined `Session`.**
`DBUpdate()` calls `Session.getAll()` / `Session.deleteAll()` / `Session.put()` — the module is
`Sessions`. It would throw `ReferenceError` immediately. Currently harmless: the only call site is
commented out (`background/updateOldSessions.js:16`). It is dead code — delete it or fix it before
anyone re-enables it.

**B-03 — `background/sessions.js:109` calls an undeclared `reject`.**
Inside `deleteAll()` the promise executor is `new Promise(resolve => …)` but the `onerror` handler
calls `reject(e)`. If deleting the database ever fails, the error handler itself throws
`ReferenceError` and the promise hangs forever — so `deleteAllSessions()` never resolves and the UI
gets no feedback.

**B-04 — `popup/actions/controlSessions.js:232` — `session?.tabGroups.some(...)`.**
The optional chain guards `session`, not `tabGroups`. Adding the current tab to a session that has no
`tabGroups` key, while that tab belongs to a tab group and `saveTabGroupsV2` is on, throws
`TypeError`. Should be `session?.tabGroups?.some(...)`.

**B-05 — `background/cloudAPIs.js:32` — `file.appProperties.tag = …` unguarded.**
The read side uses `file.appProperties?.tag?.split(",")`, but the assignment target is not optional.
Any Drive file in the app folder without `appProperties` (hand-uploaded, or written by an older
version) makes `listFiles()` throw, which aborts the entire sync.

**B-06 — `background/export.js:20-27` can emit an empty export file.**
`chunkSize = Math.ceil(totalStringSize / 32MB)` is computed from byte size but used to slice the
*array*. One session larger than 32 MB gives `chunkSize = 2` while `sessions.length = 1`, so the
first chunk slices to `[]` and the user gets an extra `… .json` containing `[]` alongside the real
export.

### Code quality / maintainability

**B-07 — `npm run format:check` fails on a clean checkout.**
Unformatted: `src/background/autoSave.js`, `src/options/components/OptionsPage.js`,
`src/popup/components/PopupPage.js`, `src/popup/components/SessionItem.js`,
`src/replaced/replaced.js`, `src/settings/defaultSettings.js`, `BACKERS.md`. You cannot use
formatting as a gate until this is reset. Note `.prettierignore` excludes `_locales`, so a fix is
safe — but running `npm run format` now creates a large diff that will conflict with every upstream
merge. Decide this deliberately (see Recommendations).

**B-08 — No tests, no CI, no linter.** For an extension whose core promise is "don't lose my tabs",
the session-shape migration logic (`background/updateOldSessions.js`,
`options/components/ImportSessionsComponent.js` — which parses TSM, Session Buddy, Session Manager
and Firefox `.jsonlz4` formats) is pure, dependency-free, and the single highest-value place to add
unit tests.

**B-09 — Inconsistent `switch` scoping in `background/background.js:71-190`.**
Some cases are brace-scoped, some are not, so `name`, `property`, `afterSession`, `beforeSession`,
`sessions`, `currentSession` leak into the shared switch block scope. It compiles today, but adding
one more bare `const beforeSession` to an unbraced case is an instant `SyntaxError`. Brace every case.

**B-10 — Engine mismatch.** `package.json` pins `node: 24.13.0` / `npm: 11.7.0`; this machine has
Node 24.19.0 / npm 11.17.0. Not enforced (no `engine-strict`), and the build passes — but the pin is
exact rather than a range, so it will keep drifting.

**B-11 — Comments are predominantly Japanese.** Perfectly legitimate upstream, but if you plan to
diverge meaningfully you will be maintaining code you can't skim. Don't mass-translate (merge
conflicts); translate opportunistically in files you actually touch.

---

## 4. Scope decision — local debug use only

**Decided 2026-08-07:** this fork is for personal, local use as an unpacked ("Load unpacked")
extension. It will not be published to any store, not submitted to Mozilla, not merged back
upstream, and Google Drive sync will not be used.

That retires most of section 3. The rationale is recorded here so it isn't re-litigated:

| Retired | Why it no longer applies |
| --- | --- |
| S-01 (own OAuth client) | Sync unused. The empty placeholder `src/credentials.js` satisfies the import; the build works and the sign-in button simply fails. |
| S-02 (`credentials.js` in source zip) | That zip only exists for Mozilla's source-review requirement. `npm run build` is never run. |
| B-05 (`appProperties` sync crash) | Sync-only code path. |
| Fork strategy / extension ID / `gecko.id` | Nothing to publish, nothing to merge. No `upstream` remote needed. |
| B-07 Prettier drift, B-08 tests/CI, B-10 engines, B-11 comment language | Process hygiene for a multi-contributor project. |
| `npm audit` (5 advisories) | All dev-only transitive deps inside the webpack toolchain. Not shipped, not reachable at runtime. |

### Workflow for this fork

```bash
npm run watch-dev
```

Then `chrome://extensions` → Developer Mode → Load unpacked → `dev/chrome`.
Verified working: `dev/chrome` builds and contains `manifest.json`, `background`, `popup`,
`options`, `replaced`, `offscreen`, `icons`, `_locales`. The `dist` zips are not needed.

### Local-only risks that replace the published-extension ones

**L-01 — Extension ID path risk (resolved in v7.4.1).** Chrome would otherwise derive an unpacked
extension ID from the absolute directory path, making saved IndexedDB sessions unreachable after a
move or rename. `src/manifest.json` now has a pinned `key`, so the current Chrome ID remains
`pheckpgfalekjmbbodbggfohpghjceog`; do not remove or replace that key.

**L-02 — Backup export is off by default.** `ifBackup` defaults to `false`
(`src/settings/defaultSettings.js:268`). An extension being actively edited is precisely the one
that loses its own database. If this holds real sessions, enable backup in Options.

**L-03 — Tab-group session guard (resolved in v7.4.1).** The former conditional
`session.tabGroups` crash was fixed with `session?.tabGroups?.some(...)`; no local action remains.

---

## 5. Backlog

Moved to [`BACKLOG.md`](BACKLOG.md) on 2026-11-24. The QA-01 evidence stays here.

> **⚠ Correction (2026-08-27, later the same day).** The QA-01 pass below verified restore
> *routing*, *batching* and *discard mechanics* — it did **not** check that restored tabs kept their
> content, and they did not. Every discarded private tab came back permanently blank
> (`url: ""`, `title: ""`). See BLANK-01 in the review log; fixed in v7.4.22. Read the table below
> as "these specific properties held", not "the restore was correct".

### QA-01 result — verified in real Chrome 152 on 2026-08-27

Run against Chrome **152.0.7977.64** on Windows 10, extension loaded unpacked from `dev/chrome`
at **v7.4.18**, stable ID `pheckpgfalekjmbbodbggfohpghjceog`, **Allow in Incognito enabled**
(`chrome.extension.isAllowedIncognitoAccess() === true`). Settings were stock apart from
`ifSavePrivateWindow` turned on so private windows could be saved at all: `ifLazyLoading` on,
`incognitoTabCreateBatchSize` **5** (untouched default), `tabCreateBatchSize` 20,
`ifPreloadAfterRestore` on. Both restores were requested with property `openInCurrentWindow` —
the routing case that used to leak tabs into the popup's own window.

| Check | Scenario A — private-only | Scenario B — mixed normal + private |
| --- | --- | --- |
| Saved session | 1 private window, 12 tabs | 2 windows: normal 3 tabs + private 8 tabs |
| Requested → effective routing | `openInCurrentWindow` → **`openInNewWindow`** | `openInCurrentWindow` → **`openInNewWindow`** |
| Debug window before private tabs | ✅ `debug-panel-opened` at event 4, first `tab-created` at event 13 | ✅ `debug-panel-opened` at event 3, first `tab-created` at event 10 |
| Windows created | 1 new private window | 2 new windows (1 normal, 1 private) |
| Popup's current regular window | **untouched** — 4 tabs before and after, same tabs | **untouched** — 4 tabs before and after, same tabs |
| Private batch size | configured 5 / effective **5**; batches 5 + 5 + 2 | configured 5 / effective **5**; batches 5 + 3 (normal window used 20) |
| Tabs created | 12/12, **0 failures** | 11/11, **0 failures** |
| Discards | 11 attempted, **11 succeeded**, 0 retries, 0 errors | 7 attempted, **7 succeeded**, 0 retries, 0 errors |
| Browser-side discard truth | private window: 12 tabs, **11 discarded**, 1 active | private window: 8 tabs, **7 discarded**, 1 active |
| Error events in trace | **0** | **0** |
| Automatic downloads | **0 files** | **0 files** |
| Restore duration | 1.6 s | 19.5 s |

- **The one non-discarded tab in each private window is the active tab.** Chrome refuses to
  discard the active tab, and `openTab()` only sets `shouldDiscardAfterCreate` for non-active
  tabs. 11/12 and 7/8 are the correct, expected maxima — not failures.
- **Tabs stay discarded.** A second independent run restored the same 12-tab private session and
  sampled the window at t+5 s, +15 s, +30 s, +60 s, +90 s and +120 s: **11 discarded at every
  sample**, 0 tabs loading. Sessions also survived a full Chrome restart, re-confirming the
  pinned-`key` IndexedDB continuity (L-01).
- **Live debug panel verified in the DOM**, not just in background state: phase `FINISHED`,
  identity line `Extension 7.4.18 | ID pheckpgfalekjmbbodbggfohpghjceog | Requested:
  openInCurrentWindow | Effective: openInNewWindow`, summary tiles `Saved tabs=12`,
  `Windows created=1`, `Batch size=5`, `Batches=3/3`, `Tabs created=12/12`, `Tab failures=0`,
  `Discarded=11`, `Discard errors=0`, 61 live event lines, and the three buttons
  `Copy complete debug log` / `Download log` / `Close`.
- **No download flood.** `chrome.downloads.search({})` returned **0** items after both restores,
  confirming v7.4.16/v7.4.17 removed the automatic trace downloads.
- **Known behaviour, not a defect:** the post-restore preload sweep did not advance during either
  run (240 s wait each). The sweep pauses while the window it is sweeping has focus (F-04), and the
  freshly restored private window holds focus. Tabs therefore simply stayed discarded, which is the
  desired end state; the sweep resumes once focus moves elsewhere.

**Environment note for future runs:** Chrome 152 stable **ignores the `--load-extension` command
line switch** (`extension_service.cc`: `--load-extension is not allowed in Google Chrome,
ignoring.`). `--enable-unsafe-extension-debugging`, `--disable-features=DisableLoadExtensionCommandLineSwitch`
and `--remote-debugging-pipe` do not lift it. The extension must be loaded through the real
`chrome://extensions` → **Load unpacked** flow.

---

## 6. Fork features (v7.4.2) — mass-restore performance & thumbnails

> As built at the versions named. Current behaviour: [`ARCHITECTURE.md`](ARCHITECTURE.md).

Motivated by restoring sessions with thousands of tabs freezing the machine.

**F-01 — Batched tab creation** (`src/background/open.js`). Upstream fired every
`tabs.create()` in an unthrottled loop and opened multi-window sessions in parallel — thousands of
near-simultaneous create calls freeze the browser regardless of lazy loading. Now: tab creation
awaits in batches of 20 (`TAB_CREATE_BATCH_SIZE`), `createTabs` is awaited at all call sites, and
subsequent windows open sequentially. TST mode (`ifSupportTst`) keeps its original one-by-one path.

**F-02 — Page thumbnail capture** (`src/background/thumbnails.js`, new). While browsing, the
active tab is captured (`tabs.captureVisibleTab`, jpeg q70) on `tabs.onUpdated`(complete) and
`tabs.onActivated`, throttled to once per 10 s per URL, downscaled to 500 px wide (OffscreenCanvas,
jpeg q0.6, ~15–40 KB each), and stored in a dedicated IndexedDB `thumbnails` DB keyed by URL.
LRU-pruned above 3000 entries. Gated by new setting `ifCaptureThumbnails` (default on, Options →
Open, nested under lazy loading). Required adding `host_permissions: ["<all_urls>"]` to both
manifests — fine for a local extension.

**F-03 — Thumbnail shown on placeholder pages** (`src/replaced/`). The lazy-loading placeholder
looks up the thumbnail for its target URL directly in IndexedDB (same extension origin as the
background) and shows it under the title/URL. Applies to both the `redirect` (not-yet-loaded) and
`open_faild` states.

**F-04 — Preload & suspend sweep (v7.4.6)** (`src/background/preloadSweep.js`, new). After a
session restore (setting `ifPreloadAfterRestore`, default on, nested under lazy loading), each
restored window is swept in parallel, one tab at a time per window: activate the next placeholder →
explicit `replacePage(windowId)` redirect (the passive `onActivated` path only serves the focused
window) → wait for load (30 s timeout) → capture via the F-02 pipeline → `tabs.discard()` once the
next tab is activated (Chrome refuses to discard the active tab, so discard always trails by one).
Pauses while the swept window is focused (3 s recheck); toolbar badge shows the remaining count;
original active tab of each window is re-activated at the end. End state per tab: real URL, real
title, stored thumbnail, natively suspended. Message handlers `startPreloadSweep` (all normal
windows if no ids passed) / `stopPreloadSweep` power the v7.4.7 popup-header manual control.

**F-05 — Incognito restore (v7.4.8, v7.4.16)** (`src/background/open.js`, `src/background/preloadSweep.js`).
Chrome refuses to load extension pages in incognito windows under `"incognito": "spanning"`, so the
lazy-loading placeholder was skipped there (upstream `open.js`) and every restored incognito tab
loaded its real URL immediately — F-01/F-04 did nothing and a large incognito session loaded in full.
Now, when the placeholder is unavailable, each non-active tab is created with its real URL and
`tabs.discard()`ed straight away (one retry after 500 ms, since a freshly created tab is briefly
undiscardable), which reaches the same unloaded end state by a different route. The sweep's target
predicate widened from "is a redirect placeholder" to "is a redirect placeholder **or** is a
discarded incognito tab", so incognito windows now get the same load → capture → re-suspend pass and
recover their real titles. Discarded tabs in *normal* windows are deliberately excluded — those were
suspended by the user or by Chrome's Memory Saver and are not ours to reload.

v7.4.16 uses the `Tab` returned directly by Chrome's `tabs.discard()` call to determine success.
The former extra `tabs.get()` verification can reject for freshly discarded private tabs despite a
successful discard, causing an unnecessary retry and falsely reporting failure.

**Verified in Chrome 152 on 2026-08-27 (QA-01):** every non-active private tab was discarded on the
first attempt — 11/11 and 7/7 discard calls succeeded with **zero retries and zero errors**,
confirming the v7.4.16 change removed the false-failure path. Tabs remained discarded across
samples out to t+120 s.

**F-06 — Incognito restore flooding (v7.4.9, v7.4.15)** (`src/background/open.js`). F-05's
`discardAfterCreate()` was fire-and-forget, so `createTabs()`'s batch barrier
(`await Promise.all(openedTabs)`) only waited for `tabs.create` to return, not for the discard —
restoring a large private session created every tab with its real URL and let hundreds of loads
start before any discard landed. Both call sites in `openTab()` now `await discardAfterCreate()`,
which makes the existing batch boundary meaningful: at most one batch's worth of tabs is briefly
loading at a time. New setting `incognitoTabCreateBatchSize` (Options → Open, default 5, min 1)
lets private-window batching be tuned independently of `tabCreateBatchSize`; `createTabs()` picks
between the two via `isEnabledPlaceholder(currentWindow)`.

v7.4.15 makes each batch an isolated promise list: it waits for and clears one batch before
starting the next, including the final partial batch. It also treats a saved session containing
any private window as an all-new-window restore. This prevents a leading normal saved window in a
mixed session from being restored into the popup's regular window before a later private window is
opened.

**Verified in Chrome 152 on 2026-08-27 (QA-01):** both a private-only and a mixed session were
restored with the popup requesting `openInCurrentWindow`; the effective routing was
`openInNewWindow` in both cases, and the popup's own regular window kept exactly its original four
tabs. Batches ran 5 + 5 + 2 (12 private tabs) and 5 + 3 (8 private tabs) with the private window
using the dedicated size 5 while the mixed session's normal window used 20.

**F-07 — Live incognito restore debug (v7.4.17)** (`src/background/restoreDebug.js`,
`src/debug/`). Every restore containing private tabs automatically opens one normal extension popup
window before tab creation. It provides live, URL-free events and summary counts for effective
routing, created windows, configured and completed batches, created/failed tabs, discard outcomes,
and restore errors. It retains at most 2,000 events and updates the visible window while restoring.
Logs are copied or downloaded only by an explicit button click—there are no automatic downloads.
The debug page is excluded from saved sessions so its own window cannot pollute auto-save data.

**Verified in Chrome 152 on 2026-08-27 (QA-01):** the debug window opened before the first private
tab was created in both scenarios (event `debug-panel-opened` preceded the first `tab-created`), it
rendered live counts in the DOM (`Batch size=5`, `Batches=3/3`, `Tabs created=12/12`,
`Tab failures=0`, `Discarded=11`, `Discard errors=0`, 61 event lines) and exposed the
`Copy complete debug log` / `Download log` / `Close` buttons. `chrome.downloads.search({})` returned
**0** items after both restores, confirming no automatic diagnostic downloads.

**Known limits, by design:**
- Only pages actually *viewed* get a thumbnail — background tabs can't be captured
  (`captureVisibleTab` is active-tab-only; that's a browser restriction, same for all suspender
  extensions). Coverage accumulates as you browse.
- Chrome's own Memory-Saver-discarded tabs can't be given a placeholder image — the tab keeps its
  real URL and Chrome controls the discard; placeholders only exist for tabs the extension opens.
- Thumbnails match on exact URL.
- ~~Incognito tabs briefly show their URL instead of the saved title, until the sweep loads them
  once.~~ **No longer true since v7.4.22** — waiting for the navigation to register before
  discarding preserves both the URL and the title, so discarded private tabs show their real title
  immediately without being loaded.
- Incognito thumbnails are still gated by `ifSavePrivateWindow` (default off), so by default an
  incognito sweep loads and re-suspends but stores nothing. That is the v7.4.3 privacy decision.
- Re-running a **manual** sweep re-processes incognito tabs, because a swept tab returns to the
  "discarded incognito" state that defines the target set. Harmless but not free. The automatic
  post-restore sweep is unaffected.
- All of this requires "Allow in Incognito" to be enabled for the extension in `chrome://extensions`.
  Without it the extension cannot see incognito windows at all and nothing here applies.
- The restored private window keeps focus, and the post-restore sweep pauses while its target window
  is focused (F-04). In practice the sweep therefore does not start until you switch away — observed
  over 240 s in the 2026-08-27 QA run. Tabs stay discarded in the meantime, which is the intended end
  state, so this is a timing characteristic rather than a fault.

---

## 7. Review log

Moved to [`CHANGELOG.md`](CHANGELOG.md) on 2026-11-24.
