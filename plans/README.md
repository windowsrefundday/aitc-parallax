# Animation improvement plans

Plans were authored against commit `2494ff5`. Plans `001`–`004` are implemented and verified in WebKit; plan `005` remains deferred. Source implementation touched `index.html` and `styles.css`; `script.js` and `fx-engine.js` remained unchanged.

## Plan table

| Plan | Title | Severity | Status | Dependencies |
|---|---|---:|---|---|
| [001](001-pagination-dot-press-feedback.md) | Add pagination dot press feedback | LOW | DONE | None |
| [002](002-experience-tab-press-feedback.md) | Add experience tab press feedback | LOW | DONE | None |
| [003](003-beginner-staged-reveal.md) | Stage the beginner section reveal | LOW | DONE | None |
| [004](004-board-member-info-stagger.md) | Stage board member information | LOW | DONE | None |
| [005](005-hero-gradient-drift.md) | Add a restrained hero gradient drift | LOW | TODO — FINAL | 001–004 verified; explicit user approval |

## Recommended execution order

1. Plans `001`–`004` are complete and verified across WebKit desktop, mobile, and reduced-motion contexts.
2. Review the first-four result in the browser.
3. Only after explicit approval, execute `005`. It is deliberately last because it adds continuous visual motion and requires a WebKit performance check.

Plans `001`–`004` are complete and verified. Plan `005` must not be bundled with them.

## Execution gate

The first four plans are implemented. The session is now paused for the user's review and explicit approval before executing plan `005` hero gradient drift.
