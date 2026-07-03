---
name: Predictive Governance Dashboard
description: A light-only, zero-radius, print-influenced instrument for national forecasting and anomaly review.
colors:
  instrument-blue: "#2563eb"
  cool-canvas: "#f4f5f7"
  clean-sheet: "#ffffff"
  sheet-wash: "#f3f5f8"
  carbon-ink: "#0e1116"
  graphite: "#4b5563"
  pencil-gray: "#8b93a1"
  hairline-rule: "#e5e8ed"
  structural-line: "#d3d8e0"
  status-good: "#0ca30c"
  status-warning: "#fab219"
  status-serious: "#ec835a"
  status-critical: "#d03b3b"
typography:
  display:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Segoe UI Mono', 'SFMono-Regular', Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    letterSpacing: "0.06em"
rounded:
  none: "0px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
  16: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.carbon-ink}"
    textColor: "{colors.sheet-raised}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.instrument-blue}"
  nav-link-active:
    textColor: "{colors.carbon-ink}"
    typography: "{typography.label}"
  status-badge-critical:
    textColor: "{colors.status-critical}"
    typography: "{typography.label}"
---

# Design System: Predictive Governance Dashboard

## 1. Overview

**Creative North Star: "Swiss Industrial Print"**

This is an official instrument, not a themed app. The reference point is a 1960s engineering register or a corporate identity manual: matte paper stock, carbon-black ink, a single functional accent color reserved for the one thing that needs pointing at, and a grid you can feel through the layout even before you read a word on it. Every visual decision should read as "built for accuracy" rather than "built to impress." Confidence comes from precision, hairline structure, exact numbers, sourced claims, never from gradients, glow, or soft affordances.

This system explicitly rejects: gradient hero treatments, glassmorphism, bento-grid card walls, purple or blue glow accents, rounded-everything softness, and dark mode. A reviewer should never be able to say "this looks AI-generated."

**Key Characteristics:**
- Zero border-radius, everywhere, without exception
- One accent color (Instrument Blue), used identically wherever it appears
- Hairline dividers do the separating; borders and shadows do not
- Heavy uppercase system-sans for structural headers, monospace for metadata and data labels
- Status color is reserved for real severity state and always paired with a text label

## 2. Colors

A near-monochrome paper-and-ink base with exactly one functional accent and a fixed four-step status scale that is never reused for anything else.

