# 005 — Consolidate hand-typed easing curves into shared tokens

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 new file (`assets/css/motion.css`), 1 config file, 8 HTML `<head>` edits, 2 existing `<style>` blocks repointed

## Problem

The codebase has no shared easing/duration tokens. Three near-identical custom curves are hand-typed in different pages, and nothing references a common source:

```css
/* layanan-teknis.html:17 — current */
.reveal-on-scroll {
    transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1), transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
```

```css
/* kontak.html:19 — current (after plan 001 is applied, the "all" becomes "transform"; the bezier itself is untouched by plan 001) */
.card-hover:hover {
    transform: translateY(-4px);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

`assets/js/tailwind-config.js` extends `colors`, `borderRadius`, `spacing`, `fontFamily`, `fontSize` — but has no `transitionTimingFunction` section, so there is no Tailwind-class way to reach for the same curve twice.

## Target

One new shared stylesheet defining the two curves from the audit playbook as CSS custom properties, linked on every page, plus the same curves registered as named Tailwind timing-function utilities so class-based transitions can use them too.

```css
/* assets/css/motion.css — new file, full contents */
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);        /* strong ease-out for entrances/exits */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);     /* strong ease-in-out for on-screen movement */
}
```

```js
/* assets/js/tailwind-config.js — target, inside theme.extend, alongside the existing fontSize block */
transitionTimingFunction: {
    "out-strong": "cubic-bezier(0.23, 1, 0.32, 1)",
    "in-out-strong": "cubic-bezier(0.77, 0, 0.175, 1)"
}
```

```css
/* layanan-teknis.html:17 — target */
.reveal-on-scroll {
    transition: opacity 0.7s var(--ease-out), transform 0.7s var(--ease-out);
}
```

```css
/* kontak.html:19 — target */
.card-hover:hover {
    transform: translateY(-4px);
    transition: transform 0.3s var(--ease-in-out);
}
```

## Repo conventions to follow

- `assets/js/tailwind-config.js` is the existing single source of truth for design tokens (colors, spacing, fonts) — add `transitionTimingFunction` there as a new sibling key inside the same `theme.extend` object, in the same style as the existing `borderRadius` block (`assets/js/tailwind-config.js:55-60`).
- Every page already links `assets/js/site.js` as a shared script at the very end of `<body>` (e.g. `index.html:362`) — the new `assets/css/motion.css` should be linked the same way every page already links shared assets: in `<head>`, immediately after the `tailwind-config.js` `<script>` tag.
- `layanan-teknis.html:17` (`cubic-bezier(0.22, 1, 0.36, 1)`) is close enough to `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`) that this plan replaces it outright rather than keeping a third near-duplicate curve — the audit playbook's exact value always wins over an approximate existing one.

## Steps

1. Create `assets/css/motion.css` with exactly the two-variable `:root` block shown in Target above.
2. In every one of the 8 HTML files (`index.html`, `katalog.html`, `kontak.html`, `layanan.html`, `layanan-teknis.html`, `tentang-kami.html`, `detail-penyewaan.html`, `404.html`), add this line in `<head>` immediately after the `<script src="assets/js/tailwind-config.js"></script>` line:
   ```html
   <link href="assets/css/motion.css" rel="stylesheet"/>
   ```
3. In `assets/js/tailwind-config.js`, inside the `theme.extend` object, add the `transitionTimingFunction` block shown in Target, placed after the existing `fontSize` block (i.e. as the last key before the closing braces of `extend`).
4. In `layanan-teknis.html`, replace the `.reveal-on-scroll` transition declaration (current file: verify it's still at line 17, may have shifted by the amount step 2 added — search for the literal string `cubic-bezier(0.22, 1, 0.36, 1)`) with the Target version using `var(--ease-out)`. Leave the `@media (prefers-reduced-motion: reduce)` block below it (currently `.reveal-on-scroll { transition: opacity 0.3s ease; }` inside the media query) untouched — that's a deliberately simpler fallback curve, not a duplicate to consolidate.
5. In `kontak.html`, replace the `.card-hover:hover` transition declaration (search for the literal string `cubic-bezier(0.4, 0, 0.2, 1)`) with the Target version using `var(--ease-in-out)`. This step assumes plan 001 has already changed `transition: all 0.3s ...` to `transition: transform 0.3s ...` on this line — if the code still says `transition: all`, apply that property fix too as part of this step (end state must match Target exactly either way).

## Boundaries

- Do NOT touch `assets/js/site.js`.
- Do NOT change any Tailwind utility classes in the HTML markup — this plan only touches `<head>` (new stylesheet link), the two raw `<style>` blocks named above, and `tailwind-config.js`.
- Do NOT invent additional easing tokens beyond `--ease-out` / `--ease-in-out` — those are the only two curves the audit playbook specifies.
- Do NOT remove the `@media (prefers-reduced-motion: reduce)` fallback in `layanan-teknis.html`.

## Verification

- **Mechanical**: open each of the 8 HTML files and confirm the new `<link>` tag is present exactly once, directly after the `tailwind-config.js` script tag. Open `assets/css/motion.css` in a browser devtools "Sources" tab on any page and confirm `getComputedStyle(document.documentElement).getPropertyValue('--ease-out')` returns `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Feel check**: on `layanan-teknis.html`, scroll the "Technical Services Bento Grid" section into view and confirm the four cards still fade/rise in exactly as before (the curve barely changed — `0.22,1,0.36,1` vs `0.23,1,0.32,1` are visually indistinguishable, so this should look identical, not different). On `kontak.html`, hover each of the four top info cards and confirm they still lift by 4px smoothly with no visible change in feel from before.
- **Done when**: all 8 pages load `assets/css/motion.css` with no 404 in the Network tab, `tailwind-config.js` parses with no console error (check for a stray comma), and both raw `<style>` blocks reference `var(--ease-out)` / `var(--ease-in-out)` instead of hardcoded bezier strings.
