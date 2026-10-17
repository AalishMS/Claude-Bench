# Stanza product page

Dark only, like the app's default. The page behaves like the app: the live window is on the first screen and slides
into place as the demo, a split stage opens one pane into four, a rail pans through the rest of the window, and it
ends on the install command as a prompt. Static, no build step: serve this folder (`npx serve site` or
`python -m http.server`) or open `index.html`. No third-party requests (the font is served from `assets/fonts`, no
CDN). Not part of the packaged app.

```
index.html          the page (all copy lives here; claims come from the repo's README and CLAUDE.md)
assets/             icon.png, og.png (social preview, still the old page's), fonts/ (Geist variable, SIL OFL)
css/
  base.css          @font-face, tokens, reset, grain, type, code/kbd, the cursor, the install "term", the switch
  page.css          nav, the opening stage, the split stage, the rail, FAQ, the install close, narrow screens
  mock.css          the mock app's tokens (matched to src/styles.css), scoped reset, the split stage's grid, animations
  tailwind.css      GENERATED from js/mock/ (see below)
js/                 plain scripts sharing one namespace, window.Stanza (load order is in index.html)
  boot.js           in <head>: picks the visitor's OS, sets html.pin (see below) before first paint
  util.js, model.js namespace, helpers; screens, accents and the mock's state
  mock/             the app's UI as markup (the accent list reads model.js): build.js (frame), sidebars,
                    overlays.js (subagent dialog, image lightbox, "Needs input" toast, and their data), screens/
                    (one file per screen: session, split, quad (the split stage), terminal, needs-input, panel, home, settings)
  page/             look (mock theme, accent, text size), install (OS switch, copy, the close's prompt), windows
                    (scale/crop), hero (live window + screen switch), scroll (pinning, progress), stage (the opening),
                    quad (the split stage), rail (features), actions (clicks in the mock), ticker, fx (nav)
  main.js           starts everything
tailwind/           config used to generate css/tailwind.css
```

## How it works

`mock/` renders the app's screens as HTML strings at a fixed 1280x700; `page/windows.js` scales and crops them
(`data-crop="x,y,w,h"`). The live window (`#hero-window`) takes clicks: they carry `data-act` / `data-arg` and
`page/actions.js` maps them to state changes. Other windows (`data-screen`) are frozen pictures, except the settings
controls of `data-editable` ones (the accent picker colors the page too).

`model.js` lists the screen switch's tabs (`TABS`) and what each screen is (`SCREENS`: kind, status bar, git line,
model), which `build.js` reads. The live window also takes input: the split's divider drags (`data-drag="split"`,
saved as `state.splitRatio` on release), the Terminal tab's prompt runs Vite's keys and a few canned PowerShell
commands (`S.mock.shell` in `screens/terminal.js`), and the permission prompt on Needs input answers to clicks or to
↑/↓/Enter/Esc while the window has focus (`#hero-window` has `tabindex="-1"`). Picking a tab in the switch replays its
screen (prompt, toast, dialog reset). All screen images are inline SVG or `assets/icon.png`.

**Pinned stages.** `html.pin` is on for wide, tall screens (`min-width: 901px and min-height: 640px`) without reduced
motion; `boot.js` sets it before first paint and `page/scroll.js` keeps it in step. Only then are the three stages
sticky and scroll-driven; without it (phones, short screens, reduced motion, no JS) every section is a plain block in
reading order. `scroll.js` calls each stage's `update(t)` with its 0..1 progress (or null when unpinned) once per
animation frame, and its `layout(pinned)` on resize and when the font has loaded.

- **Opening** (`page/stage.js`): planes back to front: a pool of light, a frozen second window, the copy, the live
  window, a page-scale copy of the "Needs input" toast. The window's CSS box is its demo place; at the top it is
  transformed to sit beside the copy (measured from the headline and the copy column), running off the right edge.
  Scrolling eases it home over the headline while the other planes move at their own rates; a fine pointer shifts them
  a few pixels before the scroll starts. The nav's Demo link scrolls to the held demo (`DEMO_AT`).
- **Split stage** (`page/quad.js`, `mock/screens/quad.js`): one mock with four panes, drawn once. The scroll sets the
  window's `data-panes` (1-4, at `ARRIVALS`) and mock.css lays out that many like the app's split (2 = A|B,
  3 = A|(B over C), 4 = 2x2), hides the sidebar rows past it and wipes the new pane in. `S.quad.apply()` rewrites
  the counts in the status lines, also after every redraw. Mock rules that hide an element carrying a Tailwind display
  class must name `.stanza-root` (tailwind.css scopes its utilities to it and loads after mock.css).
- **Rail** (`page/rail.js`): the track's overflow becomes the section's extra height, so it pans one pixel per pixel
  of scroll, with a short hold at each end. Items are as wide as their window (the text uses `contain: inline-size`).

The close's command is a read-only input: focusing it selects it, Enter copies it like the Copy button.

## Deploy

`.github/workflows/pages.yml` publishes this folder to GitHub Pages (https://aalishms.github.io/Stanza/) on every
push to `main` that touches `site/` or the install scripts (or by hand from the Actions tab). It copies
`scripts/install.ps1` and `install.sh` to the site's root, which is what the page's short install commands fetch, and
leaves out `tailwind/` and this README. Pages' source in the repo settings must be "GitHub Actions". All paths are
relative, so the `/Stanza/` subpath needs nothing.

## Regenerating `css/tailwind.css`

Run after adding or changing a class in `js/mock/`:

```
cd site/tailwind
npx tailwindcss@3 -c tailwind.config.js -i input.css -o ../css/tailwind.css --minify
```
