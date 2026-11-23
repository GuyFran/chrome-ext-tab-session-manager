# UI / UX — fork surfaces

Read from the code at 7.4.60 on 2026-11-24. Upstream screens are not described here.

| Surface | Where | Behaviour | Code |
| --- | --- | --- | --- |
| **Open windows panel** | Popup sidebar, above the session list | Heading with count, 🐞 debug button, "Sweep all", "Re-capture thumbnails on sweep" toggle, one row per window with Sweep/Stop and a "queued" tag | `popup/components/WindowsArea.js` |
| **Header sweep button** | Popup header | Starts a sweep of all windows, or stops the running sweep. Disabled look when lazy loading is off. Per-window sweeps are in the Open windows panel | `Header.js` |
| **Merge sessions** | Session menu → modal | Pick sessions, name the result, optionally remove duplicate tabs; creates a new session | `MergeSessionsModalContent.js`, `SessionMenuItems.js` |
| **Window reorder** | Session details, per window | Up/down buttons; the order is honoured on restore | `DetailsContainer.js` |
| **Normal placeholder** | Lazy-loaded tab | Title, URL and stored thumbnail | `replaced/` |
| **Incognito placeholder** | Hibernated private tab | Near-full-width thumbnail. Loads manually: Open page button, click the image, or Enter. No auto-reload on activation | `background/incognitoPlaceholder.js` |
| **Restore debug window** | Separate normal window (860×760), opens on private restores or from 🐞 | Live URL-free events and summary tiles (routing, batches, tabs, discards, groups, thumbnails, placeholder size). Buttons: Copy complete debug log, Export JSON, Clear, Close. Keeps 8,000 events; no automatic downloads; excluded from saved sessions | `debug/RestoreDebugPage.js` |
| **Import log** | Options → import | Persistent per-file trace with Copy logs / Clear; failures read "Read failed — reason" per format | `ImportSessionsComponent.js` |
| **Import formats** | Options → import | TSM, Session Buddy, Session Buddy v3 (collections), Firefox `.jsonlz4` / `.baklz4`, `.session` | `ImportSessionsComponent.js` |
| **Options → Open** | Options page | Fork settings listed in `ARCHITECTURE.md`; the "preload after restore" entry is inert (OPT-01) | `settings/defaultSettings.js` |
| **OS notifications** | System | Session restored / restore failed; Sweep finished / stopped / Nothing to sweep | `background/notify.js` |
| **Toolbar badge** | Extension icon | Remaining tab count during a sweep | `preloadSweep.js` |

## Known UX gaps

- Fork strings are English only (I18N-01).
- The debug window does not remember its position or size (UI-01).
