# Task: design and build a new scroll-driven background for this site

You are replacing **one module** in an existing, working site. Everything else on
the page — content, layout, navigation, project cards, typography, links,
interactions — must be left exactly as it is.

The site is a landing page for a high-school AI club. Palette is cream `#fff3cb`
on deep forest green `#0c2719`. Tone is calm, confident, hand-made; not corporate,
not neon, not "tech startup gradient".

## The one thing you own

`createBackgroundModule()` in `fx-engine.js` (currently lines 212–499), plus the
background block in `styles.css` (currently lines 60–417), plus the
`.page-background` markup in `index.html` (lines 23–41).

Nothing else. Do not touch `script.js`, the other three FX modules
(`createBeginnerModule`, `createTimelineModule`, `createExperienceMaskModule`),
or any CSS outside that block.

## The contract you must implement

`createBackgroundModule()` returns a plain object. The engine calls it like this,
once per animation frame, and the read/write split is mandatory:

```js
{
  isVisible: true,

  init(engine) {},            // query DOM, set up ResizeObserver. Called once.
  measure(vh, engine) {},     // READ phase. Return a plain object. NO DOM writes.
  render(measurement) {},     // WRITE phase. NO DOM reads, including getComputedStyle.
  destroy() {}                // remove every listener/observer, clear every inline style
}
```

- `vh` is the viewport height. `engine.isLite` is `true` on touch/coarse-pointer
  devices. `engine.schedule()` requests a frame.
- `measure()` runs for all modules before any `render()` runs. Putting a layout
  read (`getBoundingClientRect`, `offsetTop`, `scrollWidth`, `getComputedStyle`)
  inside `render()` forces a synchronous layout every frame. This is the single
  easiest way to ruin this page.
- `AITC_FX.init()` and `AITC_FX.destroy()` are a public API. `destroy()` then
  `init()` must leave the page fully working, at any scroll position. There is a
  test for this; see Validation.

## Seven stages, each visually distinct

Scene names come from `data-scene` attributes on the sections, in document order:
`hero, projects, turn, program, program, experience, spotlight, spotlight, deep`.
Consecutive duplicates collapse, giving seven stops.

| Scene | Section | Intended character |
|---|---|---|
| `hero` | landing | restrained topographic horizon, cream/light |
| `projects` | "what's even possible?" | orbital rings |
| `turn` | "what will you build?" | luminous seam |
| `program` | "how aitc works" | route line and nodes |
| `experience` | experience picker | soft lens shapes |
| `spotlight` | matterhub case study | concentric spotlight rings |
| `deep` | final CTA | quiet horizon |

You may reinterpret these visually. You may not collapse them into one effect
with a colour swap — each stage should be recognisably its own thing.

## Hard requirements

**Motion**
1. Animate **transform and opacity only**. Nothing else, ever, per frame.
2. Do **not** animate: gradients, filters, blur, masks, clip-path, SVG path data,
   layout properties (width/height/top/left/margin), or inherited CSS custom
   properties.
3. Transitions must be continuous, organic, reversible, and a direct function of
   scroll position. State at a given `scrollY` must be identical whether the user
   arrived scrolling down or up. No easing that depends on previous frames, no
   velocity integration, no springs with memory.
4. No "PowerPoint" feel: no full-screen cross-fade as the primary transition, and
   no stretch of scrolling where the background does not move at all.
5. Never leave a permanent looping animation (no perpetual waves, no `infinite`
   keyframes).

**Performance — these are not suggestions, each one caused a real, measured bug**
6. Promote composited layers **once, in CSS**, and never toggle. Do not add or
   remove `will-change` at runtime. Toggling it per transition made Safari
   allocate and discard full-screen backing stores at every scene boundary and
   produced ~1,771 Mpx of background repaint per scroll pass.
7. Changing a scene's gradient or a child's `display` is a full-layer repaint.
   Only ever do it on a plane that is **fully covered or fully offscreen** at that
   instant. Never repaint a visible layer.
8. Keep at most **two** full-screen composited layers on touch devices. Transparent
   full-screen layers are the worst case — the compositor must blend them every
   frame and cannot occlusion-cull them.
9. Every "offscreen" resting transform must **actually clear the viewport**. Check
   the arithmetic; do not eyeball it. A previous version rested at
   `translate3d(47.8%, 85.3%)` and left a visible block parked in the corner that
   then vanished when the stage changed.