### Primary
- **Instrument Blue** (#2a78d6): the single interactive/accent color. Active nav state, links, primary chart series, focus rings, hover state on primary buttons. Never expanded into a secondary decorative palette.

### Neutral
- **Document Paper** (#eae8e3): page background. The matte "substrate" everything else sits on.
- **Clean Sheet** (#fcfcfb): card/panel surface, one step lighter than the page, indicating a hairline-bordered content region.
- **Sheet Raised** (#ffffff): the rare fully-white surface, reserved for popover/elevated content (e.g. locale switcher active state background via ink, not white-on-white).
- **Carbon Ink** (#0b0b0b): primary text, headers, primary button fill.
- **Graphite** (#52514e): secondary text, subtitles, body copy that isn't the primary read.
- **Pencil Gray** (#898781): muted text, placeholder-equivalent, least-important labels.
- **Hairline Rule** (#e1e0d9): the default divider weight, used constantly.
- **Structural Line** (#c3c2b7): a stronger divider for primary structural boundaries (page header underline, table header rule, select/input borders).

### Status (fixed; never themed, never reused as a categorical color)
- **Good** (#0ca30c) · **Warning** (#fab219) · **Serious** (#ec835a) · **Critical** (#d03b3b): anomaly severity only. Always rendered as a bordered mono-label chip with a small square icon plus text, never a bare colored dot.

### Named Rules
**The One Accent Rule.** Instrument Blue is the only color that means "interactive" or "emphasis" anywhere in the system. If something needs a second color to stand out, the answer is weight or size, not a new hue.

**The Reserved Status Rule.** The four status colors mean anomaly severity and nothing else. They are never assigned to a generic "series 4" or used as a decorative accent.

## 3. Typography

**Display/Headline Font:** system-ui, -apple-system, "Segoe UI", Roboto, sans-serif (heavy weight, no bundled display face)
**Body Font:** the same system-sans stack, regular weight
**Label/Mono Font:** ui-monospace, "Cascadia Code", "Segoe UI Mono", "SFMono-Regular", Consolas, monospace

**Character:** One sans family carries every weight from body copy to page titles, so hierarchy comes entirely from weight, size, and case, never from switching typefaces. The monospace face is reserved for anything that reads as data: nav labels, table metadata, codes, timestamps, status chips.

### Hierarchy
- **Display** (800, `clamp(2.25rem, 4vw, 3.5rem)`, 1.05, -0.02em): page titles in `PageHeader`, uppercase.
- **Headline** (800, 1.5rem, 1.05, -0.02em, uppercase): section headers within a page.
- **Title** (600, 1.125rem): card/panel sub-headers.
- **Body** (400, 0.9375rem, 1.5 line-height): default running text, sentence case, 65-75ch max width for prose blocks.
- **Label** (500, 0.6875rem, 0.06em tracking, uppercase, monospace): nav items, table headers, form labels, status chips, metadata.

### Named Rules
**The No Display Face Rule.** Every headline is the system sans at heavy weight, never a bundled display or serif font. This is inherited from the dataviz constraint already applied to chart hero figures, and extended to the whole product for consistency.

## 4. Elevation

Flat by default. This system uses hairline borders and background-shade steps (Document Paper → Clean Sheet → Sheet Raised) to convey layering, never a drop shadow. The one exception is a deliberately hard, non-blurred offset (`2px 2px 0 0`, ink-colored) reserved for a genuinely elevated overlay (a dropdown or modal), which reads as a mechanical/printed shadow rather than a soft glow.

### Shadow Vocabulary
- **hard-offset** (`box-shadow: 2px 2px 0 0 var(--color-ink-primary)`, token `--shadow-hard`): the only shadow in the system, for overlays that need to visibly separate from the page (dropdowns, modals). Not currently used anywhere in the shipped UI; reserve it rather than reach for a soft shadow when one is eventually needed.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest, separated by a 1px hairline or a background-shade step. A shadow appears only for a genuinely floating overlay, and even then it is a hard offset, never a blur.

## 5. Components

### Buttons
- **Shape:** zero radius, always.
- **Primary:** Carbon Ink background, Sheet Raised text, monospace label, uppercase, `padding: 12px 16px`, `border: 1px solid var(--color-ink-primary)`.
- **Hover:** background flips to Instrument Blue (not a lighten/darken of ink; a hue change to the one accent, signaling "this is the interactive one").
- **Secondary / outline:** transparent fill, `border: 1px solid var(--color-border)`, ink text; hover fills to Carbon Ink with Sheet Raised text (same treatment as `.nav__logout`, `.anomaly-table__explain`).
- **Disabled:** `opacity: 0.5`, no hover treatment, `cursor: not-allowed`.

### Status Chips
- **Style:** `border: 1px solid currentColor`, monospace uppercase label, an 8px solid square icon (never a rounded dot) plus text, `color` set per severity token.
- **State:** severity is the only variant; there is no "selected" state for a status chip.

### Cards / Panels
- **Corner Style:** zero radius.
- **Background:** Clean Sheet on Document Paper page background.
- **Shadow Strategy:** none; separation comes from the 1px border/hairline (see Elevation).
- **Border:** `1px solid var(--color-border)` for a primary panel (`.hairline-box`, stat tiles), `1px solid var(--color-hairline)` for a lighter internal divider.
- **Internal Padding:** `space-4` to `space-6` (16-24px).

### Inputs / Selects
- **Style:** `border: 1px solid var(--color-border)`, Clean Sheet background, zero radius, body-size text.
- **Focus:** `2px solid var(--color-focus-ring)` outline with `2px` offset (browser-native focus-visible, not a custom glow).
- **Error / Disabled:** error text renders in Critical red below the field; disabled fields drop to 0.5 opacity.

### Navigation
- **Style:** monospace uppercase labels, `border-bottom: 2px solid transparent` at rest, `border-bottom-color: var(--color-accent)` plus Carbon Ink text when active. The page title sits at heavy weight/uppercase on the left; nav links occupy the center; locale switcher and sign-out sit right-aligned.
- **Mobile:** not yet defined as a distinct breakpoint treatment; nav currently assumes desktop-width government-workstation use (see Do's and Don'ts).

## 6. Do's and Don'ts

### Do:
- **Do** keep every corner at 0 radius, no exceptions, including inputs, buttons, chips, and chart tooltips.
- **Do** use Instrument Blue (#2a78d6) as the only accent color anywhere in the UI.
- **Do** pair every status color with a text label; a bare colored dot is never sufficient.
- **Do** use the monospace stack for anything that is data (nav labels, table cells that are codes/IDs/timestamps, metadata) and the sans stack for anything that is prose.
- **Do** separate content with a 1px hairline or a background-shade step before reaching for a border or shadow.

### Don't:
- **Don't** use gradients anywhere, on text, buttons, or backgrounds.
- **Don't** use glassmorphism, `backdrop-filter` blur cards, or any translucency effect.
- **Don't** introduce a second accent hue; if something needs to stand out, change weight or size, not color.
- **Don't** use a soft, blurred `box-shadow` for elevation; the only permitted shadow is the hard 2px offset reserved for overlays.
- **Don't** use border-radius on any element, including "just a little" (2-4px) for softness.
- **Don't** ship dark mode; this system is light-only by product decision.
- **Don't** use a decorative colored dot as a status indicator without an accompanying text label.
