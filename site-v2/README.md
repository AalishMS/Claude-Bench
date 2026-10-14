# Stanza product page (v2)

A fresh take on `site/`: dark only (like the app's default), shorter, one live window in the hero and a scrolling
feature tour. Static, no build step: serve this folder (`npx serve site-v2` or `python -m http.server`) or open
`index.html`. No third-party requests (system fonts, no CDN). Not part of the packaged app.

```
index.html          the page (all copy lives here; claims come from the repo's README and CLAUDE.md)
assets/             icon.png, og.png (social preview, still the old page's)
css/
  base.css          tokens, reset, type, code/kbd, the install "term", the switch
  page.css          nav, hero, mock windows, tour, facts, install, FAQ, footer, narrow screens
  mock.css          the mock app's tokens (matched to src/styles.css), scoped reset, animations
  tailwind.css      GENERATED from js/mock/ (see below)
js/                 plain scripts sharing one namespace, window.Stanza (load order is in index.html)
  boot.js           in <head>: picks the visitor's OS
  util.js, model.js namespace, helpers; hero screens, accents and the mock's state
  mock/             the app's UI as markup (from site/; the accent list now reads model.js)
  page/             look (mock theme, accent, text size), install (OS switch, copy), windows (scale/crop),
                    hero (live window), tour (sticky frame), actions (clicks in the mock), ticker
  main.js           starts everything
tailwind/           config used to generate css/tailwind.css
```

## How it works

`mock/` renders the app's screens as HTML strings at a fixed 1280x700; `page/windows.js` scales and crops them
(`data-crop="x,y,w,h"`). The hero window (`#hero-window`) is live: clicks inside it carry `data-act` / `data-arg` and
`page/actions.js` maps them to state changes. Other windows (`data-screen`) are frozen pictures, except the settings
controls of `data-editable` ones. The tour has two copies of each picture: one sticky frame per step on wide screens
(`.tour__frame`, shown by `page/tour.js`), and one inline window per step on narrow screens (`.tour__inline`, CSS only).

## Regenerating `css/tailwind.css`

Run after adding or changing a class in `js/mock/`:

```
cd site-v2/tailwind
npx tailwindcss@3 -c tailwind.config.js -i input.css -o ../css/tailwind.css --minify
```
