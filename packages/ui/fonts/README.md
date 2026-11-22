# App font

`InterVariable.woff2` is the unmodified normal variable face from **Inter 4.1**,
by Rasmus Andersson and the Inter Project Authors, distributed under the
SIL Open Font License 1.1 (see `LICENSE.txt`).

Source: https://github.com/rsms/inter/releases/tag/v4.1

Archive: https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip

Archive member: `web/InterVariable.woff2` (352,240 bytes).
Axes: weight 100–900, optical size 14–32.

Both app entry points import `@book.dev/ui/app-font.css`. The relative font URL
lets Next and Vite emit a local hashed asset; no public-folder copies or runtime
font service are needed. The package publishes this directory alongside `dist`.

The shared `src/index.css` and standalone viewer deliberately keep their existing
system stack. Do not import this entry from the UI library or export graph.
`font-optical-sizing: auto` enables opsz without fixing weight on descendants;
FF labels may override it with explicit `font-variation-settings` pairs.
