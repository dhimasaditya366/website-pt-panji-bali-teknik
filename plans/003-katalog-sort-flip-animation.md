# 003 — Animate product card reordering on katalog.html sort

- **Status**: DONE
- **Commit**: no-git (working directory has no `.git`; snapshot taken 2026-07-22)
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Interruptibility
- **Estimated scope**: 1 file (`katalog.html`), 1 inline `<script>` block

## Problem

Clicking a sort button ("Populer", "Terbaru", "Harga Terendah") re-parents every product card into its new DOM order with zero visual transition — the whole grid teleports instantly:

```js
// katalog.html:394-395 — current
const sortFn = sorters[btn.dataset.sort] || sorters.default;
sortFn(cards).forEach((card) => grid.appendChild(card));
```

This is a state change that teleports at exactly the moment the user's attention is on the grid (they just clicked a sort button and are watching it), which the audit playbook calls out directly under "Missed opportunities": state changes that teleport where a brief transition would prevent a jarring change.

## Target

Implement the FLIP technique (First, Last, Invert, Play): record each card's position before reordering, reorder the DOM, then for each card compute the delta between old and new position, apply it as an instant inverse `transform`, and transition that transform back to `translate(0, 0)` on the next frame. This uses a CSS transition (interruptible — clicking a different sort button mid-animation retargets smoothly instead of restarting from a keyframe zero).

```js
// katalog.html — target, replacing the toolbar click handler body
toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;

    toolbar.querySelectorAll('.sort-btn').forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-pressed', String(active));
        b.classList.toggle('bg-primary', active);
        b.classList.toggle('text-on-primary', active);
        b.classList.toggle('bg-surface-container-highest', !active);
        b.classList.toggle('text-on-surface-variant', !active);
    });

    // FLIP: record First position of every card.
    const firstRects = new Map(cards.map((card) => [card, card.getBoundingClientRect()]));

    const sortFn = sorters[btn.dataset.sort] || sorters.default;
    sortFn(cards).forEach((card) => grid.appendChild(card));

    // Last: read new position, Invert: jump back visually via transform, Play: animate to identity.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cards.forEach((card) => {
        const first = firstRects.get(card);
        const last = card.getBoundingClientRect();
        const deltaX = first.left - last.left;
        const deltaY = first.top - last.top;
        if (!deltaX && !deltaY) return;

        if (prefersReducedMotion) return;

        card.style.transition = 'none';
        card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        card.getBoundingClientRect(); // force reflow so the invert applies before the next line
        card.style.transition = 'transform 300ms var(--ease-in-out)';
        card.style.transform = '';
    });

    if (!prefersReducedMotion) {
        cards.forEach((card) => {
            card.addEventListener('transitionend', function handler() {
                card.style.transition = '';
                card.removeEventListener('transitionend', handler);
            }, { once: true });
        });
    }
});
```

Duration: 300ms (top of the "Dropdowns, selects" budget from the audit playbook, appropriate here since up to 6 cards are moving simultaneously across a full grid — longer would feel sluggish, shorter would be too abrupt for a multi-element reflow). Easing: `var(--ease-in-out)` (on-screen movement, matching the audit playbook's easing decision order) — requires Plan 005 to already exist (`assets/css/motion.css` linked in `katalog.html`'s `<head>`).

## Repo conventions to follow

- The existing sort script (`katalog.html:344-398`) already reads `window.matchMedia('(prefers-reduced-motion: reduce)')` conventions elsewhere in this codebase (`layanan-teknis.html:311`) — reuse that exact media query string.
- Keep the existing `cards` / `originalOrder` / `sorters` variables and the active-button class toggling exactly as they are — only the final `sortFn(cards).forEach(...)` line and everything below it changes.

## Steps

1. Open `katalog.html` and locate the inline `<script>` block starting around line 344 (search for `const grid = document.getElementById('productGrid');` if the line number has shifted due to earlier plans).
2. Inside the `toolbar.addEventListener('click', ...)` handler, insert the FLIP "First" capture (`const firstRects = new Map(...)`) immediately before the existing `const sortFn = ...` line.
3. Immediately after the existing `sortFn(cards).forEach((card) => grid.appendChild(card));` line, add the FLIP "Last / Invert / Play" block shown in Target, including the `prefersReducedMotion` check and the `transitionend` cleanup listener.
4. Do not remove or reorder any of the existing code above the insertion points (`cards`, `originalOrder`, `sorters` definitions, and the active-button class toggling loop stay exactly where they are).

## Boundaries

- Do NOT change the `sorters` object's sort logic — only the animation around the reorder changes.
- Do NOT add a new animation library or dependency — this uses only the native `getBoundingClientRect()` / inline `style.transform` / `transitionend` APIs already available.
- Do NOT animate anything when `prefers-reduced-motion: reduce` is set — cards should still reorder correctly and instantly, just without the FLIP transform.
- If `katalog.html`'s sort script has drifted from the current-code shown in Problem (e.g. variable names changed), STOP and report instead of improvising a different integration point.

## Verification

- **Mechanical**: open `katalog.html` in a browser, open the console, click each of the four sort buttons in sequence and confirm no JavaScript errors are thrown.
- **Feel check**: click "Harga Terendah" and watch the cards slide smoothly into price order instead of jumping; click a different sort button again while the first animation is still playing (spam-click 2-3 sort buttons quickly) and confirm cards smoothly redirect toward their new target position rather than snapping or restarting from a frozen mid-state. In DevTools, set the Animations panel playback rate to 10% and confirm each card moves in a straight line from its old grid cell to its new one (no arcing, no rotation). Toggle "Emulate CSS media feature prefers-reduced-motion: reduce" in the Rendering tab and confirm sorting still works (cards land in the correct new order) but with no sliding motion.
- **Done when**: sorting visibly slides cards to their new positions at 300ms with the `var(--ease-in-out)` curve, rapid re-sorting never snaps or freezes, and reduced-motion sorting is instant with correct final order.
