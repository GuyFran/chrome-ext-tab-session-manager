# Architecture — Tab Session Manager fork

Current behaviour, read from the code at 7.4.60 on 2026-11-24. Paths are under `src/`.

## Stack

React 16, react-router 5, SCSS, webpack 5, Babel. Chrome MV3 service worker; Firefox MV3 background
script. 34 locales. About 10.5k lines of JS.

| Storage | Holds |
| --- | --- |
| IndexedDB `sessions` | Saved sessions |
| IndexedDB `thumbnails` | JPEG thumbnails by URL, at most 3000, oldest pruned 100 at a time |
| `storage.local` | Settings |
| `storage.session` | Debug trace (`restoreDebugState`), deferred sweeps (`deferredSweepWindowIds`) |

## Modules

| Path | Role |
| --- | --- |
| `background/background.js` | Service worker; one `onMessage` switch (37 actions) is the RPC surface; listeners call a lazy `init()` |
| `background/open.js` | Restore: routing, batched tab creation, discard after create |
| `background/preloadSweep.js` | Manual load → capture → hibernate sweep |
| `background/thumbnails.js` | Capture queue, size ladder, thumbnail store |
| `background/incognitoPlaceholder.js` | Self-contained `data:` placeholder pages |
| `background/restoreDebug.js`, `debug/` | URL-free trace and debug window |
| `background/notify.js` | OS notifications for restore and sweep |
| `common/mergeSessions.js`, `common/editSessions.js` | Session merge; window reorder (`moveWindow`) |
| `options/components/ImportSessionsComponent.js` | Import parsing and per-format diagnostics |
| `background/autoSave.js`, `track.js`, `sessions.js`, `export.js`, `cloud*.js` | Upstream: auto-save, tracking, DB, export, Drive sync (unused) |
| `replaced/` | Lazy-loading placeholder for normal windows; shows the thumbnail |
| `offscreen/` | Chrome export through an offscreen document |

## Restore (`open.js`)

1. A session containing any private window is routed entirely to new windows, so it cannot leak into
   the popup's regular window.
2. A restore with private tabs opens the debug window first.
3. Tabs are created in isolated batches: `tabCreateBatchSize` (20) in normal windows,
   `incognitoTabCreateBatchSize` (5) where the extension placeholder is unavailable. Windows open
   sequentially. Tree Style Tab mode keeps its one-by-one path.
4. Normal windows use the `replaced/` placeholder when lazy loading is on.
5. Non-active private tabs with a cached thumbnail go straight to a `data:` placeholder. Others are
   created live, then discarded, but only after the URL commits (polled every 50 ms, 3 s timeout). On
   timeout the tab is re-navigated, and it is not discarded rather than risk blanking it. Discard
   retries once after 500 ms.
6. A notification reports the result if `ifNotifyOnRestoreAndSweep` is on.

## Sweep (`preloadSweep.js`)

Manual only since 7.4.41 (popup controls). `ifPreloadAfterRestore` is inert (backlog OPT-01).

- **Targets:** redirect placeholders, discarded incognito tabs, incognito `data:` placeholders. Discarded
  tabs in normal windows are excluded.
- **Skip:** tabs with a cached thumbnail are not reloaded unless `ifForceRefreshThumbnailsOnSweep` is on.
  `sweepTargetUrl()` reads a placeholder's real URL from its `#tsm=` fragment.
- **Repair:** a placeholder with no thumbnail is navigated to its real URL, captured and rebuilt. If
  capture fails it stays a target for the next sweep.
- **Scale:** one snapshot of target ids per pass, `tabs.get` per tab, at most 3 passes. At most
  `preloadSweepMaxParallelWindows` (2) windows run; others queue.
- **Hidden windows:** renderability is polled up to 8 s. Hidden incognito windows are deferred and
  resume on `windows.onFocusChanged`.
- **Per-tab load timeout:** 30 s.
- **Finish:** totals across overlapping runs are posted as one notification when no sweep is active.

## Thumbnails (`thumbnails.js`)

- Captured from the active tab, at most once per 10 s per URL. Calls go through a queue spaced 600 ms
  (Chrome allows 2 per second), each with a 5 s timeout.
- `encodeToFit()` walks a width/quality ladder from 1600 px/q0.6 to 320 px/q0.35 and keeps the first JPEG
  at or under 36,000 bytes. Older oversized thumbnails are re-encoded on first use.
- Passive capture of incognito tabs requires `ifSavePrivateWindow` (default off). Sweep captures do not.

## Incognito placeholders (`incognitoPlaceholder.js`)

Extension pages cannot render in incognito, so a tab hibernates on a `data:text/html` page holding the
thumbnail, with the real URL in the `#tsm=` fragment. Session saves map placeholders back to real URLs.
Chrome blanks navigation URLs over about 63 KB in its session file, so `buildIncognitoPlaceholder()`
measures the URL as Chrome stores it and keeps it under 60,000 bytes by dropping the favicon, then the
thumbnail, then shortening the title. The real URL is never dropped.

## Fork settings (`settings/defaultSettings.js`)

| Setting | Default | Effect |
| --- | --- | --- |
| `ifCaptureThumbnails` | on | Capture thumbnails while browsing |
| `ifPreloadAfterRestore` | on | **Inert** |
| `ifForceRefreshThumbnailsOnSweep` | off | Sweep reloads every tab |
| `tabCreateBatchSize` | 20 | Normal restore batch |
| `incognitoTabCreateBatchSize` | 5 | Private restore batch |
| `preloadSweepMaxParallelWindows` | 2 | Concurrent swept windows |
| `ifNotifyOnRestoreAndSweep` | on | OS notifications |

## Permissions

Both manifests: `storage`, `unlimitedStorage`, `tabs`, `downloads`, `identity`, `alarms`, `notifications`,
host `<all_urls>` (added by the fork for capture). Chrome adds `offscreen`, with optional `tabGroups` and
Google API host. Firefox adds `cookies` and non-optional `tabGroups`, with the Google API optional.
