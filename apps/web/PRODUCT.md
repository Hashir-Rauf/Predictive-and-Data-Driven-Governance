# Product

## Register

product

## Users

Government officials using this during work hours on desktop, in three roles: ministry administrators (national oversight, full data access, can trigger recomputes and review the audit log), municipal/regional viewers (scoped to their own region, reviewing local demand trends and anomalies), and SOE analysts (scoped to their own utility/transport enterprise). Their job on any given screen is to check whether something needs attention (a forecast, an anomaly, a budget variance) and decide whether to act on it or escalate it. They need to trust the numbers enough to put them in front of their own superiors.

## Product Purpose

Predictive Governance Dashboard turns Uzbekistan public-agency and SOE data into real statistical forecasts, real anomaly flags, and grounded (non-hallucinated) natural-language policy narratives in Uzbek, Russian, and English. It exists to move public-sector decision-making from reactive to predictive. Success looks like an official glancing at the National Overview and immediately knowing what's trending, what's anomalous, and whether last week's forecast was any good, without needing to interpret a black box.

## Brand Personality

Rigorous, transparent, unadorned. This is an official instrument, not a consumer product, an engineered document rather than a themed app. Every visual decision should read as "built for accuracy" rather than "built to impress." Confidence comes from precision (hairline structure, exact numbers, sourced claims) rather than from visual flourish.

## Anti-references

Explicitly not: generic AI-generated SaaS dashboards (gradient hero sections, glassmorphism cards, bento grids, purple/blue glow accents, rounded-everything softness), consumer productivity tools (Notion/Linear-style airy minimalism), and anything that substitutes decoration for information density. A reviewer should never be able to say "this looks AI-generated." No dark mode. Established direction: "Swiss Industrial Print", light-only, zero border-radius, hairline dividers, a single blue accent, monospace for metadata.

## Design Principles

- Every number on screen must be traceable to a source (table, tooltip, or grounding panel) — never an unsourced statistic.
- Status color (good/warning/serious/critical) is reserved exclusively for real severity state, always paired with a label, never decorative.
- Precision over decoration: hairline borders and grid structure carry hierarchy, not shadows or color washes.
- One accent color, used identically everywhere it appears — never expanded into a secondary decorative palette.
- Legible at a glance for a time-pressed official scanning between meetings, not a marketing first-impression moment.

## Accessibility & Inclusion

WCAG AA contrast minimum throughout (validated against the dataviz palette's contrast rules already applied to charts). Status is never color-only — every severity indicator is icon plus text label. All interactive controls (selects, buttons) must be keyboard-operable with visible focus states. Trilingual by requirement (Uzbek, Russian, English), so layout must not assume Latin-script text lengths only.
