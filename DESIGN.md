# Claude Bench design system

The UI follows **[shadcn/ui](https://ui.shadcn.com/)**: the dark theme on the neutral base color (v4 tokens), plus a
short list of deliberate tweaks for a compact, terminal-first desktop tool. This file is the source of truth for how
the app looks. Read it before any UI change, and update it in the same change if a rule has to move.

shadcn is **copied, not installed**: there is no React, no Tailwind and no Radix. Its tokens live as CSS variables
at the top of `src/styles.css`, and its components are re-created as small CSS recipes that the renderer's `h()`
helper uses. The Tailwind class names in this file only say which shadcn recipe a rule comes from.

## 1. Tokens

All colors, radii and shadows are CSS variables on `:root` in `src/styles.css`, and they use shadcn's names. Change
a token, never a scattered value. Dark only: there is no light theme.

| Token | Value | Used for |
|---|---|---|
| `--background` | `#171717` | terminal, top bar, status bar, dialogs (one step lighter than `--sidebar`, a tweak) |
| `--foreground` | `#fafafa` | body text |
| `--card` | `#171717` | welcome project cards (same as the background, so they read as outlined cards) |
| `--popover` | `#171717` | footer detail popover, `…` menu, exit overlay |
| `--primary` | `#2850a5` | **the one accent** (royal blue, a tweak: shadcn's own primary is near-white) |
| `--primary-foreground` | `#fafafa` | text on primary |
| `--secondary`, `--muted`, `--accent` | `#262626` | tab list, kbd, meter track, hover surfaces |
| `--muted-foreground` | `#a1a1a1` | secondary text, inactive tabs, labels |
| `--faint` | `#737373` | tertiary meta: paths, times, placeholders (tweak; shadcn has no third text level) |
| `--border` | `rgb(255 255 255 / 10%)` | dividers, panel and card borders |
| `--input` | `rgb(255 255 255 / 15%)` | input, outline button and active tab borders |
| `--ring` | `var(--primary)` | focus rings (tweak; shadcn's ring is grey) |
| `--destructive` | `#ff6467` | destructive actions, conflicts, critical meters |
| `--success` | `#7fb77e` | running |
| `--warning` | `#d6b25e` | uncommitted changes, background activity |
| `--sidebar` | `#0a0a0a` | project sidebar, servers panel: the darkest surface, a quiet frame (tweak) |
| `--sidebar-foreground` | `#fafafa` | |
| `--sidebar-accent` | `#262626` | selected sidebar row |
| `--sidebar-hover` | `color-mix(--sidebar-accent 50%, transparent)` | hovered sidebar row: a softer selected |
| `--sidebar-border` | `rgb(255 255 255 / 10%)` | |
| `--radius` | `10px` | base radius |
| `--radius-sm` / `-md` / `-lg` / `-xl` | `6` / `8` / `10` / `14px` | shadcn's `rounded-sm/md/lg/xl` |
| `--shadow-sm` / `-md` / `-lg` | | chips, popovers, dialogs (barely visible on dark, as in shadcn) |

The `accent` name is a trap: in shadcn, `--accent` is the **neutral hover surface**. The brand color is `--primary`.

### The accent rule

`--primary` is the only accent literal. Everything tinted is derived from it with `color-mix()`:

- `--primary-hover: color-mix(in srgb, var(--primary) 85%, white)`
- focus ring: `0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)`
- meter track: `color-mix(in srgb, var(--primary) 20%, transparent)`

So a future accent setting only has to call `document.documentElement.style.setProperty('--primary', value)`.
Never hard-code the blue, or a tint of it, anywhere else (CSS, renderer, inline styles).

Primary appears **only** on: primary buttons, focus rings, progress-meter fills, the checked checkbox, and the
"needs attention" status dot. Nothing else gets it.

### Status colors

Color otherwise only carries meaning: `--success` green = running, `--warning` yellow = uncommitted changes or
background activity, `--destructive` red = conflicts, destructive actions, critical levels. No decorative color, no
gradients, no glows, no tinted cards.

## 2. Typography

- UI font: **Segoe UI Variable** (`"Segoe UI Variable Text", "Segoe UI", system-ui`). This is a tweak: shadcn uses
  Geist, but bundling it isn't worth it on Windows.
- Compact scale (a tweak; shadcn's base is 14 px): **13 px** body, 12 px small / labels, 11 px meta, 14 px
  dialog/section emphasis, 18 px dialog title (`text-lg`), 30 px welcome h1 (`text-3xl`, semibold, `tracking-tight`).
- Weights: 400 body, 500 for project names, active rows, buttons and labels, 600 for titles.
- Labels are **sentence case** (shadcn `SidebarGroupLabel`: 12 px, 500, `--muted-foreground`). No uppercase
  tracking-widened labels.
- Mono (`--mono`, Cascadia Mono): ports, numbers in popovers, kbd.

## 3. Components

Class names are short and composable. These recipes mirror shadcn's components.

### Button: `.btn` + variant + size
- Base: `inline-flex`, gap 6, `rounded-md`, weight 500, 13 px, no wrap, `transition: background, color, border .15s`.
  `:focus-visible` = ring. `:disabled` = opacity .5.
- Variants:
  - `primary`: `--primary` / `--primary-foreground`, hover `--primary-hover`.
  - `outline`: 1 px `--input` border, `bg color-mix(--input 30%)`, `shadow-sm`, hover bg `--accent`.
  - `ghost`: transparent, `--muted-foreground`; hover bg `--accent`, `--foreground`.
  - `destructive`: bg `color-mix(--destructive 60%, transparent)`, white text, hover 75%.
- Sizes: default h 32 / px 14; `sm` h 28 / px 12; `icon` 32 square; `icon sm` 24 square (14 px icon).
- `.danger` on a ghost icon button = `--destructive` on hover (row delete, kill server).
- `.on` = toggled state (bg `--accent`, `--foreground`).
- **No pill buttons.** Pills were the old design.

### No tab strip
There is no horizontal tab strip: the sidebar's session rows are the tabs. Every open tab has a row (a transcript
row, a "New session" placeholder until the first reply, or a "PowerShell" row). `Ctrl+Tab`, `Alt+1..9` and
`Ctrl+Shift+W` still work on tab order.

### Status dot
6 px circle, only on things that are live: `--success` running, `--warning` pulsing working (Claude busy or
background output), `--primary` pulsing needs attention (bell, or exited in the background). Nothing live = no dot
(no grey placeholder).

### Sidebar: shadcn `Sidebar`, lightened
- `#sidebar` is a full-height column: bg `--sidebar` (the darkest surface), width 256. **No divider** on the
  terminal side: the step to `--background` separates them. Nothing inside has its own box, card, tint or border.
- Top row (40 px, draggable): sidebar toggle, logo, app name (`#brand`). While collapsed, `#brand` moves to the start
  of the top bar so the toggle stays reachable.
- Search: a plain 32 px row (search icon + "Search" placeholder), no border; hover/focus = `--sidebar-hover`.
- Rows are flat, 32 px, `rounded-md`, side padding 8. 2 px between rows, 12 px between project groups.
  Hover = `--sidebar-hover`, selected = `--sidebar-accent`. **No borders, no left accent bar.**
- Project row: chevron (14 px, `--faint`), folder icon, name (500), and on the right one status dot when anything
  in the project is live. On hover the dot is replaced by `+` (new session) and `…` (DropdownMenu: continue, open
  PowerShell, show in Explorer, remove). Path and git info live in the tooltip; the **active** project adds one
  11 px `--faint` line under it (`branch · 3 changed`, the branch truncates first). A collapsed active project gets
  the selected background.
- Folder icon: the same `folder` icon for every project, 16 px in an 18 px slot, `--muted-foreground`.
- Session rows: no guide line. Columns line up: the status dot sits under the folder icon (slot at 28 px),
  titles start at 52 px like the project name. Title 13 px with ellipsis; time 11 px `--faint` on the right. Rows
  backed by an open tab show `×` in place of the time on hover (middle-click closes too). Active = weight 500.
- Footer: one slim 44 px row. Ghost icon buttons left (add project); stats right, each **icon + value** in a
  28 px `rounded-md` button (padding 0 8, gap 6, 2 px apart, 12 px tabular numbers): plan **session** usage as a ring
  gauge + `10%`, context as the pie icon + `24%`, running as a status dot + `3 running`. Icons `--faint`, values
  `--foreground`, colored only at warn/crit levels. Weekly usage lives in the tooltip and the popover. Each opens its
  `#detail` popover; hover `--sidebar-hover`, `.on` = bg `--sidebar-accent`.
- The servers panel uses the same `--sidebar` surface with a hairline `--sidebar-border` on its terminal side.

### DropdownMenu: shadcn `DropdownMenu` (`#menu`)
- On the Popover recipe: bg `--popover`, 1 px `--border`, `rounded-lg`, `shadow-md`, padding 4, min-width 210.
- Items: h 30, padding 0 8, `rounded-sm`, 13 px, 14 px `--muted-foreground` icon; hover/focus bg `--accent`.
  Destructive item = `--destructive` text and icon. Separator: 1 px `--border`, full bleed.
- Closes on outside mousedown, Escape, window blur/resize and list scroll.

### Input: shadcn `Input` / `SidebarInput`
- h 32, `rounded-md`, 1 px `--input` border, `bg color-mix(--input 30%)`, placeholder `--faint`.
- `:focus-within`: border `--ring` + ring shadow.

### Card: shadcn `Card`
- bg `--card`, 1 px `--border`, `rounded-xl`, `shadow-sm`, padding 14/16. Hover: border `--input`, bg
  `color-mix(--card, --accent 40%)`.

### Popover: shadcn `Popover`
- `#detail` and the exit `.overlay`: bg `--popover`, 1 px `--border`, `rounded-lg`, `shadow-md`, padding 12–16.
- Heading: 13 px, 600, `--foreground` (sentence case).

### AlertDialog: shadcn `AlertDialog`
- Scrim `rgb(0 0 0 / 50%)`. Panel: bg `--background`, 1 px `--border`, `rounded-lg`, `shadow-lg`, padding 20,
  width 420.
- Title 18 px / 600; description 13 px `--muted-foreground`; footer right-aligned, gap 8: Cancel = `btn outline`,
  action = `btn primary` or `btn destructive`.

### Progress (meters): shadcn `Progress`
- Track `color-mix(--primary 20%, transparent)`, `rounded-full`; fill `--primary`.
- `.warn` fill `--warning`, `.crit` fill `--destructive` (track stays neutral `--muted` then).
- Ring gauge (`.gauge`, circular Progress): 16 px, 3 px stroke, pure CSS (`conic-gradient` masked to a ring,
  `--p` = percent). Same fills; the track is always `--muted`, because a primary tint disappears on `--sidebar`.

### Kbd: shadcn `Kbd`
- bg `--muted`, `rounded-sm`, h 20, padding 0 6, 11 px mono, `--muted-foreground`.

### Checkbox: shadcn `Checkbox`
- Native `<input type=checkbox>` with `appearance: none`: 16 px, `rounded-sm` (4 px), 1 px `--input` border,
  `bg color-mix(--input 30%)`. Checked: bg + border `--primary`, white check (CSS mask/`::after`). Focus = ring.

### Scrollbars
- Thin (8 px), thumb `--border` color, `rounded-full`, hover `--input`. The terminal uses its own `.vbar` (see
  CLAUDE.md); same colors.

### Icons
- Lucide-style (Feather-compatible) inline SVG paths in `ICONS` (renderer.js), 24-unit viewBox, stroke 2, round
  caps, drawn at 16 px (14 px in small buttons, 12 px inline). Outline only.
- Logo: a light tile with a dark `>_`. `LOGO_SVG` in renderer.js and `scripts/make-icon.js` must stay in sync.

## 4. Layout and behavior (tweaks kept from before)

- **Terminal first.** The terminal gets the space and the focus. The chrome around it stays quiet: the top bar and
  status bar are `--background` like the terminal, and the sidebars are one step **darker** (`--sidebar`), a frame
  around the work rather than a panel competing with it (a tweak: shadcn's sidebar is the lighter side).
- Two columns: the full-height sidebar, then the workspace (top bar, terminal + servers panel, status bar). The top
  bar and status bar never run under the sidebar.
- Top bar 40 px (draggable; new-session `+` on the left, servers toggle and the window controls on the right via
  `titleBarOverlay`). Status bar 24 px: git branch, changes and path on the left; the active Claude tab's model,
  effort and subagents, then the running count, on the right. There is no separate info bar.
- **No badges.** Git info is plain text (`main  2 changed`), colored only by meaning.
- Lists are flat inset rows; nothing wraps or shifts on hover.
- Tooltips are native `title` attributes. Details go in tooltips, not extra lines.
- Shadows only on raised things: outline buttons (barely visible), popovers, menus, dialogs.

## 5. Terminal

Per-line font size is impossible in a terminal grid, and the app never re-parses Claude's output into "blocks".
`XTERM_THEME` is the real lever.

- **Typography** (`TERM_FONT` in renderer.js): Cascadia Mono, light body weight (300), bold 700, line height 1.4,
  slight letter spacing. Size via `Ctrl +` / `Ctrl -` / `Ctrl 0` (10–24, saved in `ui.fontSize`).
- Claude Code emits the **ANSI 16-color palette** (measured from the xterm buffer): default fg = body, `white` =
  secondary/meta text and rules, `white`+dim = diff context, `brightWhite` on `brightBlack` bg = the user's message bar,
  `brightBlue` = inline code, `brightGreen` = bullets and diff +, `brightRed` = diff -, bold = headings/strong, italic
  = emphasis/quotes, H1 = bold+italic+underline.
- Keep `white` mid-grey (hierarchy) and `brightBlack` dark (a quiet message bar): `#333333`, one step above
  `--background`. If the background moves, move `brightBlack` with it so the bar stays visible but quiet. `minimumContrastRatio: 3` keeps
  PowerShell's brightBlack flags readable.
- The terminal background **is** `--background`: `XTERM_THEME.background` and `cursorAccent` are read from the CSS
  variable at startup (`cssVar()` in renderer.js).

## 6. Sync points (literals that can't read CSS)

- `src/main.js`: `backgroundColor` and `titleBarOverlay.color` = `#171717` (they paint before CSS loads; the
  window controls sit on the top bar). Keep them equal to `--background`.
- `XTERM_THEME.brightBlack` (renderer.js) is tuned against `--background` (see section 5).
- `scripts/make-icon.js` ↔ `LOGO_SVG`.
