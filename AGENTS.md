# AGENTS.md — Tab Session Manager (GuyFran fork)

Single entry point for any AI agent. Personal fork of `sienori/Tab-Session-Manager` (MPL-2.0), a
Chrome/Firefox MV3 extension that saves and restores windows and tabs.

| | |
| --- | --- |
| **Owner** | GuyFran — guynemerp@free.fr (commit identity; no project override) |
| **Authority** | `~/.claude/CLAUDE.md` → `Documents/Projects/AGENTS.md` → this file → the docs below |
| **Version** | **7.4.62**, in `version` of **both** `src/manifest.json` and `src/manifest-ff.json` (must match). `package.json` stays `0.0.0`; it is not a version source |
| **State** | Active. Local unpacked use only, never published |
| **Remote** | `origin` = `GuyFran/Tab-Session-Manager`, branch `master`. No `upstream` remote |
| **Tests / CI / lint** | None exist. Verification = dev build + real-browser runs |

## Read order

1. This file: constraints and how to build.
2. [`docs/STATUS.md`](docs/STATUS.md): what is verified and what is not.
3. [`docs/BACKLOG.md`](docs/BACKLOG.md): open and closed work.
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the code works today.
5. [`docs/UI-UX.md`](docs/UI-UX.md): every fork UI surface. [`docs/UI_PERSISTENCE.md`](docs/UI_PERSISTENCE.md):
   how each fork surface keeps its layout state.
6. [`docs/CHANGELOG.md`](docs/CHANGELOG.md): per-version record with verification notes.

**History only, not a status source:** [`docs/FORK-REVIEW.md`](docs/FORK-REVIEW.md) (2026-08 review,
scope decision rationale, QA-01 evidence, original feature write-ups).

**Upstream files, not fork docs:** `README.md`, `BACKERS.md`, `docs/index.md`,
`docs/privacy-policy.md`. Their store links and setup steps describe the upstream product. Leave them
as they are to keep upstream merges clean.

## Scope decision (2026-08-07, in force)

Local, unpacked, personal use. Not published, not submitted to a store, not merged upstream, Google
Drive sync not used. This retires own OAuth client, source-zip secrecy, engine pinning and CI/lint/test
hygiene. Rationale: `docs/FORK-REVIEW.md` section 4. Do not reopen these without the owner.

## Hard constraints

- **Version + git loop on every change, docs included:** bump the last digit in both manifests, commit
  as `7.4.x - summary`, push to `origin master`. No branches, no asking. Stage by path.
- **Never touch the `key` field in `src/manifest.json`.** It pins the Chrome ID to
  `pheckpgfalekjmbbodbggfohpghjceog`, which keeps the saved-sessions IndexedDB across rebuilds. Its
  private key, `extension-key.pem`, is gitignored and not needed to build: never commit it.
- **`src/credentials.js` is gitignored but imported by `background/cloudAuth.js`.** If a build fails on
  `../credentials`, recreate it with empty values. Do not make the import optional.
  ```js
  export const clientId = "";
  export const clientSecret = "";
  ```
- **Never call browser behaviour verified from code alone.** Record the scenario and observed results
  in `docs/CHANGELOG.md`. For restores, always check that tabs kept their URL and title (BLANK-01 passed
  a QA that only checked routing and discard counts).
- **Do not mass-format or mass-translate.** `npm run format:check` already fails on 7 upstream files,
  and Japanese upstream comments stay. Check `git diff --stat` after format-on-save.

## Build

```bash
npm ci              # only if node_modules/ is missing
npm run watch-dev   # builds dev/chrome + dev/firefox, rebuilds on save
npx webpack --config webpack.config.dev.js   # one-shot dev build
```

Load `dev/chrome` through `chrome://extensions` → Developer mode → Load unpacked, then enable **Allow
in Incognito** (without it the extension cannot see incognito windows).

Chrome 152 stable **ignores `--load-extension`**, and `--enable-unsafe-extension-debugging`,
`--disable-features=DisableLoadExtensionCommandLineSwitch` and `--remote-debugging-pipe` do not lift it
(verified 2026-08-27). Automated runs must load the extension through the real page.

`npm run build` (`dist/*.zip`) is not part of this workflow.

## Multi-agent protocol

- Run `git status --short` first and leave work you did not create alone.
- Give parallel agents disjoint files, or read-only review/QA tasks. One agent integrates and commits.
- One home per fact: status in `STATUS.md`, work items in `BACKLOG.md`, per-version detail in
  `CHANGELOG.md`, behaviour in `ARCHITECTURE.md` / `UI-UX.md`. Update them in the same change. Do not
  add another status or TODO file.
- New fork features get a `CHANGELOG.md` row stating the actual verification level.
