Commit: `17dd30c` — `fix(ui): correct selection wash and gutter hover continuity`. One commit; no push; brief/report files excluded.

- A: Selection wash uses ring at 0.14 light / 0.2 dark. Browser assertion checks selected `::before` background alpha ≤ 0.2 in both themes.
- B: Exact gutter `::after` hover bridge added. Browser assertion crosses from textLeft+2 to handle center in 20 steps and checks gutter opacity 1, top-level and nested.
- C: Notes added to both text-family padding selectors; existing unit selector updated.
- D: Rhythm unit test locks gutter gap and clearance to 4px.

Foreground validation: gutterStyles 15/15; block-editor 36/36 and block-gutter-captures 5/5 (41 total, retries disabled); UI typecheck, lint, stylelint and stylelint controls pass. Lint: 206 warnings; stylelint: 162 warnings; no errors. UI build and generated declarations pass. Commit hooks pass, including UI/web typechecks and commitlint.

Initial sandbox browser startup failed; a rerun reused its stalled server and timed out. Fresh elevated run passed all 41 tests. Initial commit hook needed UI declarations regenerated after Vite build; regenerated and passed. Git emitted a packed-refs.lock sandbox warning, but the commit succeeded and HEAD was verified.
