# 001 — Replace `transition-all` with scoped transitions sitewide

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 8 HTML files, ~66 class-attribute edits + 1 raw CSS edit + 2 icon-nudge restructures
- **Depends on**: Plan 005 (shared easing tokens) must be applied first — this plan's kontak.html step assumes `var(--ease-in-out)` already exists.

## Problem

`transition-all` (Tailwind's `transition-property: all`) is used on roughly 66 elements across every page — nav bars, every button, every card, footer links, form inputs, badges. Per the audit playbook: "`transition: all` animates unintended properties off-GPU — always a finding." Example:

```html
<!-- index.html:16 — current -->
<nav class="site-nav fixed top-0 w-full z-[60] bg-white/95 backdrop-blur-sm border-b border-outline-variant px-margin-mobile md:px-margin-desktop py-4 transition-all">
```

```html
<!-- index.html:159 — current -->
<div class="bg-white p-lg rounded-xl border border-outline-variant hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
```

```css
/* kontak.html:19 — current */
.card-hover:hover {
    transform: translateY(-4px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

Two elements animate `gap` (a layout property) via `transition-all` for an icon-nudge effect:

```html
<!-- index.html:185 — current -->
<a class="text-secondary font-button flex items-center gap-xs hover:gap-sm transition-all font-bold" href="katalog.html">
    Lihat Semua Produk <span class="material-symbols-outlined">chevron_right</span>
</a>
```

```html
<!-- layanan-teknis.html:119 — current -->
<a class="text-secondary-fixed font-button text-button flex items-center gap-xs hover:gap-md transition-all" href="katalog.html">Lihat Katalog <span class="material-symbols-outlined">arrow_forward</span></a>
```

The `nav.site-nav` element (identical markup repeated on all 8 pages) is a special case: `assets/js/site.js:6-12` toggles `py-4` ↔ `py-3` (padding, a layout property) and `shadow-xl` (box-shadow) based on scroll position, so its transition needs padding included — plain `transition` (Tailwind's default subset, see Target) does not cover padding.

## Target

**General rule** (applies to every occurrence not listed as a special case below): replace the class `transition-all` with the class `transition` (Tailwind's own default, curated utility — NOT a custom class). Tailwind's default `transition` utility sets:
```css
transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
transition-duration: 150ms;
```
This already covers every property this codebase actually animates via hover/active/group-hover (color, background-color, border-color, box-shadow, transform, filter for `brightness()`) — with zero markup or behavior change other than dropping the unused properties (margin, width, height, padding, etc.) from the transition. Any existing `duration-300`/`duration-500`/`duration-700` class alongside `transition-all` is untouched — it overrides the 150ms default exactly as it does today.

**Special case 1 — `nav.site-nav`** (appears once per page, 8 occurrences total, identical markup):
```html
<!-- target -->
<nav class="site-nav fixed top-0 w-full z-[60] bg-white/95 backdrop-blur-sm border-b border-outline-variant px-margin-mobile md:px-margin-desktop py-4 transition-[padding,box-shadow]">
```

**Special case 2 — icon-nudge links** (2 occurrences): stop animating `gap` and instead slide the icon itself via `transform`, matching the pattern already used correctly elsewhere in this codebase (e.g. the footer nav links' `group-hover:translate-x-1 transition-transform` on their arrow icons, see Repo conventions below).

```html
<!-- index.html:185 — target -->
<a class="group text-secondary font-button flex items-center gap-xs font-bold" href="katalog.html">
    Lihat Semua Produk <span class="material-symbols-outlined transition-transform group-hover:translate-x-1">chevron_right</span>
</a>
```

```html
<!-- layanan-teknis.html:119 — target -->
<a class="group text-secondary-fixed font-button text-button flex items-center gap-xs" href="katalog.html">Lihat Katalog <span class="material-symbols-outlined transition-transform group-hover:translate-x-1">arrow_forward</span></a>
```

**Special case 3 — `kontak.html:19` raw CSS** (requires Plan 005 applied first):
```css
/* target */
.card-hover:hover {
    transform: translateY(-4px);
    transition: transform 0.3s var(--ease-in-out);
}
```

## Repo conventions to follow

- The correct icon-nudge pattern already exists in every page's footer, e.g. `index.html:291`: `<li><a class="hover:text-secondary-fixed flex items-center gap-3 transition-colors group" href="index.html"><span class="material-symbols-outlined text-xs group-hover:translate-x-1 transition-transform">arrow_forward</span> Beranda</a></li>` — the icon itself carries `transition-transform` + `group-hover:translate-x-1`, the parent just needs `group`. Special case 2 above imitates this exactly.
- Tailwind's bare `transition` utility (not `transition-all`, not `transition-colors`) is the repo's new default — it is a zero-config Tailwind built-in, not a custom token, so no config change is needed for the general rule.

## Steps

1. In every file, find every occurrence of the literal class token `transition-all` and replace it with `transition`, **except** the two special cases below. Use the file:line list from the Problem/recon pass (current as of this writing; re-verify each line still contains `transition-all` before editing, since earlier plans in this session may have shifted line numbers by a few lines per file):

   - `index.html`: 16(nav→special case 1), 30, 66, 69, 135, 149, 159, 166, 185(→special case 2), 191, 204, 211, 224, 231, 260, 263, 357
   - `katalog.html`: 16(nav→special case 1), 30, 55, 59, 63, 67, 71, 133, 152, 156, 179, 198, 202, 221, 225, 244, 248, 267, 355
   - `kontak.html`: 19(raw CSS→special case 3), 26(nav→special case 1), 40, 200, 204, 292
   - `layanan.html`: 25(nav→special case 1), 39, 78, 91, 104, 154, 242
   - `layanan-teknis.html`: 40(nav→special case 1), 54, 119(→special case 2), 298
   - `tentang-kami.html`: 24(nav→special case 1), 38, 197, 287
   - `detail-penyewaan.html`: 27(nav→special case 1), 41, 115, 119, 123, 127, 137, 185, 286
   - `404.html`: 16(nav→special case 1), 30, 56, 59, 148

2. Apply special case 1 to the one `nav.site-nav` line in each of the 8 files: replace `py-4 transition-all` with `py-4 transition-[padding,box-shadow]`.
3. Apply special case 2 to `index.html:185` and `layanan-teknis.html:119` exactly as shown in Target.
4. Apply special case 3 to `kontak.html`'s `.card-hover:hover` rule exactly as shown in Target (requires Plan 005's `--ease-in-out` variable to already exist in `assets/css/motion.css`, linked from `kontak.html`'s `<head>`).

## Boundaries

- Do NOT touch `duration-300`/`duration-500`/`duration-700` classes — leave them exactly where they are, alongside the new `transition` class.
- Do NOT change any color, spacing, or layout classes other than the `gap-xs`/`hover:gap-sm`/`hover:gap-md` removal in special case 2.
- Do NOT touch `assets/js/site.js` in this plan (the nav's scroll-driven padding/shadow toggle logic itself is out of scope — only the CSS transition-property it relies on changes here).
- If a listed line number doesn't contain `transition-all` (or the raw CSS doesn't contain `transition: all`) when you get there, search the file for the literal string instead of guessing — do not skip the occurrence or invent a fix.

## Verification

- **Mechanical**: `grep -rn "transition-all" *.html` and `grep -rn "transition: all" *.html` from the project root must return zero results when done.
- **Feel check**: reload `index.html`, scroll past 50px and confirm the nav still shrinks (py-4→py-3) and gains a shadow smoothly, with no visible change in timing from before. Hover every product card on `index.html` and `katalog.html` and confirm the lift/zoom/shadow-2xl feedback looks identical to before (only unused properties were dropped from the transition, not the ones actually animating). Hover "Lihat Semua Produk" on `index.html` and "Lihat Katalog" on `layanan-teknis.html` and confirm the arrow icon now slides right on hover instead of the text gap widening — this should look at least as good, ideally better (no layout reflow of the whole row). In DevTools Rendering tab, enable "Paint flashing" and confirm hovering a product card no longer paints the whole row (only the card itself repaints).
- **Done when**: the mechanical grep returns zero results, and all pages visually behave the same on hover/scroll/press as before this plan (no regressions), with the two icon-nudge links now sliding their icon instead of widening the gap.
