# 003 — Stage the beginner section reveal

- **Status**: DONE
- **Commit**: 2494ff5
- **Severity**: LOW
- **Category**: Cohesion & spatial consistency
- **Estimated scope**: 2 files, 8–12 lines

## Problem

The beginner section currently applies one shared reveal to the entire grid in `index.html:191-202`:

```html
<!-- index.html:191-202 — current -->
<section class="beginner section-dark" id="beginners" data-chrome="#0c2719" data-scene="program" aria-labelledby="beginner-title">
  <div class="beginner-mark" aria-hidden="true">?</div>
  <div class="beginner-grid page-width reveal">
    <div class="beginner-headline">
      <h2 id="beginner-title">but i can't<br />code.</h2>
      <p class="good-word">good.</p>
    </div>
    <div class="beginner-copy">
      <p class="beginner-lede">you need an idea.<br />we'll start from there.</p>
      <p>aitc is built for beginners too. no previous experience is required. we can help you take the first step.</p>
    </div>
  </div>
</section>
```

The shared reveal at `styles.css:1537-1549` gives both columns exactly the same entrance:

```css
/* styles.css:1537-1549 — current */
.reveal {
  opacity: 0;
  transform: translate3d(0, 1.5rem, 0);
  transition:
    opacity var(--motion-reveal) var(--ease-out),
    transform var(--motion-reveal) var(--ease-out);
  transition-delay: var(--reveal-delay, 0ms);
}

.reveal.in {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
```

The section's headline is the narrative lead, so the explanatory copy should follow instead of arriving as one undifferentiated block.

## Target

Observe the two meaningful columns separately while preserving the existing reveal geometry and timing:

```html
<!-- target -->
<div class="beginner-grid page-width">
  <div class="beginner-headline reveal">
    <h2 id="beginner-title">but i can't<br />code.</h2>
    <p class="good-word">good.</p>
  </div>
  <div class="beginner-copy">
    <p class="beginner-lede reveal">you need an idea.<br />we'll start from there.</p>
    <p class="reveal">aitc is built for beginners too. no previous experience is required. we can help you take the first step.</p>
  </div>
</div>
```

Add the delays near the beginner layout rules in `styles.css:894-924`:

```css
/* target */
.beginner-headline.reveal {
  --reveal-delay: 0ms;
}

.beginner-copy > p.reveal {
  --reveal-delay: 80ms;
}
```

The existing shared transition remains exactly `560ms var(--ease-out)` for both elements. The `80ms` stagger is the maximum value in the repo's intended `30–80ms` stagger range and is long enough to establish reading order without delaying interaction.

## Repo conventions to follow

- The shared reveal system is implemented at `styles.css:1537-1549`; extend it with `--reveal-delay`, do not create a second keyframe or transition system.
- The existing board cards use the same custom-property convention via `style="--reveal-delay: ..."` in `index.html:295-334`; CSS selectors are preferred here because the two beginner delays are structural and fixed.
- `script.js:74-115` observes every `.reveal` and adds `.in` once; the headline and both direct copy paragraphs use the existing observer. `fx-engine.js:212-310` owns the parent `.beginner-copy` scroll transform/opacity, so the parent must remain free of `.reveal`.
- Reduced motion already sets `.reveal` to `opacity: 1`, `transform: none`, and `transition: none` at `styles.css:1693-1702`.

## Steps

1. In `index.html:193`, remove `reveal` from `.beginner-grid`.
2. In `index.html:194`, add `reveal` to `.beginner-headline`.
3. In `index.html:198-200`, keep `.beginner-copy` unmarked and add `reveal` to both direct paragraph children.
4. In `styles.css` beside `.beginner-copy`, add `.beginner-copy > p.reveal { --reveal-delay: 80ms; }`; keep `.beginner-headline.reveal { --reveal-delay: 0ms; }`.
5. Preserve the FX engine's parent-owned scroll transform/opacity and do not change the beginner copy, decorative question mark, grid columns, or section observer logic.

## Boundaries

- Do not animate individual words, the decorative `?`, or the `good.` mark separately.
- Do not change `--motion-reveal`, `--ease-out`, the `1.5rem` travel distance, or the section's layout.
- Do not add JavaScript, timers, or new dependencies.
- If the current `.reveal` observer or cited beginner markup differs from commit `2494ff5`, stop and report drift.

## Verification

- **Mechanical**: Run `git diff --check`; expected result is no whitespace errors. Run `node --check script.js && node --check fx-engine.js`; expected result is no syntax output.
- **Reveal check**: In WebKit, reload near the top, scroll until the beginner section enters the observer margin, and confirm the headline starts first; both direct copy paragraphs follow `80ms` later. The parent `.beginner-copy` may also receive the existing FX engine scroll transform/opacity; its children must retain the CSS reveal.
- **Observer check**: Confirm the headline and both copy paragraphs receive `.in` and remain visible after the observer unobserves them. The parent grid and `.beginner-copy` must not remain hidden.
- **Responsive check**: Verify desktop and 390px mobile layouts; the two-column-to-mobile layout must not shift because only reveal ownership changed.
- **Reduced-motion check**: Enable `prefers-reduced-motion: reduce`; headline and both copy paragraphs must be visible immediately with no translate or delay, and the FX engine must remain uninitialized.
- **Done when**: The section reads as headline first, supporting copy second, with no layout shift or change to the existing content.
