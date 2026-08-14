# 002 — Add experience tab press feedback

- **Status**: DONE
- **Commit**: 2494ff5
- **Severity**: LOW
- **Category**: Physicality & feedback
- **Estimated scope**: 1 file, 8–12 CSS lines

## Problem

The experience switcher buttons are real tabs in `index.html:267-275`. The active tab changes immediately and `script.js:285-324` already performs an interruptible `160ms` exit followed by a `220ms` enter for the panel content. The tab itself has hover/focus styling but no press compression, so the click currently feels slightly disconnected from the state transition.

Current code:

```css
/* styles.css:1252-1280 — current */
.experience-choice {
  flex: 0 0 auto;
  scroll-snap-align: center;
  padding: 0.45rem 0.85rem;
  color: rgba(255, 243, 203, 0.62);
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 999px;
  font-size: clamp(0.86rem, 1.3vw, 0.98rem);
  font-weight: 500;
  letter-spacing: -0.02em;
  text-align: center;
  white-space: nowrap;
  transition: color 200ms ease, background-color 200ms ease, transform 200ms var(--ease-out);
}

.experience-choice:hover,
.experience-choice:focus-visible {
  color: var(--cream);
  background: rgba(255, 243, 203, 0.1);
}

.experience-choice.is-active {
  color: var(--forest-deep);
  background: var(--cream);
  font-weight: 600;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
}
```

## Target

Use the existing fast press duration and ease-out curve. Compression must be subtle enough that the tab remains legible and does not compete with the panel crossfade.

```css
/* target */
.experience-choice {
  transition: color 200ms ease, background-color 200ms ease, transform var(--motion-fast) var(--ease-out);
}

.experience-choice:active {
  transform: scale(0.97);
}
```

Extend the existing reduced-motion block at `styles.css:1688-1734`:

```css
@media (prefers-reduced-motion: reduce) {
  .experience-choice:active {
    transform: none;
  }
}
```

## Repo conventions to follow

- Use `var(--motion-fast)` and `var(--ease-out)` from `styles.css:17-21`; do not create another `120ms`/`160ms` literal or curve.
- Keep the existing explicit transition-property list. `transition: all` is prohibited.
- The panel already uses Web Animations API in `script.js:292-314`; do not duplicate or replace that crossfade with CSS.
- Reduced-motion behavior is centralized in the existing media query at `styles.css:1688-1734`.

## Steps

1. In `styles.css:1266`, replace only the transform transition duration with `var(--motion-fast)`.
2. Add `.experience-choice:active { transform: scale(0.97); }` after the existing hover/focus rule and before `.experience-choice.is-active`.
3. Add the reduced-motion `:active` reset to the existing reduced-motion block.
4. Leave tab roles, `aria-selected`, content animation cancellation, scroll snap, and horizontal overflow unchanged.

## Boundaries

- Do not touch `script.js` panel animation code; it already handles rapid tab changes with request sequencing.
- Do not alter active-tab colors, shadows, padding, hit areas, or the panel's `160ms`/`220ms` content timings.
- Do not add hover-only selectors or motion to the panel itself.
- If `.experience-choice` or its reduced-motion overrides differ from the cited code at commit `2494ff5`, stop and report drift.

## Verification

- **Mechanical**: Run `git diff --check`; expected result is no whitespace errors. Run `node --check script.js && node --check fx-engine.js`; expected result is no syntax output.
- **Feel check**: Open the experience section in WebKit. Click each tab once and confirm the pressed tab briefly scales to `0.97`, then returns to its normal state while the panel content performs the existing exit/enter transition.
- **Interruption check**: Activate several tabs quickly. The panel must still show the latest requested tab, with no stale text or stuck `will-change` state.
- **Keyboard check**: Activate a focused tab with Space/Enter; focus remains visible and the press response is brief.
- **Reduced-motion check**: Enable `prefers-reduced-motion: reduce`. Tab selection and content replacement must remain functional, but the tab must not scale.
- **Done when**: Every experience tab gives consistent tactile feedback without changing the existing panel behavior or accessibility state.
