# Danzig development

Local, dependency-free JavaScript simulation. Start: `node server.js` (127.0.0.1:4173).

- Keep changes within the requested feature and necessary fixes. Prefer targeted searches/reads over whole files, repository dumps or full DOM snapshots. Summarize successful tool output; inspect full logs only when needed.
- For unfamiliar code, consult the relevant row in `docs/DEVELOPMENT.md`. Do not read every document on each task. Update that map only when module boundaries or commands change.
- Checks: `node tools/check.cjs suggest <changed files>` recommends a profile. `quick` excludes explicitly tagged long simulations; `full` includes them. Use affected checks while iterating; run `full` once after model, economy, navigation or save-format changes. Docs-only changes do not require simulation runs. Repeat passed checks only after relevant edits or new evidence.
- Logs and machine-readable results are in `.reports/checks/`; no successful-result cache skips execution. `node tools/check.cjs --help` lists commands. No npm install is needed.
- UI checks use `http://127.0.0.1:4173/?demo=1`, which does not read/write the user's city. Use the available browser tool for relevant interactions and one visual check of the changed area. The old `tests/browser-check.cjs` is obsolete and is not part of these profiles.
- Preserve deterministic 5-minute model steps, existing v2 saves, real money/goods transfers and road-based movement. Keep external AI disabled unless requested. `backup-v1/` is the migration reference; `map.js` is an inactive renderer.
- Local Node tests use disposable cities: run and fix affected tests without additional approval. Report changes, validation and remaining limitations briefly; do not claim a token-saving percentage without measurement.
