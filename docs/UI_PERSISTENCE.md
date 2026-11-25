# UI persistence — fork surfaces

Scope: the fork's own UI (`docs/UI-UX.md`); upstream screens are upstream's. From the code at 7.4.62
(2026-11-25). Store: `browser.storage.local`, one key per value `forkUi:<name>`, through
`src/common/forkUiState.js` (`setForkUi` debounced 250 ms, flushed on `pagehide` / `visibilitychange`;
`persistScrollRef` for scroll containers; `savedWindowBounds` / `trackWindowBounds` for windows). No
listener in the extension reacts to these keys. A new fork element is added here in the same change.

| Surface | Element | What is kept | Key | Status |
|---|---|---|---|---|
| Restore debug window (`debug/`, `background/restoreDebug.js`) | Window | Position, size, maximized/normal (normal bounds kept while maximized; never restored minimized); pulled back onto the visible work area if it opens off-screen | `forkUi:restoreDebug.window` | Persisted |
| Restore debug window | Event log (`section.eventLog`) | Scroll position (waits for the log to fill) | `forkUi:restoreDebug.eventLog` | Persisted |
| Restore debug window | Summary tiles, explainers, buttons | Nothing adjustable | — | n/a |
| Restore debug window | "Copied" / download error | — | — | Exempt: toast |
| Popup → Open windows panel (`WindowsArea.js`) | Window rows, Sweep / Stop | Nothing adjustable; not collapsible | — | n/a |
| Popup → Open windows panel | "Re-capture thumbnails on sweep" | Saved as a setting | `ifForceRefreshThumbnailsOnSweep` | Persisted (setting) |
| Popup → Header sweep button | Button | — | — | n/a |
| Popup → Merge sessions modal | Session list (`.sessionsSelector`, scrolls at 220 px) | Scroll position | `forkUi:mergeSessions.list` | Persisted |
| Popup → Merge sessions modal | Checked sessions, name, "remove duplicates" | — | — | Draft data entry, not kept |
| Popup → Session details | Window reorder buttons | Order is session data | — | n/a |
| Options → Import | Import log (`<pre>`, scrolls at 260 px) | Scroll position | `forkUi:options.importLog` | Persisted |
| Options → Open | Fork settings | Saved as settings | settings keys | Persisted (settings) |
| Placeholder pages (`replaced/`, incognito placeholder) | Page | Nothing adjustable | — | n/a |
| OS notifications, toolbar badge | — | — | — | Exempt: toast |

Verification: production build only (`npx webpack --config webpack.config.dist.js`); not run in a browser.
