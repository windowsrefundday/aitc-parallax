# 004 — Stage board member information

- **Status**: DONE
- **Commit**: 2494ff5
- **Severity**: LOW
- **Category**: Cohesion & spatial consistency
- **Estimated scope**: 1 file, 14–20 CSS lines

## Problem

The board cards already enter with a deliberate card-level stagger. The markup in `index.html:289-334` applies `.reveal` and delays of `0ms`, `80ms`, `160ms`, and `240ms` to the four member cards. Each card currently reveals its portrait and text as one unit.

Current board motion:

```css
/* styles.css:1355-1386 — current */
.board-member {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.portrait-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1), filter 400ms ease;
  filter: contrast(1.04) brightness(0.96);
}

.board-member:hover .portrait-img {
  transform: scale(1.04);
  filter: contrast(1.08) brightness(1);
}
```

```css
/* styles.css:1388-1394 — current */
.member-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0.85rem;
  width: 100%;
}
```

The parent `.reveal` transition at `styles.css:1537-1549` already moves the entire card with opacity and `translate3d`. The information block needs a short, local follow-through, not a second large entrance.

## Target

Keep the existing card-level reveal and per-card delays. Make each member's text begin `60ms` after that card's reveal delay, using only opacity and a `0.75rem` vertical offset.

```css
/* target */
.member-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 0.85rem;
  width: 100%;
  opacity: 0;
  transform: translate3d(0, 0.75rem, 0);
  transition:
    opacity var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
  transition-delay: calc(var(--reveal-delay, 0ms) + 60ms);
}

.board-member.in .member-info {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
```

Add a reduced-motion reset in the existing media query at `styles.css:1688-1734`:

```css
@media (prefers-reduced-motion: reduce) {
  .member-info {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

## Repo conventions to follow

- The board already uses `--reveal-delay` in `index.html:295-334`; inherit that property rather than inventing per-card selectors.
- Use `var(--motion-base)` (`220ms`) and `var(--ease-out)` from `styles.css:17-21` for this small entrance. The existing card reveal remains `var(--motion-reveal)`.
- Animate only `opacity` and `transform`, matching the performance rule and existing `.reveal` implementation.
- Keep the existing portrait hover treatment at `styles.css:1374-1386` untouched; it serves a separate pointer-feedback purpose.

## Steps

1. Extend `.member-info` at `styles.css:1388-1394` with the target opacity, transform, explicit transition, and inherited delay.
2. Add `.board-member.in .member-info` immediately after `.member-info` to establish the settled state once the existing observer adds `.in`.
3. Add the reduced-motion `.member-info` reset to the existing reduced-motion block.
4. Do not change the board HTML, card-level reveal delays, portrait crop, hover scale, or member copy.

## Boundaries

- Do not add a new keyframe or JavaScript observer.
- Do not animate width, height, margin, padding, filter, or layout properties.
- Do not alter the existing portrait hover duration or cubic-bezier.
- Do not change grid columns or mobile board layout.
- If `.board-member` no longer receives `.in` from the existing reveal observer at commit `2494ff5`, stop and report drift.

## Verification

- **Mechanical**: Run `git diff --check`; expected result is no whitespace errors. Run `node --check script.js && node --check fx-engine.js`; expected result is no syntax output.
- **Feel check**: In WebKit, scroll to the board section and observe each card. The portrait/card should begin first; the name and supporting text should follow roughly `60ms` later. The total effect must stay compact and must not delay reading once visible.
- **Stagger check**: Confirm the four cards still begin at their existing `0/80/160/240ms` delays; the new `60ms` offset is relative to each card, not a global delay that makes the fourth card excessively late.
- **Interaction check**: Hover a portrait after entrance. The existing `scale(1.04)` and filter transition must remain unchanged.
- **Responsive check**: Verify desktop and mobile board layouts; no card height or grid reflow should occur after the text settles.
- **Reduced-motion check**: Enable `prefers-reduced-motion: reduce`; portrait and text must be immediately visible with no transform, opacity, or delay.
- **Done when**: Board cards retain their existing stagger while each card's text follows its portrait with a restrained, non-layout-affecting entrance.
