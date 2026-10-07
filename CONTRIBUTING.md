# Contributing

Issues and contributions are welcome.

## Issues

- Search existing issues first.
- Include exact steps, expected behavior, and actual behavior.
- Include the OpenBook version and your platform.
- Add a small reproduction, logs, or screenshots when useful. Remove secrets.

## Pull requests

- Keep each change focused.
- Use conventional commits.
- Match the fast PR gate locally: `pnpm run build:libs && pnpm run test:eslint-rules && pnpm run check:gen && pnpm run typecheck && pnpm run lint && pnpm --filter @book.dev/sdk --filter @book.dev/ui --filter @book.dev/app --filter @book.dev/mcp --if-present run test`.
- Full `pnpm verify` (including server tests and server/mcp e2e) runs nightly and on demand through the **Nightly verify** workflow; run it locally for server changes. PRs and pushes to main use the fast gate plus the existing CI jobs. For UI changes also run `pnpm test:e2e:web` (first time: `pnpm --filter @book.dev/web exec playwright install chromium`).
- Add before-and-after evidence for visual changes.
- Update tests and docs when behavior changes.

See [DEVELOPMENT.md](DEVELOPMENT.md) for setup and architecture links.

## AI-generated contributions

AI-generated pull requests are accepted. They must meet the same house standard.
The author is accountable for correctness.

## CLA

A Contributor License Agreement is required before your first pull request is merged. We'll comment on your PR with the link.
