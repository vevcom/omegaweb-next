# design-sync notes — omegaweb-next → claude.ai/design

Repo-specific gotchas for future syncs. Read this **and** `config.json` before
re-running. Target project: `Ohma Design System`
(`451c0873-159d-403e-af6c-346418a5e5f9`).

## Why this repo needs a staging step

omegaweb-next is a **Next.js app, not a component library**: no library build, no
`dist/`, and every component styles itself with `*.module.scss`, which esbuild
cannot load. `.design-sync/stage-pkg.mjs` mechanically transforms the real source
into a bundlable package under `.design-sync/.cache/pkg/`:

- compiles each `*.module.scss` → `*.module.css` with `sass` (a custom importer
  resolves the `@/styles` alias); esbuild then handles `*.module.css` natively as
  CSS modules, so the class-name map survives
- rewrites only import specifiers; component bodies are copied verbatim
- swaps `next/link` → `src/_shims/Link`, `next/navigation` → `src/_shims/navigation`
- emits `index.ts` (the barrel that defines the synced surface), `tsconfig.json`,
  `package.json`, and `styles/globals.css`
- copies `public/fonts/**` in and rewrites the app's absolute `url('/fonts/…')`
  references to relative ones

`.design-sync/scope.json` is the **source of truth for which components sync**
(`{Name: {group, src, export}}`). Add or remove entries there, not in config.

Rebuild command (also in `config.buildCmd`): `node .design-sync/stage-pkg.mjs`.
It emits the `.d.ts` tree itself — it wipes its output dir (`types/` included)
and the converter derives the component list from that tree, so a separate
forgotten `tsc` silently produced a 12-component bundle instead of the full set.

## Environment

- **Node is not on `PATH`** on this NixOS host. Use
  `export PATH=/nix/store/hwjfj8m2kcsl7kz2xa5yf84jbfh9jssf-nodejs-24.18.1/bin:$PATH`
  (or whatever `ls -d /nix/store/*nodejs*/bin` shows). The app itself normally runs
  in Docker (`pn-dev`), but the sync runs on the host against `./node_modules`.
