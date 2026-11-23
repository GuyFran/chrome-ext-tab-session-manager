# Backlog — Tab Session Manager fork

Last reviewed 2026-11-24 against code at 7.4.60.

## Open

| ID | Item | Priority | State | Source |
| --- | --- | --- | --- | --- |
| SCALE-01 | Run a real 800-tab sweep: one window first, then "Sweep all". Confirm no crash, `sweep-tab-swapped` shows `placeholderBytes` < 60000, no `sweep-placeholder-trimmed`, and hibernated incognito tabs keep their URL after a Chrome restart | P1 | Owner verification | Owner report, 2026-09-16 |
| RTR-01 | A saved session whose tabs are not flagged `incognito` restores into a normal window with no warning. Cause unconfirmed: saved with `ifSavePrivateWindow` off (default), or `openInNewWindow()` reading a tab without the flag. Needs: did the "Incognito restore debug" window appear during the bad restore? | P1 | Waiting on owner | Owner report, 2026-08-27 |
| L-02 | Enable backup export (`ifBackup` is off by default) if real sessions are stored: Options → Backup | P1 | Owner action | Review, 2026-08-07 |
| VER-01 | Browser-verify 7.4.49–7.4.60: merge, window reorder, Session Buddy v3 import, import log, cached-thumbnail skip, notifications, repair of a thumbnail-less placeholder | P2 | Todo | Docs pass, 2026-11-24 |
| OPT-01 | `ifPreloadAfterRestore` is still shown in Options (default on) but nothing reads it since sweeps became manual in 7.4.41. Remove it or relabel it | P2 | Todo, needs code change | Code check, 2026-11-24 |
| UI-01 | Debug window always opens at 860×760 (`restoreDebug.js`). The global UI rule requires its position and size to persist | P3 | Todo, needs code change | Code check, 2026-11-24 |
| I18N-01 | Fork strings are hardcoded English in `WindowsArea.js` and `RestoreDebugPage.js`, while the rest of the UI uses `_locales` | P3 | Todo, needs code change | Code check, 2026-11-24 |

## Retired (scope decision, do not reopen without the owner)

S-01, S-02, B-05 (Drive sync crash on files without `appProperties`, still present at
`cloudAPIs.js:32`), B-07, B-08, B-10, B-11, `npm audit`. See `FORK-REVIEW.md` section 4.

## Done

| ID | Item | Closed in |
| --- | --- | --- |
| PH-01 | Placeholder URLs under 60 KB | 7.4.58 |
| DBG-01 | `DEBUG_RESTORE_TAB_LIMIT` removed | 7.4.37 |
| SWEEP-01 | Post-restore sweep never worked | 7.4.23 |
| BLANK-01 | Incognito restore destroyed tab URLs | 7.4.22, hardened 7.4.43, 7.4.45 |
| QA-01 | Real-Chrome private/mixed restore check | 7.4.19 |
| L-01, L-03 | Pinned extension ID; tab-group session guard | 7.4.1 |
| B-02, B-03, B-04, B-06, B-09 | Upstream correctness bugs | 7.4.1 (code-level; runtime paths not exercised) |
