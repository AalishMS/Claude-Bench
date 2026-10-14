# Stanza product page

Static, no build step for the page itself: open `index.html` in a browser, or serve this folder (`npx serve site`).
It makes no third-party requests (system fonts, no CDN). Not part of the packaged app.

```
index.html          the page (all copy lives here)
assets/             icon.png (app logo), og.png (social preview, 1200x630)
css/
  tokens.css        colors, fonts, the one accent (--stanza-accent), light/dark
  base.css          reset, typography, layout containers
  components.css    buttons, segmented control, cards, steps, FAQ, shortcut table
  layout.css        nav, hero, sections, feature rows, footer, scroll reveal
  install.css       OS switch and copyable commands
  demo.css          scaled mock windows, the live demo bar, accent picker, comparison slider
  mock.css          the mock app's own tokens, scoped reset and animations
  tailwind.css      GENERATED, utilities used by the mock (see below)
js/                 plain scripts sharing one namespace, window.Stanza (load order is in index.html)
  boot.js           in <head>: picks theme and OS before first paint
  util.js, model.js namespace, helpers; tabs, captions and the mock's state
  mock/             the app's UI as markup: icons, sidebars, one file per screen, build.js (title/status bar)
  page/             behaviour: appearance, os, copy, windows, stage (live demo), compare, actions, ticker, scroll
  main.js           starts everything
tailwind/           config used to generate css/tailwind.css
```

## How the mock works

`mock/` renders the app's screens as HTML strings. `page/windows.js` draws them at a fixed 1280x700 and scales
(and crops) them to fit. Clicks inside the mock carry `data-act` / `data-arg`; `page/actions.js` maps them to
state changes, so the markup has no inline handlers. The live demo is `#stage`; previews are `.window[data-screen]`
(`data-editable` ones keep their settings controls working).

## Regenerating `css/tailwind.css`

The mock is written with Tailwind classes. Rather than ship the Tailwind runtime, the utilities it uses are generated
once and checked in. Run this after adding or changing a class in `js/mock/`:

```
cd site/tailwind
npx tailwindcss@3 -c tailwind.config.js -i input.css -o ../css/tailwind.css --minify
```

Tailwind is not a dependency of the repo; npx fetches it for the run. Utilities only apply inside `.stanza-root`,
so they cannot restyle the page.

## Editing notes

- Copy claims come from the repo's README and CLAUDE.md. Keep them true.
- Shortcut keys are written twice (`data-win` / `data-mac` on each `<kbd>`); the OS switch swaps them.
- The accent and theme are page-wide on purpose: the mock's settings screens drive the same controls as the nav.