- **Playwright chromium is not downloaded.** The system chromium works:
  `export DS_CHROMIUM_PATH=/run/current-system/sw/bin/chromium`. Only the
  `playwright` npm package is installed in `.ds-sync/`
  (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`).
- Run the converter with `--node-modules ./node_modules --entry
  ./.design-sync/.cache/pkg/index.ts`.

## Decisions taken (and why)

- **`Date` → exported as `DateDisplay`.** The component's real name is `Date`, but
  the converter's `.jsx` stub does `Object.assign(window, { <Name>: … })`, which
  would clobber the global `Date` constructor on any page that loads it. Renamed in
  the barrel only; the source is untouched.
- **`Inter` is vendored from Google Fonts** (`.design-sync/vendor-inter.mjs`, SIL
  OFL). `src/styles/_fonts.scss` sets `$primary: 'Inter', sans-serif` — Inter is the
  body font for the whole site — but the app never `@font-face`s it and ships no
  file, so **production has been falling back to system sans**. Worth fixing in the
  app itself. Cache is gitignored, so a fresh clone must re-run the script (needs
  network).
- **`OhmaPreviewSurface`** exists only as the outer half of `cfg.provider`. The
  card harness hard-codes `body{background:#fff}`, and this DS is dark-only with
  near-white `--text`, so without it text and icons render invisible. It never
  wraps a real design (those get the dark surface from `styles.css`).
- **`OhmaProviders`** nests the app's real `EditModeProvider`,
  `PageTitleProvider` and `PopUpProvider`. Not a reimplementation — it imports them.
- **`CheckboxFieldPresent` is excluded from the card list** (`componentSrcMap:
  null`). It renders a deliberately hidden input — internal form plumbing used by
  `Checkbox`/`Slider`, never composed directly. Still in the bundle.
- **`MobileNavBar` is not synced**: it transitively imports `StandardImageServer`,
  which pulls in the service layer.
- **`TagHeasderItemPopUp` keeps its typo** — that is the real export name in
  `HeaderItems/HeaderItemPopUp.tsx`. Renaming would desync the DS from the app.

## Themes

The app ships **four** themes in
`src/app/users/[username]/(user-admin)/theme/theme.ts` — `Standard`, `Light`,
`Solarized`, `StjerneInnbygger` — applied at runtime by `applyTheme()`, which
sets 17 custom properties on `document.documentElement`. `ThemeEnabler` (mounted
in `app/layout.tsx`) restores the persisted choice on load.

`stage-pkg.mjs` reads `theme.ts` at build time (in a child process with
`--experimental-transform-types`, because the file uses an `enum` and Node's
default type-stripping can't handle that) and emits a
`:root[data-theme="<Name>"]` block per theme into `styles/globals.css`. The
barrel also re-exports `themes` / `applyTheme` / `subscribeToTheme` /
`getActiveTheme` / `ThemeName`, so a design can switch themes exactly as the app
does. `ThemeName` is excluded from the card list (`componentSrcMap: null`) — it's
an enum, not a component.

**Do not hand-copy palette values anywhere.** `theme.ts` is the single source of
truth; the CSS is generated from it on every build.

Verified in a real card (both mechanisms): `[data-theme]` and `applyTheme()` both
re-colour the shipped components.

**Inconsistency worth fixing in the app:** `globals.scss` and `theme.ts`'s
`Standard` disagree — `globals.scss` has `--text: hsl(0,0%,90%)` and
`--accent-blue: #037FFC`, while `themes.Standard` has `hsl(0,0%,80%)` and
`hsl(210,70%,50%)`. So picking "Standard" in the theme switcher yields slightly
different colours than a fresh page load, which never applied a theme.

## Component defects found while authoring previews

These are faithfully reproduced in the cards and documented in `conventions.md`.
They are **app bugs, not sync bugs** — fix them in the repo, then re-sync.

- ~~`UI/Select.module.scss` styles almost nothing…~~ **Fixed.** Select now uses
  `appearance: none` plus the shared field treatment; verified in the built CSS
  (`.Select_field` carries `surface-raised` / `ink-strong` / border / radius).
- ~~`UI/FileInput.module.scss` `.black` … dark text on black.~~ **Fixed.**
  `.FileInput_black > .trigger .value` now resolves to `--ink-strong`.
- `UI/Slider.module.scss` `secondary` maps the track to `--surface-base`, invisible
  against the app surface. Same for `TextInput`'s `secondary` text colour.
- `UI/Checkbox.module.scss`: the `children` branch (`.inputAndChildren`) drops the
  custom box styling and falls back to the native checkbox.
- ~~`UI/BorderButton.module.scss` has no `:disabled` rule.~~ Retired — the
  outline button tier was removed entirely (component, `borderBtn` mixin and all
  ten stylesheet call sites) in favour of the filled `secondaryBtn` tier. If a
  future sync sees `BorderButton` reappear in `scope.json`, that is a mistake.
- `Table/SimpleTable.tsx` wraps each `<tr>` in a `<Link>` when `links` is passed —
  an `<a>` containing a `<tr>` is invalid HTML and browsers hoist it out, visibly
  breaking the rows. The `WithLinks` story was dropped for this reason.
- `SideBarNavItem` / `AdminNav` labels only appear under
  `.DesktopSideBar[data-expanded='true']`. That shell is `DesktopSideBar.tsx`, a
  server component that can't ship, so `expanded` has no visible effect in a card.

## Known render warns

None. The final `package-validate.mjs` run exits 0 with **zero** warnings and
39/39 previews rendering cleanly (40 before `BorderButton` was retired). Any warn
on a future run is new — investigate before recording it here.

## Preview techniques used

- Overlay/menu open states are produced by **clicking the real trigger on mount**
  (`useEffect` → `querySelector('button').click()`), never by hand-writing panel
  markup. `SearchableDropdown` focuses its combobox input instead.
- Popup components carry `cfg.overrides.<Name> = {cardMode: "single",
  primaryStory: "Opened", viewport: "900x620"}` because the panel is
  position-fixed and escapes a grid cell.
- `SimpleTable` and `RadioLarge` use `cardMode: "column"` (they overflowed a
  multi-column grid cell).
- `Dropzone` builds real decodable PNGs with a `<canvas>` at mount, because it
  renders `URL.createObjectURL(file)` thumbnails. A truncated/padded PNG shows as
  a broken-image box.
- `NavBarTitle`'s title state is produced by mounting a hidden real `PageWrapper`,
  which is the only thing that writes `PageTitleContext`.
- Content is real Norwegian Omega material (committee names from
  `NavBar/navDef.ts`, realistic event names) — never `foo`/`bar`. **Person names
  are placeholders** (`Ola Nordmann` / `olanord`, plus invented Norwegian names);
  don't put real members into previews — these cards are published.
- `<Name>.prompt.md` embeds examples lifted from `.design-sync/previews/<Name>.tsx`,
  so editing a preview changes the uploaded doc too, not just the card.

## Re-sync risks

- **Node/chromium paths above are host-specific** and will rot on a nix-store
  garbage-collect or an OS upgrade. Re-derive them, don't trust them.
- **`scope.json` drifts silently.** If a component listed there is renamed, moved
  or gains a service import, `stage-pkg.mjs` fails loudly (good) — but a *new*
  presentational component will simply never be synced until someone adds it.
  Re-check `src/app/_components/` against `scope.json` on each sync.
- **Inter is fetched from Google Fonts at stage time.** No network → no Inter →
  every card silently falls back to system sans. `stage-pkg.mjs` prints
  `! Inter not vendored yet`; don't ignore it.
- **The scss `@font-face` strip** in `stage-pkg.mjs` removes `@font-face` blocks
  from every `*.module.css` (sass re-emits them into each file via
  `@use "ohma"`). If font handling in `src/styles/` changes shape, verify the
  canonical copy still reaches `fonts/fonts.css`.
- **Component defects above may get fixed in the app.** When they are, update
  `conventions.md`'s "Known rough edges" and re-author the affected previews
  (`Select*` especially — they exist only to document a defect right now).
- Previews were verified against **Chromium 151**; native control rendering
  (`<select>`, `<input type="date">`, `type="color"`) is UA-dependent.
- `_ds_bundle.js` was confirmed **byte-deterministic** across two consecutive
  builds from an unchanged staged package. If a future no-change run reports a
  changed `bundleSha12`, something in `stage-pkg.mjs`'s emission order has become
  input-dependent — chase it rather than shrugging, because it would invalidate
  the carried-forward grades that make re-syncs cheap.
