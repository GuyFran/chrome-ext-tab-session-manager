# Status — Tab Session Manager fork

**Version 7.4.62** (2026-11-25, UI persistence for fork surfaces, `docs/UI_PERSISTENCE.md`; production build only, not run in a browser). Version source:
`src/manifest.json` + `src/manifest-ff.json`. Facts below were re-read from the code on 2026-11-24.
**Nothing was built or run in that pass.**

## Verification by area

| Area | Versions | Level | Evidence |
| --- | --- | --- | --- |
| Private and mixed restore: routing, batching, discard | 7.4.18 | Real Chrome 152 | QA-01, 2026-08-27 (`FORK-REVIEW.md` section 5) |
| Restored tabs keep URL and title | 7.4.22, 7.4.43 | Real Chrome | Changelog: 0 blanks with 9 s-stalling pages |
| Save → kill Chrome → relaunch → reopen (incognito, 8 tabs) | 7.4.24 | Real Chrome 152 | Changelog |
| Incognito thumbnail capture, hidden-window deferral | 7.4.25–7.4.28 | Real Chrome | Changelog |
| Uncapped restore (14/14 incognito tabs) | 7.4.37 | Real Chrome | Changelog |
| Parallel per-window sweep (2 windows, 15 s) | 7.4.38 | Real Chrome | Changelog |
| Placeholder size ladder | 7.4.58 | Browser, synthetic pages; builder in Node | Changelog |
| Sweep at 800 tabs, Chrome restart with capped placeholders | 7.4.57–7.4.58 | **Not run** | SCALE-01 |
| Merge, window reorder, import changes, cached-thumbnail skip, notifications, placeholder repair | 7.4.49–7.4.60 | **Build only** unless its changelog row says otherwise | Changelog |
| Firefox build at runtime | all fork versions | **No recorded run** | — |

## Tooling (last recorded)

| Check | Result | When |
| --- | --- | --- |
| Dev build | 0 errors, 29 warnings (Sass-loader deprecations) | 7.4.60, 2026-09-25 |
| `npm run build` | Not run since the toolchain was restored; not needed | — |
| `npm audit` | 5 dev-only advisories, retired by scope decision | 2026-08-27 |
| `npm run format:check` | Fails on 7 upstream files, retired | 2026-08-07 |
| Tests, CI, linter | None exist | — |
| Node / npm | 24.19.0 / 11.17.0 installed; `package.json` pins 24.13.0 / 11.7.0, not enforced | 2026-08-17 |

## Known limits

- Thumbnails need a rendered, active tab (`captureVisibleTab`), limited to 2 calls per second, and match
  on exact URL.
- Chrome's Memory Saver tabs in normal windows are never swept.
- Extension pages cannot load in incognito (`"incognito": "spanning"`), hence `data:` placeholders.
- Placeholders stay under 60 KB, so text-heavy pages may hibernate with a thumbnail only 480 px wide.

Open work: [`BACKLOG.md`](BACKLOG.md).
