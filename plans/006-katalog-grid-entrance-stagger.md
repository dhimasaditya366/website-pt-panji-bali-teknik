# 006 — Staggered entrance for the katalog product grid

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: LOW (additive / missed opportunity)
- **Category**: Missed opportunity
- **Estimated scope**: `assets/css/motion.css` only
- **Depends on**: Plan 005 (shared easing tokens) must be applied first — this plan's CSS uses `var(--ease-out)`.

## Problem

`katalog.html`'s product grid (`id="productGrid"`, currently 6 `.equipment-card` elements, e.g. `katalog.html:133`) appears fully rendered with zero entrance motion on page load — every card is simply present in the first paint. This is the only page-load moment on the site with no motion at all; `layanan-teknis.html` already sets a precedent for a scroll-triggered reveal on its bento grid (`layanan-teknis.html:17` `.reveal-on-scroll`), but the catalog page (the site's primary commerce surface) has nothing.

## Target

A CSS-only staggered fade+rise on page load, using `@keyframes` (appropriate here specifically because this is a one-shot mount animation that never repeats or gets interrupted — unlike the sort reordering in Plan 003, nothing retriggers this).

```css
/* assets/css/motion.css — append this block */
@keyframes card-enter {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: none; }
}
#productGrid > .equipment-card {
  animation: card-enter 500ms var(--ease-out) both;
}
#productGrid > .equipment-card:nth-child(1) { animation-delay: 0ms; }
#productGrid > .equipment-card:nth-child(2) { animation-delay: 60ms; }
#productGrid > .equipment-card:nth-child(3) { animation-delay: 120ms; }
#productGrid > .equipment-card:nth-child(4) { animation-delay: 180ms; }
#productGrid > .equipment-card:nth-child(5) { animation-delay: 240ms; }
#productGrid > .equipment-card:nth-child(6) { animation-delay: 300ms; }
@media (prefers-reduced-motion: reduce) {
  #productGrid > .equipment-card {
    animation: none;
  }
}
```

60ms stagger per card (within the audit playbook's 30–80ms recommended range), 500ms rise+fade per card (marketing/explanatory duration budget, "can be longer" than the 300ms UI cap), `var(--ease-out)` (entering content).

## Repo conventions to follow

- `assets/css/motion.css` is the shared stylesheet created by Plan 005 and already linked from `katalog.html`'s `<head>` — append to it rather than adding a new `<style>` block.
- `.equipment-card` is the existing class already present on every product card (`katalog.html:133`, `156`, `179`, `202`, `225`, `248`) — no new class or markup change is needed on the HTML side, only CSS.

## Steps

1. Apply Plan 005 first if not already done (this plan's CSS uses `var(--ease-out)` and appends to the file Plan 005 creates).
2. Append the CSS block shown in Target to `assets/css/motion.css`.
3. Do not edit `katalog.html` itself — the existing `#productGrid > .equipment-card` structure is sufficient for the CSS selectors above to apply with no markup changes.

## Boundaries

- Do NOT touch the sort script (Plan 003's territory) — confirm compatibility only: Plan 003 reorders cards via `appendChild` and briefly sets an inline `style.transform` during its FLIP animation. Since this plan's entrance animation uses `animation-fill-mode: both` (which holds `transform: none` as a filled end-state, not an ongoing animation), Plan 003's inline `style.transform` correctly overrides it during a sort, and reverts cleanly afterward — no conflict, no changes needed to reconcile them.
- Do NOT add delay rules beyond `:nth-child(6)` — if the catalog grows past 6 cards in the future, a 7th+ card simply animates with no delay (0ms, same as the first card) rather than guessing a value; that is an accepted, minor scope limit, not a bug to fix here.
- Do NOT apply this same treatment to any other page's card grids (e.g. the homepage's 3-card catalog preview or the "Kenapa Memilih Kami?" section) — this plan is scoped to `katalog.html`'s full product grid only, the one genuine "teleporting" gap identified in the audit.

## Verification

- **Mechanical**: reload `katalog.html` and confirm the CSS parses with no console errors (an invalid `@keyframes` block would silently no-op, so specifically check DevTools Elements panel that `#productGrid > .equipment-card` computed styles show a non-`none` `animation-name` of `card-enter`).
- **Feel check**: hard-refresh `katalog.html` (disable cache) and watch the 6 product cards fade and rise into place in a left-to-right, top-to-bottom cascade rather than all appearing simultaneously. In DevTools Animations panel, set playback to 10% and confirm each card's delay is offset by roughly 60ms from the previous one and none of them pop in with a hard cut. Click a sort button immediately after the page loads (while the entrance animation might still be finishing) and confirm the sort's FLIP reorder (Plan 003) still works correctly with no visual glitch. Toggle `prefers-reduced-motion: reduce` in the Rendering tab, reload, and confirm all 6 cards are simply visible immediately with no fade/rise and no delay-related blank flash.
- **Done when**: the catalog grid visibly cascades in on load at default motion settings, and appears instantly (no animation, no flash of invisible content) under reduced motion.
