# 004 — Animate the mobile menu open/close

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: MEDIUM
- **Category**: Missed opportunity
- **Estimated scope**: 8 HTML files (identical markup restructure), `assets/js/site.js`, `assets/css/motion.css`
- **Depends on**: Plan 005 (shared easing tokens) must be applied first — this plan's CSS uses `var(--ease-out)` / `var(--ease-in-out)` and appends to `assets/css/motion.css`, which Plan 005 creates.

## Problem

The mobile nav menu (identical markup on all 8 pages) opens and closes by instantly toggling `hidden` ↔ `flex` — no motion at all, despite being the primary navigation control every mobile visitor uses on every page:

```html
<!-- index.html — current -->
<button aria-expanded="false" aria-label="Buka menu" class="md:hidden w-10 h-10 flex items-center justify-center text-primary" id="mobile-menu-btn">
<span class="material-symbols-outlined icon-open">menu</span>
<span class="material-symbols-outlined icon-close hidden">close</span>
</button>
...
<div class="hidden md:hidden mt-4 pb-2 flex-col gap-1 border-t border-outline-variant pt-4" id="mobile-menu">
<a class="font-label-md text-secondary font-bold py-2" href="index.html">Beranda</a>
<a class="font-label-md text-on-surface py-2" href="katalog.html">Produk</a>
<a class="font-label-md text-on-surface py-2" href="layanan.html">Layanan</a>
<a class="font-label-md text-on-surface py-2" href="tentang-kami.html">Tentang Kami</a>
<a class="font-label-md text-on-surface py-2" href="kontak.html">Hubungi Kami</a>
<a class="mt-2 bg-secondary text-on-primary text-center px-lg py-2.5 font-button rounded" href="katalog.html">Rent Now</a>
</div>
```

```js
// assets/js/site.js:22-38 — current
const menuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (menuBtn && mobileMenu) {
    const setMenuOpen = (open) => {
        mobileMenu.classList.toggle('hidden', !open);
        mobileMenu.classList.toggle('flex', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        const openIcon = menuBtn.querySelector('.icon-open');
        const closeIcon = menuBtn.querySelector('.icon-close');
        if (openIcon && closeIcon) {
            openIcon.classList.toggle('hidden', open);
            closeIcon.classList.toggle('hidden', !open);
        }
    };
    menuBtn.addEventListener('click', () => {
        setMenuOpen(mobileMenu.classList.contains('hidden'));
    });
```

## Target

