# Ohma — how to build with this design system

Ohma is the component library of **Sanctus Omega Broderskab** (omegaweb-next). It
is **fully themed** — four palettes, swapped at runtime — and the UI language is
Norwegian (bokmål). Write labels, placeholders and helper copy in Norwegian.

## Wrap every tree in `OhmaProviders`

Several components read app-level React context. Without the provider they throw
or render an empty placeholder:

- `PopUp` and every `*HeaderItemPopUp` throw `Pop up context needed for popups`
- `PageWrapper` writes the page title; `NavBarTitle` reads it — outside the
  provider `NavBarTitle` renders only a blank reserved-space strip
- `AdminNav` reads edit-mode state

```jsx
const { OhmaProviders, PageWrapper, Button } = window.OhmaUI

<OhmaProviders>
  <PageWrapper title="Arrangementer">
    <Button color="primary">Lagre</Button>
  </PageWrapper>
</OhmaProviders>
```

## Styling idiom: CSS custom properties, not utility classes

**There is no utility-class vocabulary — do not invent one, and do not write
`class="bg-surface-1"`-style names; nothing will resolve.** Component internals
are styled by hashed CSS-module classes you cannot target. Style your own layout
glue with the design tokens below, via inline `style` or your own CSS.

The tokens are declared on `:root`/`html` by the shipped stylesheet, and **17 of
the 21 are re-declared by every theme** (see Themes below). These 21 are the
complete set:

| Group | Tokens |
|---|---|
| Surfaces | `--surface-base` (page), `--surface-raised` (cards/panels), `--surface-hover`, `--surface-subtle` |
| Text | `--text`, `--text-muted`, `--text-inv` (on accent fills) |
| Ink | `--ink-hover`, `--ink-strong` |
| Accents | `--accent-blue` (primary), `--accent-red`, `--accent-green`, `--accent-yellow`, `--accent-orange`, `--accent-cyan`, `--accent-magenta`, `--accent-violet` |
| Shape / spacing | `--rounding` (1rem), `--gap` (0.5rem) |
| Depth | `--layer`, `--boxShadow` |

Idiomatic panel:

```jsx
<div style={{
  background: 'var(--surface-raised)',
  color: 'var(--text)',
  padding: 'calc(2 * var(--gap))',
  borderRadius: 'var(--rounding)',
}}>…</div>
```

**Always paint a `--surface-base` (or `--surface-raised`) background behind your
content**, and always take text colour from `--text` / `--text-muted`. Dropping
content onto an unpainted background is the single most common way to end up with
invisible text here, because the default theme's `--text` is near-white.

## Themes

Four themes ship with the design system: **`Standard`** (dark, the default),
**`Light`**, **`Solarized`** (warm light), and **`StjerneInnbygger`** (deep blue).
Each re-declares the same 17 colour tokens — every surface, text, ink and accent
above; `--rounding`, `--gap`, `--text-inv` and `--boxShadow` stay fixed.

Two equivalent ways to select one:

```jsx
// Declarative — the stylesheet ships a block per theme.
<html data-theme="Light">

// Runtime, exactly as the app's own theme picker does it:
const { applyTheme, ThemeName, themes } = window.OhmaUI
applyTheme(ThemeName.Solarized)   // sets the custom properties on <html>
```

`themes` is the raw palette map (`themes.Light['surface-base']` etc.) if you need
to read a value rather than apply one. `subscribeToTheme(fn)` notifies on change;
`getActiveTheme()` reads the persisted choice.

**This is why the token rule matters.** A component or layout styled with
`var(--surface-raised)` follows all four themes for free. A hardcoded `#1a1a1e`
looks correct in `Standard` and broken in `Light` and `Solarized` — so never
hardcode a colour that a token already names.

## Type

`Inter` (300/400/500/700) is the body face and applies by default. `PlayfairDisplay`
(serif) is the display face — `PageWrapper` already uses it for its `h1`; reach for
it only for headings. Both ship with the bundle. Font sizes are fluid `clamp()`
values baked into the components; don't hardcode px type.

## Component groups

`actions` (Button) · `inputs` (TextInput, Textarea, NumberInput,
DateInput, ColorInput, FileInput, Checkbox, RadioLarge, Slider, Dropzone,
SelectString, SelectNumber, SearchableDropdown) · `overlays` (PopUp, Dropdown,
EditOverlay, AddHeaderItemPopUp, HelpHeaderItemPopUp, SettingsHeaderItemPopUp,
UsersHeaderItemPopUp, TagHeasderItemPopUp, ArchiveHeaderItemPopUp) · `feedback`
(ProgressBar, SlideInOnView) · `data-display` (SimpleTable, DateDisplay,
CountDown) · `layout` (PageWrapper, SocialIcons) · `navigation` (NavBarItem, Menu,
SideBarNavItem, AdminNav, NavBarTitle, NavTooltip, SubPageNavBar,
SubPageNavBarItem, ReportButton).

Read each component's `<Name>.d.ts` for its exact props and `<Name>.prompt.md`
for usage before composing it. The stylesheet of record is `styles.css` and its
imports (`fonts/fonts.css`, `_ds_bundle.css`).

## Conventions worth copying

- **Form controls take `name`** and render their own `<label>` from `label` — no
  separate label element.
- **Every field is the same 56px shell** — `TextInput`, `Textarea`,
  `NumberInput`, `DateInput`, `SelectString`, `SelectNumber`, `ColorInput`,
  `FileInput`, `Dropdown`, `SearchableDropdown` — with a label that floats above
  the value. Pass `background="raised"` on any of them when the field sits on
  `--surface-raised`, so it stays distinguishable.
- **There is no outline/ghost button.** Every action is a filled `Button`:
  `primary` for the main action on a view, `secondary` for everything beside it.
  Don't invent a bordered variant — the design system deliberately has two
  action tiers, both filled.
- `Button`'s `color` is `primary | secondary | green | red`; `green` is confirm,
  `red` is destructive.
- Composition beats new markup: `SubPageNavBarItem` only lays out inside
  `SubPageNavBar`; header-item popups belong in `PageWrapper`'s `headerItem`.

## Known rough edges (don't imitate, don't "fix" in a design)

- `Slider`'s `secondary` variant is invisible on the app surface; use `primary`,
  `red` or `white`.
- `SimpleTable`'s `links` prop wraps `<tr>` in an `<a>`, which browsers hoist out
  of the table — avoid it.
