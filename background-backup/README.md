# Background backup — 2026-08-13

Snapshot of the scroll-driven background as it stands after the iPhone Safari
performance work. Take this as the known-good state to fall back to if a
replacement background does not work out.

## What is in here

| File | What it is |
|---|---|
| `full/fx-engine.js` | Complete snapshot of the engine |
| `full/styles.css` | Complete snapshot of the stylesheet |
| `full/index.html` | Complete snapshot of the markup |
| `background-module.js` | Just `createBackgroundModule()`, extracted (lines 212–499 of `fx-engine.js`) |
| `background.css` | Just the background block, extracted (lines 60–417 of `styles.css`) |

The two extracted files are for reading and for surgical restores. The `full/`
copies are the guaranteed-correct restore.

## Restoring

**Surgical (preferred if you have made other edits since):**

1. In `fx-engine.js`, replace the whole `createBackgroundModule()` method with
   `background-module.js`.
2. In `styles.css`, replace everything from `.page-background {` up to (not
   including) the first bare `a {` rule with `background.css`.
3. Confirm `index.html` still has the `.page-background` block with two
   `.background-plane` divs — see "Markup contract" below.

**Full (clobbers any later edits to these three files):**

```sh
./background-backup/restore.sh --yes
```

It writes the current files to `background-backup/pre-restore/` first, so a
restore is itself undoable.

## Markup contract

The module requires exactly this, inside `<body>`, before `<main>`:

```html
<div class="page-background" aria-hidden="true">
  <div class="background-plane background-plane-primary" data-background-scene="hero">
    <div class="background-atmosphere">
      <span class="background-motif background-motif-a"></span>
      <span class="background-motif background-motif-b"></span>
      <span class="background-motif background-motif-c"></span>
    </div>
  </div>
  <div class="background-plane background-plane-secondary" data-background-scene="projects" data-reveal="from-bottom">
    <div class="background-atmosphere">
      <span class="background-motif background-motif-a"></span>
      <span class="background-motif background-motif-b"></span>
      <span class="background-motif background-motif-c"></span>
    </div>
  </div>
</div>
```

Scene names come from `data-scene` attributes on the sections in `index.html`,
in document order: `hero, projects, turn, program, program, experience,
spotlight, spotlight, deep`. Consecutive duplicates collapse into one stop, so
there are seven stops.

## External couplings

- `script.js` writes `data-background-scene` directly onto
  `.background-plane-primary` for the `prefers-reduced-motion` path. That class
  name must keep existing even though the two planes swap roles at runtime.
- `styles.css` under `@media (prefers-reduced-motion: reduce)` sets
  `visibility: hidden` on `.background-plane-secondary`.
- `html[data-fx-tier="lite"]` rules de-promote `.background-atmosphere` and hide
  `.background-motif-c` on touch devices.

## Verifying a restore

```sh
node --check fx-engine.js
node --check script.js
git diff --check
```

Then load the page and confirm: the hero is cream, the background changes
continuously with scroll rather than in jumps, nothing parks at a screen edge
and then vanishes, and `AITC_FX.destroy()` followed by `AITC_FX.init()` leaves
the page working.