Use the CSS Grid `grid-template-rows: 0fr → 1fr` technique to animate height without a hardcoded pixel guess (the menu's content height is intrinsic and can change per-page in the future). This requires wrapping the menu's existing links in one inner `<div>` (a `min-height: 0` child is required for the grid-row track to actually collapse).

```html
<!-- index.html and all 7 other pages — target -->
<div class="md:hidden mobile-menu-collapse" id="mobile-menu">
<div class="flex flex-col gap-1 mt-4 pb-2 border-t border-outline-variant pt-4">
<a class="font-label-md text-secondary font-bold py-2" href="index.html">Beranda</a>
<a class="font-label-md text-on-surface py-2" href="katalog.html">Produk</a>
<a class="font-label-md text-on-surface py-2" href="layanan.html">Layanan</a>
<a class="font-label-md text-on-surface py-2" href="tentang-kami.html">Tentang Kami</a>
<a class="font-label-md text-on-surface py-2" href="kontak.html">Hubungi Kami</a>
<a class="mt-2 bg-secondary text-on-primary text-center px-lg py-2.5 font-button rounded" href="katalog.html">Rent Now</a>
</div>
</div>
```

(Note: the exact `<a>` tags inside vary slightly per page — e.g. `katalog.html`'s active-page link is bold instead of `index.html`'s — only wrap them in the new inner `<div>` and change the outer div's classes; do not alter which link is bold/active on each page.)

```css
/* assets/css/motion.css — append this block (after the :root block from Plan 005) */
.mobile-menu-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: grid-template-rows 250ms var(--ease-in-out), opacity 200ms var(--ease-out);
}
.mobile-menu-collapse > div {
  overflow: hidden;
  min-height: 0;
}
.mobile-menu-collapse.mobile-menu-open {
  grid-template-rows: 1fr;
  opacity: 1;
}
@media (prefers-reduced-motion: reduce) {
  .mobile-menu-collapse {
    transition: opacity 200ms ease;
  }
}
```

```js
// assets/js/site.js — target
const menuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
if (menuBtn && mobileMenu) {
    const setMenuOpen = (open) => {
        mobileMenu.classList.toggle('mobile-menu-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        const openIcon = menuBtn.querySelector('.icon-open');
        const closeIcon = menuBtn.querySelector('.icon-close');
        if (openIcon && closeIcon) {
            openIcon.classList.toggle('hidden', open);
            closeIcon.classList.toggle('hidden', !open);
        }
    };
    menuBtn.addEventListener('click', () => {
        setMenuOpen(!mobileMenu.classList.contains('mobile-menu-open'));
    });
```

Everything below this point in `site.js` (the `mobileMenu.querySelectorAll('a').forEach(...)` auto-close-on-link-click block and the resize handler) stays exactly as-is — both already call `setMenuOpen(false)`, which continues to work correctly against the new `mobile-menu-open` class.

Duration/easing: 250ms `var(--ease-in-out)` for the height track (the audit playbook's "Dropdowns, selects" budget is 150–250ms; this is a slightly larger panel so it sits at the top of that range), 200ms `var(--ease-out)` for opacity (entering fades in slightly faster than the height settles, a common easing-pairing trick that reads as snappier).

## Repo conventions to follow

- `assets/css/motion.css` is created by Plan 005 for the `:root` easing variables — this plan appends to that same file rather than creating a second stylesheet.
- The `icon-open`/`icon-close` swap in `site.js` already works correctly via simple `hidden` toggling and is untouched by this plan — only the panel's own `hidden`/`flex` toggle is replaced.
- CSS transitions (not `@keyframes`) are used here specifically because the menu can be opened and closed in rapid succession (a user tapping the hamburger twice quickly) — transitions retarget smoothly from whatever `grid-template-rows`/`opacity` value they're currently at, per the audit playbook's interruptibility rule.

## Steps

1. Apply Plan 005 first if not already done (this plan's CSS references `var(--ease-out)` / `var(--ease-in-out)` and appends to the file Plan 005 creates).
2. In each of the 8 HTML files, find the `id="mobile-menu"` div. Change its class attribute from `hidden md:hidden mt-4 pb-2 flex-col gap-1 border-t border-outline-variant pt-4` to `md:hidden mobile-menu-collapse`, then wrap all of its existing `<a>` children in one new `<div class="flex flex-col gap-1 mt-4 pb-2 border-t border-outline-variant pt-4">...</div>`, moving the `mt-4 pb-2 flex-col gap-1 border-t border-outline-variant pt-4` classes (as `flex flex-col gap-1 mt-4 pb-2 border-t border-outline-variant pt-4`) onto that new inner div. Keep every `<a>` tag and its classes/href exactly as they already are per page.
3. Append the CSS block shown in Target to `assets/css/motion.css`.
4. In `assets/js/site.js`, replace the `setMenuOpen` function body and the click handler's `setMenuOpen(...)` argument exactly as shown in Target. Do not touch anything else in the file.

## Boundaries

- Do NOT change which nav link is bold/active per page, or any link's `href`.
- Do NOT touch the `icon-open`/`icon-close` hamburger↔close swap logic.
- Do NOT touch the "Smooth scroll", "image fallback", or "Dynamic copyright year" blocks in `site.js`.
- Do NOT add JavaScript height measurement (`scrollHeight`) — the grid-rows technique avoids needing it; if a step doesn't work without it, STOP and report rather than introducing a hardcoded pixel height.

## Verification

- **Mechanical**: open each of the 8 pages at a mobile viewport width (e.g. 375px in DevTools device toolbar), confirm no console errors, and confirm the page still renders the collapsed menu as zero height (no visible gap between the nav and the hero section below it) before the menu button is clicked.
- **Feel check**: click the hamburger icon and confirm the menu smoothly expands open (height animates from 0, content fades in) rather than snapping open; click it again and confirm it smoothly collapses. Click a link inside the open menu and confirm it closes (via the existing auto-close-on-click behavior) with the same smooth collapse. Rapidly double-click the hamburger and confirm the menu doesn't glitch, freeze, or snap — it should smoothly reverse direction. In DevTools Rendering tab, emulate `prefers-reduced-motion: reduce`, reload, and confirm the menu still opens/closes correctly (instantly or near-instantly, via the 200ms opacity-only fallback) with no height "jump" artifact.
- **Done when**: the menu animates open/close smoothly at default motion settings, rapid double-clicks never glitch, and reduced-motion users get a functional (if less elaborate) open/close with no layout jump.
