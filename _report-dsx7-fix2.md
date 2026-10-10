Fixed heading selection wash with the exact three-value inset; added H1/H2/H3 line-box assertions. Commit: 6e964cd (no push; briefs/reports excluded).

Results: foreground gutterStyles 15/15; selection browser tests 15/15, zero retries; UI typecheck/lint passed (warnings only); UI build/declarations passed; commit hooks including web typecheck passed. Browser validation required unsandboxed Chromium and restarting the stalled test server. Initial commit hook required regenerating UI declarations; exactly one commit created.