10. **No CSS `transition` on any property you write per frame.** Each write
    restarts the transition, so the element renders one transition-duration behind
    the scroll. Watch for transitions arriving via a shared class such as
    `.reveal` rather than the element's own rule — that is the easy one to miss.
11. Batch all reads before all writes. Cache geometry and recompute it in a
    `ResizeObserver`, not per frame.
12. Skip unchanged DOM writes. Note that `element.style.transform` reads back the
    browser's serialised form (`translate3d(0px, 104%, 0px)`), which never equals
    the string you wrote (`translate3d(0, 104%, 0)`) — so comparing against the
    DOM never skips anything. Cache what you last wrote in JS instead.
13. One event-driven `requestAnimationFrame` scheduler. No perpetual rAF loop.
    The existing engine already provides this; use `engine.schedule()`.
14. Pause all work when the tab is hidden. Already handled by the engine — do not
    break it.
15. Serve a lighter tier when `engine.isLite` is true (fewer layers, fewer
    decorative elements, coarser quantisation).
16. Respect `prefers-reduced-motion`: static per-section background, no motion.
    Note `AITC_FX.init()` already returns early under reduced motion, and
    `script.js` then drives `data-background-scene` on `.background-plane-primary`
    directly — so **that class name must keep existing** in your markup.
17. **No new runtime dependencies.** No GSAP, Three.js, React, canvas libraries.
    Vanilla JS and CSS. If you believe vanilla cannot hit the target, prove it
    with a measurement before proposing anything else.

**Content**
18. "what's even possible?" and its supporting copy must stay cream/sand
    (`--cream: #fff3cb`) for contrast. Do not change text colours anywhere.
19. Background must sit behind all content and never intercept pointer events.

## Constraints that come from the rest of the page

- `script.js` writes `data-background-scene` onto `.background-plane-primary`
  under reduced motion. Keep that hook.
- `html[data-fx-tier="lite"]` is set by the engine on touch devices. Use it.
- `@media (prefers-reduced-motion: reduce)` currently hides
  `.background-plane-secondary`. Update to match whatever markup you produce.
- `.page-background` is `position: fixed` and must stay behind `main`.
  It currently uses `contain: layout paint`; `contain: strict` was deliberately
  avoided because size containment on an inset-sized fixed box could not be
  verified against a physical iOS viewport.

## Validation — all of it must pass

```sh
node --check fx-engine.js
node --check script.js
git diff --check
```

Then, in a browser, confirm every one of these:

- Slow scroll, fast scroll, and reverse scroll through the whole page.
- Scroll to a position, scroll away, scroll back — the background state must be
  **identical**, not merely similar.
- Rapid back-and-forth across a single stage boundary shows no stale or flashing
  scene.
- Orientation change and window resize, both directions.
- Tab to background and return.
- `AITC_FX.destroy()` leaves **no** inline styles, classes, or data attributes
  behind; `AITC_FX.init()` afterwards fully restores behaviour at the same scroll
  position. Do this twice in a row.
- `prefers-reduced-motion: reduce` gives a static background and no engine init.
- Zero console errors and zero page errors in every case above.

Measure, in **WebKit** (Playwright `webkit`, iPhone-sized viewport), warmed, over
a full-page scroll — report average, p95, maximum frame interval, count over
33 ms, and count over 50 ms. Target zero recurring frames over 33 ms.

Two warnings about measuring this page, learned the hard way:

- **Chromium does not reproduce this page's scroll jank.** A clean Chromium trace
  is not evidence of anything. Use WebKit.
- **Averages and p95 hide the problem.** The real defects showed up as a single
  reproducible long frame at one fixed scroll position while the average sat at a
  flat 16.7 ms. Bucket long frames by `scrollY` and look for a spike that recurs
  at the same place across runs.

## Current state, for reference

A working implementation is in `background-backup/`:
`background-module.js` (the module) and `background.css` (the styles), plus full
file snapshots in `background-backup/full/`. Read it to understand the contract
and the couplings. You are not required to keep its approach — two sliding planes
that swap roles — only its contract and the constraints above.

## Deliverable

The modified `fx-engine.js`, `styles.css`, and `index.html`, plus a short note
covering: what you built and why, the WebKit frame numbers above, anything you
could not verify without a physical iPhone, and any constraint above you chose to
break and the measurement that justified it.

Do not commit, and do not modify any file outside the three named above.
