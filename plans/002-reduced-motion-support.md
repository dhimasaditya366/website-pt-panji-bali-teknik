# 002 — Add `prefers-reduced-motion` support to every transform-based interaction

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 8 HTML files, ~80 class-attribute edits (mechanical, pattern-based) + 2 raw CSS blocks

## Problem

Only one page (`layanan-teknis.html`) checks `prefers-reduced-motion` anywhere (its `reveal-on-scroll` IntersectionObserver, `layanan-teknis.html:310-311`, and a matching CSS media query). Every other transform-based interaction sitewide — product image zooms, card lifts, button press feedback, icon nudges — has zero accommodation. Examples:

```html
<!-- index.html:159 — current -->
<div class="bg-white p-lg rounded-xl border border-outline-variant hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
```

```html
<!-- index.html:193 — current -->
<img alt="Concrete Vibrator" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" .../>
```

```css
/* kontak.html:19 — current (raw CSS, no Tailwind class involved) */
.card-hover:hover {
    transform: translateY(-4px);
    transition: transform 0.3s var(--ease-in-out);
}
```

```css
/* detail-penyewaan.html:19-20 — current (raw CSS) */
.btn-active-state:active { transform: scale(0.95); transition: transform 0.15s; }
.hover-lift:hover { transform: translateY(-2px); }
```

Per the audit playbook: reduced motion means fewer/gentler animations, not zero — color and shadow feedback should stay, position/scale changes should drop.

## Target

For Tailwind-class-based transforms, use Tailwind's built-in `motion-reduce:` variant (compiles to `@media (prefers-reduced-motion: reduce)`) to neutralize the transform back to its resting value, while leaving color/shadow transitions on the same element untouched. This requires no new dependency — `motion-reduce:` is a stock Tailwind v3 variant.

**General rule**: wherever one of these exact class substrings appears anywhere in the 8 HTML files, append the paired `motion-reduce:` class immediately after it in the same `class` attribute (space-separated):

| Existing class substring (find) | Append this class |
| --- | --- |
| `active:scale-95` | `motion-reduce:active:scale-100` |
| `hover:scale-105` | `motion-reduce:hover:scale-100` |
| `group-hover:scale-110` | `motion-reduce:group-hover:scale-100` |
| `hover:-translate-y-2` | `motion-reduce:hover:translate-y-0` |
| `group-hover:-translate-y-2` | `motion-reduce:group-hover:translate-y-0` |
| `hover:translate-x-2` | `motion-reduce:hover:translate-x-0` |
| `group-hover:translate-x-2` | `motion-reduce:group-hover:translate-x-0` |
| `group-hover:translate-x-1` | `motion-reduce:group-hover:translate-x-0` |

Example application:

```html
<!-- index.html:159 — target -->
<div class="bg-white p-lg rounded-xl border border-outline-variant hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2 motion-reduce:hover:translate-y-0">
```

```html
<!-- index.html:193 — target -->
<img alt="Concrete Vibrator" class="w-full h-full object-cover group-hover:scale-110 motion-reduce:group-hover:scale-100 transition-transform duration-700" .../>
```

For the 2 files with hand-written CSS transforms (not Tailwind classes), add a `@media (prefers-reduced-motion: reduce)` block neutralizing the transform:

```css
/* kontak.html — add this block right after the existing .card-hover:hover rule */
@media (prefers-reduced-motion: reduce) {
    .card-hover:hover { transform: none; }
}
```

```css
/* detail-penyewaan.html — add this block right after the existing .hover-lift:hover rule */
@media (prefers-reduced-motion: reduce) {
    .btn-active-state:active { transform: none; }
    .hover-lift:hover { transform: none; }
}
```

## Repo conventions to follow

- `layanan-teknis.html:27-33` already has exactly this shape of media query for its own component — imitate its placement (inside the same `<style>` block, after the rule it modifies) for the two raw-CSS files.
- Note: `transition-all` becomes plain `transition` if Plan 001 has already run — that class name difference does not affect this plan; append the `motion-reduce:` class regardless of which transition class is present.

## Steps

1. Grep every HTML file for each of the 8 class substrings in the General rule table above (`hover:-translate-y-2`, `group-hover:-translate-y-2`, `hover:translate-x-2`, `group-hover:translate-x-2`, `group-hover:translate-x-1`, `group-hover:scale-110`, `hover:scale-105`, `active:scale-95`) and append the paired `motion-reduce:` class immediately after each match, inside the same `class="..."` attribute. This includes matches inside the footer (repeated on every page) and the two icon-nudge links restructured by Plan 001 (`index.html`, `layanan-teknis.html`) — those also use `group-hover:translate-x-1` and should get `motion-reduce:group-hover:translate-x-0` too.
2. In `kontak.html`, add the `@media (prefers-reduced-motion: reduce)` block shown in Target immediately after the existing `.card-hover:hover` rule, inside the same `<style>` element.
3. In `detail-penyewaan.html`, add the `@media (prefers-reduced-motion: reduce)` block shown in Target immediately after the existing `.hover-lift:hover` rule, inside the same `<style>` element.
4. Do not touch `layanan-teknis.html`'s existing `reveal-on-scroll` reduced-motion handling — it is already correct and exempt from this plan.

## Boundaries

- Do NOT touch `hover:brightness-110`, `hover:bg-*`, `hover:text-*`, `hover:border-*`, `hover:shadow-*`, or any color/shadow-only hover class — those stay animated under reduced motion per the audit ("not zero").
- Do NOT add `motion-reduce:` to the `nav.site-nav` padding/shadow transition — that's a scroll-driven layout shift, not a hover/press gesture, and is out of scope for this plan.
- Do NOT modify `assets/js/site.js` or any JavaScript.
- Any NEW motion introduced by other plans (003 sort FLIP, 004 mobile menu, 006 grid entrance) must bring its own reduced-motion handling as part of those plans — do not retrofit it here since those plans haven't been executed yet when this one runs.

## Verification

- **Mechanical**: `grep -c "motion-reduce:" *.html` — every one of the 8 HTML files should report at least 1 match (the footer arrow icons alone guarantee this). `grep -c "prefers-reduced-motion" kontak.html detail-penyewaan.html` should each report at least 1 (in addition to any pre-existing count).
- **Feel check**: in Chrome DevTools, open the Rendering tab, set "Emulate CSS media feature prefers-reduced-motion" to "reduce", then reload each page and confirm: hovering product cards no longer lifts or zooms the image, but the border/shadow color change still occurs; clicking any button no longer visibly shrinks on press; the footer arrow icons no longer slide right on hover; on `kontak.html`, hovering the four info cards no longer lifts them; on `detail-penyewaan.html`, the submit button no longer shrinks on press. With the emulation turned back to "no preference", confirm every one of those effects returns exactly as it looked before this plan.
- **Done when**: with reduced-motion emulated, no element on any page visibly translates or scales on hover/active/group-hover, while color, background, border-color, box-shadow, and filter transitions still play normally.
