# 005 — Add a restrained hero gradient drift

- **Status**: TODO — FINAL EXECUTION STEP
- **Commit**: 2494ff5
- **Severity**: LOW
- **Category**: Missed opportunity / performance-constrained marketing motion
- **Estimated scope**: 1 file, 35–50 CSS lines

## Problem

The hero gradient is currently static in `styles.css:57-62`:

```css
/* styles.css:57-62 — current */
.hero {
  background-color: var(--cream);
  background:
    radial-gradient(circle at 100% 100%, rgba(12, 39, 25, 0.96) 0%, rgba(33, 100, 52, 0.68) 24%, rgba(255, 243, 203, 0) 68%),
    linear-gradient(135deg, var(--cream) 0%, var(--cream) 56%, #dbe1b3 78%, var(--forest-mid) 100%);
}
```

The gradient is part of the hero's visual identity, but animating `background-position`, color stops, or CSS custom properties would repeatedly repaint the full viewport. The hero is a rare, high-attention surface, so a barely perceptible drift is acceptable only if it moves a single pre-rasterized layer through compositor-friendly `transform` updates.

This plan is intentionally last. It must not be executed together with the first four plans or before their visual/performance checks are complete.

## Target

Keep the exact existing gradient values, move them to one pseudo-element, and retain a cream fallback on `.hero`. Animate only the pseudo-element's `transform` over a slow marketing timescale.

```css
/* target: styles.css:57-62 */
.hero {
  isolation: isolate;
  background-color: var(--cream);
}

.hero::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: "";
  pointer-events: none;
  background:
    radial-gradient(circle at 100% 100%, rgba(12, 39, 25, 0.96) 0%, rgba(33, 100, 52, 0.68) 24%, rgba(255, 243, 203, 0) 68%),
    linear-gradient(135deg, var(--cream) 0%, var(--cream) 56%, #dbe1b3 78%, var(--forest-mid) 100%);
  transform: translate3d(-1.25%, -0.75%, 0) scale(1.04);
  transform-origin: center;
  backface-visibility: hidden;
  will-change: transform;
  animation: hero-gradient-drift 18s var(--ease-in-out) infinite alternate;
}

@keyframes hero-gradient-drift {
  from {
    transform: translate3d(-1.25%, -0.75%, 0) scale(1.04);
  }
  to {
    transform: translate3d(1.25%, 0.75%, 0) scale(1.06);
  }
}
```

The existing `.hero-title` `z-index: 1` and `.hero-bottom` `z-index: 10` keep content above the pseudo-element. `.site-nav` remains independently layered at `z-index: 30`.

Disable the animation, movement, and persistent layer hint for lite and reduced-motion modes:

```css
/* target: near the existing lite-tier rules */
html[data-fx-tier="lite"] .hero::before {
  animation: none;
  transform: none;
  will-change: auto;
}

/* target: existing @media (prefers-reduced-motion: reduce) block */
.hero::before {
  animation: none;
  transform: none;
  will-change: auto;
}
```

The pseudo-element remains static in those modes so the gradient is still present; only motion and layer promotion are removed.

## Repo conventions to follow

- Use `var(--ease-in-out)` from `styles.css:20-21` for on-screen movement. Do not add another curve.
- Keep the existing `var(--cream)`, `var(--forest-mid)`, and exact gradient stop values.
- Animate only `transform`; never update `background-position` from JavaScript and do not animate colors, layout properties, or filters.
- The existing hero logo at `styles.css:329-347` uses `translateZ(0)`, `backface-visibility: hidden`, and a transform-only animation; follow that compositing approach.
- The FX engine's lite tier is determined in `fx-engine.js:94-101` from coarse input, touch, or Save-Data. Preserve that performance fallback.

## Steps

1. Replace the `.hero` `background` declaration at `styles.css:57-62` with `isolation: isolate` and `background-color: var(--cream)`.
2. Add the `.hero::before` pseudo-element with the exact two existing gradient layers, `inset: 0`, `pointer-events: none`, `z-index: 0`, and the target transform/compositing declarations.
3. Add `@keyframes hero-gradient-drift` with only the two target transform states and the `18s var(--ease-in-out) infinite alternate` animation.
4. Add the lite-tier static reset beside the existing `html[data-fx-tier="lite"]` rules.
5. Add the reduced-motion static reset inside the existing `@media (prefers-reduced-motion: reduce)` block.
6. Do not change hero copy, CTA positioning, logo animation, nav behavior, or the background engine.
7. Execute this plan only after plans `001`–`004` have been implemented and verified, and only after the user explicitly approves this final motion step.

## Boundaries

- Do not animate `background-position`, `background-size`, gradient stop colors, opacity, blur, or any layout property.
- Do not add a JavaScript animation loop, scroll listener, timer, or dependency.
- Do not add more than one animated pseudo-element or repeatedly toggle `will-change`.
- Do not change the visual gradient stops, hero height, overflow, content z-indexes, or CTA animations.
- Do not execute this plan automatically after the first four plans.
- If the hero layering or lite-tier selectors differ from commit `2494ff5`, stop and report drift before changing anything.

## Verification

- **Mechanical**: Run `git diff --check`; expected result is no whitespace errors. Run `node --check script.js && node --check fx-engine.js`; expected result is no syntax output.
- **Visual baseline**: In WebKit at `1440x900` and `390x844`, compare the hero before/after with animation disabled. The gradient's colors, stop locations, text contrast, nav contrast, logo, and CTA positions must remain unchanged.
- **Feel check**: With normal motion enabled, watch the hero for at least `18s`. The gradient should drift slowly and almost imperceptibly; text must remain the visual focus. It must never look like a color flash, wave, or loading indicator.
- **Reduced-motion check**: Enable `prefers-reduced-motion: reduce`. The gradient must remain static and the pseudo-element must report `animation-name: none` and `will-change: auto`.
- **Lite-tier check**: Emulate coarse pointer or Save-Data. Confirm the gradient remains visible but does not animate or retain `will-change: transform`.
- **Performance check**: Use WebKit, not only Chromium. Capture a trace while the hero is stationary and while scrolling through the hero; inspect long frames and paint/composite activity. There must be no per-frame JavaScript work or full-viewport repaint caused by changing gradient properties. Bucket any long frames by `scrollY` rather than relying only on averages or p95.
- **Done when**: The hero has a restrained compositor-only drift on full-motion desktop, stays static for reduced/lite modes, preserves contrast, and shows no reproducible long-frame regression in WebKit.
