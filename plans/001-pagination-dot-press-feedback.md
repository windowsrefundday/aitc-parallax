# 001 — Add pagination dot press feedback

- **Status**: DONE
- **Commit**: 2494ff5
- **Severity**: LOW
- **Category**: Physicality & feedback
- **Estimated scope**: 1 file, 6–10 CSS lines

## Problem

The project and breakthrough pagination controls use the shared `.dot` rule in `styles.css:704-726`. Hover, focus, and selected states scale the dot to `1.2`, but pressing a dot has no immediate tactile response. These controls are already buttons in `index.html:108-113` and the breakthrough pagination markup, so the missing state is interaction feedback rather than a navigation problem.

Current code:

```css
/* styles.css:704-726 — current */
.dot {
  position: relative;
  width: 0.72rem;
  height: 0.72rem;
  cursor: pointer;
  background: rgba(255, 243, 203, 0.28);
  border: 0;
  border-radius: 50%;
  padding: 0;
  transition: background 200ms ease, transform 200ms var(--ease-out);
}

.dot:hover,
.dot:focus-visible,
.dot.is-active {
  background: var(--cream);
  transform: scale(1.2);
}
```

## Target

Keep the existing hover/focus/selected scale. Add a subtle press compression and make the transform response use the existing fast duration token.

```css
/* target */
.dot {
  transition: background 200ms ease, transform var(--motion-fast) var(--ease-out);
}

.dot:hover,
.dot:focus-visible,
.dot.is-active {
  background: var(--cream);
  transform: scale(1.2);
}

.dot:active {
  transform: scale(0.94);
}
```

In the existing `@media (prefers-reduced-motion: reduce)` block at `styles.css:1688-1734`, preserve color/selected-state feedback but disable movement:

```css
@media (prefers-reduced-motion: reduce) {
  /* existing transition reset remains */
  .dot:hover,
  .dot:focus-visible,
  .dot:active,
  .dot.is-active {
    transform: none;
  }
}
```

## Repo conventions to follow

- Motion tokens are defined at `styles.css:17-21`; use `var(--motion-fast)` (`160ms`) and `var(--ease-out)` (`cubic-bezier(0.23, 1, 0.32, 1)`).
- Existing controls use explicit property transitions rather than `transition: all`; imitate `.experience-choice` at `styles.css:1252-1280`.
- Reduced-motion overrides live in the existing media block at `styles.css:1688-1734`; extend that block rather than adding a second global block.

## Steps

1. In `styles.css:704-713`, change only the `.dot` transform transition duration from `200ms` to `var(--motion-fast)`.
2. Immediately after the existing `.dot:hover, .dot:focus-visible, .dot.is-active` rule, add `.dot:active { transform: scale(0.94); }`.
3. In the existing reduced-motion media block, add `.dot:hover, .dot:focus-visible, .dot:active, .dot.is-active { transform: none; }` so the new press state, existing hover state, and selected state do not move under reduced motion.
4. Do not alter pagination JavaScript, card positions, selected-state semantics, or the breakthrough rail.

## Boundaries

- Do not touch `script.js`, `fx-engine.js`, or the HTML structure.
- Do not change the selected-state scale, dot size, hit area, color, or scroll behavior.
- Do not add a new easing or duration token.
- If the cited `.dot` rules have changed since commit `2494ff5`, stop and report the drift instead of improvising.

## Verification

- **Mechanical**: Run `git diff --check`; expected result is no whitespace errors. Run `node --check script.js && node --check fx-engine.js`; expected result is no syntax output.
- **Feel check**: Open the page in WebKit at desktop and mobile widths. Click a project dot and a breakthrough dot. During the pointer press, the dot should compress to approximately `0.94`; after release, the selected dot should settle at `1.2` and the rail should still select the same card.
- **Keyboard check**: Focus a dot and activate it with Space/Enter. Focus styling must remain visible; press feedback must not move the dot under reduced motion.
- **Reduced-motion check**: Enable `prefers-reduced-motion: reduce`, activate each dot, and confirm color/selection feedback remains while `transform` stays `none`.
- **Done when**: Both shared dot groups have tactile press feedback, no navigation behavior changed, and reduced motion contains no dot movement.
