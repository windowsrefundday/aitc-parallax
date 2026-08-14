/**
 * AITC Standalone FX Engine
 *
 * Scroll-linked effects are kept in one event-driven frame scheduler. Modules
 * measure first and render second so Safari never has to answer a layout read
 * after a style write in the same frame.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AITC_FX = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const win = typeof window !== "undefined" ? window : null;
  const doc = typeof document !== "undefined" ? document : null;
  const root = doc ? doc.documentElement : null;

  const prefersReducedMotion = () =>
    !win || win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /*
   * `element.style.transform` reads back the value the engine serialised
   * ("translate3d(0px, 104%, 0px)"), which never equals the string we wrote
   * ("translate3d(0, 104%, 0)"). Comparing against the DOM therefore never
   * skips anything. Cache what we last wrote instead, so quantized values that
   * land on the same step cost nothing, and the write phase does no CSSOM reads.
   */
  const writtenStyles = new WeakMap();

  const writeStyle = (element, property, value) => {
    if (!element) return;
    let state = writtenStyles.get(element);
    if (!state) {
      state = {};
      writtenStyles.set(element, state);
    }
    if (state[property] === value) return;
    state[property] = value;
    element.style[property] = value;
  };

  const clearStyle = (element, cssProperty, property) => {
    if (!element) return;
    const state = writtenStyles.get(element);
    if (state) delete state[property];
    element.style.removeProperty(cssProperty);
    if (!element.style.length) element.removeAttribute("style");
  };

  const setClassIfChanged = (element, className, enabled) => {
    if (!element || element.classList.contains(className) === enabled) return;
    element.classList.toggle(className, enabled);
  };

  const getLayoutOffsetTop = (element, ancestor) => {
    if (!element || !ancestor) return 0;

    let offset = 0;
    let current = element;
    while (current && current !== ancestor) {
      offset += current.offsetTop;
      current = current.offsetParent;
    }

    if (current === ancestor) return offset;

    const elementRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    return elementRect.top - ancestorRect.top;
  };

  class FXEngine {
    constructor() {
      this.isInitialized = false;
      this.activeModules = new Map();
      this.viewportHeight = win ? win.innerHeight : 0;
      this.frameId = 0;
      this.framePending = false;
      this.isPageVisible = true;
      this.isLite = this.detectLiteMode();
      this.observer = null;

      this.schedule = this.schedule.bind(this);
      this.onResize = this.onResize.bind(this);
      this.onVisibilityChange = this.onVisibilityChange.bind(this);
      this.tick = this.tick.bind(this);
    }

    detectLiteMode() {
      if (!win) return true;

      const coarsePointer = win.matchMedia("(pointer: coarse)").matches;
      const hasTouch = "ontouchstart" in win || (navigator.maxTouchPoints || 0) > 0;
      const saveData = Boolean(navigator.connection && navigator.connection.saveData);

      return coarsePointer || hasTouch || saveData;
    }

    init() {
      if (this.isInitialized || !win || !doc || prefersReducedMotion()) return;

      this.isInitialized = true;
      this.viewportHeight = win.innerHeight;
      this.isPageVisible = doc.visibilityState !== "hidden";
      root.dataset.fxTier = this.isLite ? "lite" : "full";

      this.registerModule("background", this.createBackgroundModule());
      this.registerModule("beginners", this.createBeginnerModule());
      this.registerModule("timeline", this.createTimelineModule());
      this.registerModule("experienceMask", this.createExperienceMaskModule());

      this.setupObservers();
      win.addEventListener("scroll", this.schedule, { passive: true });
      win.addEventListener("resize", this.onResize, { passive: true });
      doc.addEventListener("visibilitychange", this.onVisibilityChange);

      this.runFrame();
    }

    registerModule(id, module) {
      if (!module || typeof module.init !== "function") return;
      module.init(this);
      this.activeModules.set(id, module);
    }

    setupObservers() {
      const targets = doc.querySelectorAll("[data-fx-section]");

      if (!("IntersectionObserver" in win)) {
        this.activeModules.forEach((module) => {
          if (module.section) module.isVisible = true;
        });
        return;
      }

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const id = entry.target.getAttribute("data-fx-section");
            const module = this.activeModules.get(id);
            if (!module) return;

            const wasVisible = module.isVisible;
            module.isVisible = entry.isIntersecting;

            if (entry.isIntersecting && !wasVisible && typeof module.onEnter === "function") {
              module.onEnter();
            }
          });
          this.schedule();
        },
        { rootMargin: "120px 0px" }
      );

      targets.forEach((element) => this.observer.observe(element));
    }

    schedule() {
      if (!this.isInitialized || !this.isPageVisible || this.framePending) return;
      this.framePending = true;
      this.frameId = requestAnimationFrame(this.tick);
    }

    onResize() {
      this.viewportHeight = win.innerHeight;
      this.schedule();
    }

    onVisibilityChange() {
      this.isPageVisible = doc.visibilityState !== "hidden";

      if (!this.isPageVisible) {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        this.frameId = 0;
        this.framePending = false;
        return;
      }

      this.schedule();
    }

    tick() {
      this.frameId = 0;
      this.framePending = false;
      this.runFrame();
    }

    runFrame() {
      if (!this.isInitialized || !this.isPageVisible) return;

      const measurements = new Map();
      const vh = this.viewportHeight;

      // Read phase: modules must not mutate layout or styles here.
      this.activeModules.forEach((module, id) => {
        if (module.isVisible === false || typeof module.measure !== "function") return;
        measurements.set(id, module.measure(vh, this));
      });

      // Write phase: all layout reads are complete before any render starts.
      this.activeModules.forEach((module, id) => {
        if (module.isVisible === false || typeof module.render !== "function") return;
        module.render(measurements.get(id), this);
      });
    }

    /**
     * Scroll-driven scene background.
     *
     * Two full-screen planes are promoted once and never demoted. Scene stops
     * are anchored so that consecutive stages share a boundary, which makes the
     * reveal a continuous function of scroll position with no dead zones.
     *
     * The planes swap roles at each boundary instead of both being repainted:
     * plane parity is derived from the base stop index, so the incoming base is
     * the plane that already carries that scene, and the single plane that does
     * change scene is always the one fully covered at that instant.
     *
     * Motion is three depths of translate/scale only: the sliding plane, the
     * atmosphere group, and two tiny accent elements per plane that ride ahead
     * of and behind the atmosphere. Every value is a pure function of scrollY,
     * quantized so unchanged frames skip the DOM write entirely.
     */
    createBackgroundModule() {
      // Per-scene atmosphere drift, in viewport units. The art is painted once
      // per scene; these small offsets only lend it depth while scrolling.
      const sceneMotion = {
        hero: { x: 0, y: 10, scale: 1 },
        projects: { x: -2.5, y: -6, scale: 1.015 },
        turn: { x: 2, y: -8, scale: 1.02 },
        program: { x: -2, y: 7, scale: 1.02 },
        experience: { x: 2.5, y: -5, scale: 1.015 },
        spotlight: { x: 0, y: 8, scale: 1.03 },
        deep: { x: 0, y: -3, scale: 1 }
      };

      // Accent depths relative to the atmosphere drift: accent-a rides nearer
      // than the scene, accent-b sits deeper. They are small promoted layers,
      // so their per-frame moves are compositor work, never paint.
      const ACCENT_NEAR = 1.35;
      const ACCENT_FAR = 0.5;
      const OVER_DEPTH = 0.72;

      // Scene i is fully settled once its section top sits this far into the
      // viewport. Small value keeps the stage change close to its content.
      const ANCHOR_FRACTION = 0.18;
      const MIN_ANCHOR_GAP = 120;

      let container = null;
      let planeA = null;
      let planeB = null;
      let atmosphereA = null;
      let atmosphereB = null;
      let accentsA = [];
      let accentsB = [];
      let edgeA = null;
      let edgeB = null;
      let sections = [];
      let stops = [];
      let anchors = [];
      let anchorViewport = -1;
      let maxScroll = 0;

      let layoutObserver = null;
      let visualViewportHandler = null;

      // Role state, so boundary work only runs when the base stop changes.
      let baseIndex = -1;
      let basePlane = null;
      let overPlane = null;
      let baseAtmosphere = null;
      let overAtmosphere = null;
      let baseAccents = [];
      let overAccents = [];
      let baseEdge = null;
      let overEdge = null;
      const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
      const smoothstep = (value) => value * value * value * (value * (value * 6 - 15) + 10);
      const mix = (from, to, progress) => from + (to - from) * progress;
      const getScrollTop = () => win.pageYOffset || root.scrollTop || 0;

      const getRevealMode = (scene) => {
        if (scene === "turn") return "from-right";
        if (scene === "program") return "diagonal";
        if (scene === "experience") return "from-left";
        if (scene === "spotlight") return "from-top";
        return "from-bottom";
      };

      const getRevealTransform = (scene, distance) => {
        const d = distance.toFixed(2);

        switch (scene) {
          case "turn":
            return `translate3d(${d}%, 0, 0)`;
          case "program":
            // The vertical component must reach a full 100% on its own: with
            // the old 0.82 factor the plane rested at (47.8%, 85.3%), which
            // left a visible block parked in the bottom-right corner that then
            // vanished the instant the stage changed.
            return `translate3d(${(distance * 0.42).toFixed(2)}%, ${d}%, 0)`;
          case "experience":
            return `translate3d(-${d}%, 0, 0)`;
          case "spotlight":
            return `translate3d(0, -${d}%, 0)`;
          default:
            return `translate3d(0, ${d}%, 0)`;
        }
      };

      const refreshGeometry = () => {
        if (!sections.length) return;

        const scrollTop = getScrollTop();
        const nextStops = [];
        let previousScene = "";

        sections.forEach((section) => {
          const scene = section.dataset.scene;
          if (!scene || !sceneMotion[scene] || scene === previousScene) return;

          nextStops.push({
            scene,
            top: section.getBoundingClientRect().top + scrollTop
          });
          previousScene = scene;
        });

        stops = nextStops;
        maxScroll = Math.max(0, root.scrollHeight - win.innerHeight);
        anchorViewport = -1;
      };

      // Anchors are cached and only rebuilt when the viewport height changes.
      const refreshAnchors = (viewportHeight) => {
        if (anchorViewport === viewportHeight || !stops.length) return;
        anchorViewport = viewportHeight;

        const next = new Array(stops.length);
        for (let index = 0; index < stops.length; index += 1) {
          next[index] = index === 0
            ? 0
            : Math.max(0, Math.min(maxScroll, stops[index].top - viewportHeight * ANCHOR_FRACTION));
        }

        // Guarantee a strictly increasing ramp so progress stays monotonic.
        for (let index = 1; index < next.length; index += 1) {
          if (next[index] < next[index - 1] + MIN_ANCHOR_GAP) {
            next[index] = next[index - 1] + MIN_ANCHOR_GAP;
          }
        }

        anchors = next;
      };

      const applyRoles = (nextBaseIndex) => {
        if (nextBaseIndex === baseIndex) return;
        baseIndex = nextBaseIndex;

        const lastIndex = stops.length - 1;
        const overIndex = Math.min(lastIndex, nextBaseIndex + 1);
        const usePlaneAAsBase = nextBaseIndex % 2 === 0;

        basePlane = usePlaneAAsBase ? planeA : planeB;
        overPlane = usePlaneAAsBase ? planeB : planeA;
        baseAtmosphere = usePlaneAAsBase ? atmosphereA : atmosphereB;
        overAtmosphere = usePlaneAAsBase ? atmosphereB : atmosphereA;
        baseAccents = usePlaneAAsBase ? accentsA : accentsB;
        overAccents = usePlaneAAsBase ? accentsB : accentsA;
        baseEdge = usePlaneAAsBase ? edgeA : edgeB;
        overEdge = usePlaneAAsBase ? edgeB : edgeA;

        const baseScene = stops[nextBaseIndex].scene;
        const overScene = stops[overIndex].scene;
        const revealMode = getRevealMode(overScene);

        // The plane that changes scene here is the covered one, so its repaint
        // is never visible. The other plane keeps the scene it already painted.
        if (overPlane.dataset.backgroundScene !== overScene) {
          overPlane.dataset.backgroundScene = overScene;
        }
        if (overPlane.dataset.reveal !== revealMode) {
          overPlane.dataset.reveal = revealMode;
        }
        if (basePlane.dataset.backgroundScene !== baseScene) {
          basePlane.dataset.backgroundScene = baseScene;
        }
        // The base plane is flush with the viewport, so it must not paint a
        // leading edge of its own.
        if (basePlane.hasAttribute("data-reveal")) {
          basePlane.removeAttribute("data-reveal");
        }

        writeStyle(basePlane, "zIndex", "1");
        writeStyle(overPlane, "zIndex", "2");
        writeStyle(basePlane, "transform", "translateZ(0)");
        writeStyle(baseEdge, "opacity", "0");
      };

      return {
        isVisible: true,

        init(engine) {
          container = doc.querySelector(".page-background");
          planeA = doc.querySelector(".background-plane-primary");
          planeB = doc.querySelector(".background-plane-secondary");
          atmosphereA = planeA ? planeA.querySelector(".background-atmosphere") : null;
          atmosphereB = planeB ? planeB.querySelector(".background-atmosphere") : null;
          accentsA = planeA ? Array.from(planeA.querySelectorAll(".background-accent")) : [];
          accentsB = planeB ? Array.from(planeB.querySelectorAll(".background-accent")) : [];
          edgeA = planeA ? planeA.querySelector(".background-edge") : null;
          edgeB = planeB ? planeB.querySelector(".background-edge") : null;
          sections = Array.from(doc.querySelectorAll("header[data-scene], section[data-scene]"));

          if (!container || !planeA || !planeB || !sections.length) return;

          refreshGeometry();

          if ("ResizeObserver" in win) {
            layoutObserver = new ResizeObserver(() => {
              refreshGeometry();
              engine.schedule();
            });
            sections.forEach((section) => layoutObserver.observe(section));
          }

          if (win.visualViewport) {
            visualViewportHandler = engine.schedule;
            win.visualViewport.addEventListener("resize", visualViewportHandler, { passive: true });
          }
        },

        measure(vh, engine) {
          if (!stops.length || !planeA) return null;

          const viewportHeight = win.visualViewport ? win.visualViewport.height : vh;
          refreshAnchors(viewportHeight);
          if (!anchors.length) return null;

          const scrollTop = getScrollTop();
          const lastIndex = stops.length - 1;

          let index = 0;
          while (index < lastIndex && scrollTop >= anchors[index + 1]) index += 1;

          const span = index < lastIndex ? anchors[index + 1] - anchors[index] : 0;
          const progress = span > 0 ? clamp((scrollTop - anchors[index]) / span) : 0;
          const eased = smoothstep(progress);

          const overIndex = Math.min(lastIndex, index + 1);
          const fromMotion = sceneMotion[stops[index].scene];
          const toMotion = sceneMotion[stops[overIndex].scene];

          // Quantized so unchanged frames skip the DOM write entirely.
          const step = engine.isLite ? 0.25 : 0.1;
          const reach = engine.isLite ? 104 : 108;
          const distance = Math.round((reach * (1 - eased)) / step) * step;
          const revealTransform = getRevealTransform(stops[overIndex].scene, distance);
          const edgeOpacity = (Math.round(clamp(distance / 26, 0, 1) / 0.05) * 0.05).toFixed(2);

          // Touch tiers animate the reveal only: one moving layer, no
          // transparent full-screen layers blended on top of it.
          if (engine.isLite) {
            return { baseIndex: index, revealTransform, edgeOpacity, baseDrift: null, overDrift: null };
          }

          // Drift follows raw progress so the scene keeps moving with the
          // scroll even while the eased reveal is parked at an extreme.
          const driftX = mix(fromMotion.x, toMotion.x, progress);
          const driftY = mix(fromMotion.y, toMotion.y, progress);
          const driftScale = mix(fromMotion.scale, toMotion.scale, progress);
          const drift = (factor) =>
            `translate3d(${(driftX * factor).toFixed(2)}vw, ${(driftY * factor).toFixed(1)}px, 0) scale(${driftScale.toFixed(3)})`;

          return {
            baseIndex: index,
            revealTransform,
            edgeOpacity,
            baseDrift: drift(1),
            overDrift: drift(OVER_DEPTH),
            baseAccentNear: drift(ACCENT_NEAR),
            overAccentNear: drift(OVER_DEPTH * ACCENT_NEAR),
            baseAccentFar: drift(ACCENT_FAR),
            overAccentFar: drift(OVER_DEPTH * ACCENT_FAR)
          };
        },

        render(measurement) {
          if (!measurement) return;

          applyRoles(measurement.baseIndex);

          writeStyle(overPlane, "transform", measurement.revealTransform);
          writeStyle(overEdge, "opacity", measurement.edgeOpacity);
          if (measurement.baseDrift) {
            writeStyle(baseAtmosphere, "transform", measurement.baseDrift);
            writeStyle(overAtmosphere, "transform", measurement.overDrift);
            writeStyle(baseAccents[0], "transform", measurement.baseAccentNear);
            writeStyle(overAccents[0], "transform", measurement.overAccentNear);
            writeStyle(baseAccents[1], "transform", measurement.baseAccentFar);
            writeStyle(overAccents[1], "transform", measurement.overAccentFar);
          }
        },

        destroy() {
          if (layoutObserver) layoutObserver.disconnect();
          if (win.visualViewport && visualViewportHandler) {
            win.visualViewport.removeEventListener("resize", visualViewportHandler);
          }

          if (planeA) {
            planeA.dataset.backgroundScene = "hero";
            planeA.removeAttribute("data-reveal");
          }
          if (planeB) {
            planeB.dataset.backgroundScene = "projects";
            planeB.dataset.reveal = "from-bottom";
          }
          [planeA, planeB].filter(Boolean).forEach((plane) => {
            clearStyle(plane, "z-index", "zIndex");
            clearStyle(plane, "transform", "transform");
          });
          [atmosphereA, atmosphereB].filter(Boolean).forEach((atmosphere) => {
            clearStyle(atmosphere, "transform", "transform");
          });
          [...accentsA, ...accentsB].forEach((accent) => {
            clearStyle(accent, "transform", "transform");
          });
          [edgeA, edgeB].filter(Boolean).forEach((edge) => {
            clearStyle(edge, "opacity", "opacity");
          });

          baseIndex = -1;
          basePlane = null;
          overPlane = null;
          baseAtmosphere = null;
          overAtmosphere = null;
          baseAccents = [];
          overAccents = [];
          baseEdge = null;
          overEdge = null;
          edgeA = null;
          edgeB = null;
          anchors = [];
          anchorViewport = -1;
        }
      };
    }

    createBeginnerModule() {
      let section = null;
      let mark = null;
      let goodWord = null;
      let copy = null;
      let layoutObserver = null;
      let geometry = null;
      const last = new Map();

      const refreshGeometry = () => {
        if (!section) return;

        const sectionRect = section.getBoundingClientRect();

        geometry = {
          sectionHeight: sectionRect.height,
          goodOffset: goodWord ? getLayoutOffsetTop(goodWord, section) : 0,
          goodHeight: goodWord ? goodWord.offsetHeight : 0,
          copyOffset: copy ? getLayoutOffsetTop(copy, section) : 0,
          copyHeight: copy ? copy.offsetHeight : 0
        };
      };

      const update = (element, property, value) => {
        const key = `${property}:${element === mark ? "mark" : element === goodWord ? "good" : "copy"}`;
        if (last.get(key) === value) return;
        last.set(key, value);
        writeStyle(element, property, value);
      };

      return {
        section: null,
        isVisible: false,

        init(engine) {
          section = doc.querySelector("#beginners");
          this.section = section;
          if (!section) return;

          section.setAttribute("data-fx-section", "beginners");
          mark = section.querySelector(".beginner-mark");
          goodWord = section.querySelector(".good-word");
          copy = section.querySelector(".beginner-copy");
          refreshGeometry();

          if ("ResizeObserver" in win) {
            layoutObserver = new ResizeObserver(() => {
              refreshGeometry();
              engine.schedule();
            });
            [section, goodWord, copy].filter(Boolean).forEach((element) => layoutObserver.observe(element));
          }
        },

        onEnter() {
          refreshGeometry();
        },

        measure(vh) {
          if (!section || !geometry) return null;

          const sectionRect = section.getBoundingClientRect();
          const sectionTop = sectionRect.top;
          const totalDistance = vh + geometry.sectionHeight;
          const progress = Math.max(0, Math.min(1, (vh - sectionTop) / totalDistance));

          const markX = -36 + 54 * progress;
          const markY = 32 - 60 * progress;
          const markRotation = -18 + 30 * progress;
          const markScale = 0.85 + 0.33 * progress;
          const opacityFactor = Math.max(0, 1 - Math.abs(progress - 0.5) * 2);

          const goodCenter = sectionTop + geometry.goodOffset + geometry.goodHeight * 0.45;
          const goodDistance = goodCenter - vh * 0.58;
          const goodNorm = goodDistance > 0 ? Math.min(1, goodDistance / (vh * 0.38)) : 0;

          const copyCenter = sectionTop + geometry.copyOffset + geometry.copyHeight * 0.35;
          const copyDistance = copyCenter - vh * 0.62;
          const copyNorm = copyDistance > 0 ? Math.min(1, copyDistance / (vh * 0.35)) : 0;

          return {
            markTransform: `translate3d(${markX.toFixed(1)}vw, ${markY.toFixed(1)}vh, 0) rotate(${markRotation.toFixed(1)}deg) scale(${markScale.toFixed(2)})`,
            markOpacity: (0.03 + 0.15 * opacityFactor).toFixed(2),
            goodTransform: `translate3d(0, ${(goodNorm * 18).toFixed(1)}px, 0)`,
            goodOpacity: (1 - goodNorm * 0.7).toFixed(2),
            copyTransform: `translate3d(0, ${(copyNorm * 14).toFixed(1)}px, 0)`,
            copyOpacity: (1 - copyNorm * 0.65).toFixed(2)
          };
        },

        render(measurement) {
          if (!measurement) return;

          update(mark, "transform", measurement.markTransform);
          update(mark, "opacity", measurement.markOpacity);
          update(goodWord, "transform", measurement.goodTransform);
          update(goodWord, "opacity", measurement.goodOpacity);
          update(copy, "transform", measurement.copyTransform);
          update(copy, "opacity", measurement.copyOpacity);
        },

        destroy() {
          if (layoutObserver) layoutObserver.disconnect();
          [mark, goodWord, copy].filter(Boolean).forEach((element) => {
            clearStyle(element, "transform", "transform");
            clearStyle(element, "opacity", "opacity");
            clearStyle(element, "filter", "filter");
          });
          last.clear();
        }
      };
    }

    createTimelineModule() {
      let section = null;
      let timeline = null;
      let lineFill = null;
      let steps = [];
      let layoutObserver = null;
      let geometry = null;
      const last = new WeakMap();
      let lastLineTransform = "";

      const refreshGeometry = () => {
        if (!timeline || !steps.length) return;

        const stepGeometry = steps.map((step) => {
          const offsetTop = getLayoutOffsetTop(step, timeline);
          return {
            step,
            relativeCenter: offsetTop + step.offsetHeight * 0.35,
            relativeNodeCenter: offsetTop + 20,
            title: step.querySelector("h3"),
            copy: step.querySelector("p")
          };
        });

        geometry = {
          firstNodeCenter: stepGeometry[0].relativeNodeCenter,
          lastNodeCenter: stepGeometry[stepGeometry.length - 1].relativeNodeCenter,
          steps: stepGeometry
        };
      };

      const updateStep = (step, property, value) => {
        let state = last.get(step);
        if (!state) {
          state = {};
          last.set(step, state);
        }
        if (state[property] === value) return;
        state[property] = value;
        writeStyle(step, property, value);
      };

      return {
        section: null,
        isVisible: false,

        init(engine) {
          section = doc.querySelector("#program");
          this.section = section;
          if (!section) return;

          section.setAttribute("data-fx-section", "timeline");
          timeline = section.querySelector(".timeline");
          lineFill = section.querySelector(".timeline-line-fill");
          steps = Array.from(section.querySelectorAll(".timeline-step"));
          refreshGeometry();

          if ("ResizeObserver" in win) {
            layoutObserver = new ResizeObserver(() => {
              refreshGeometry();
              engine.schedule();
            });
            [section, timeline, ...steps].filter(Boolean).forEach((element) => layoutObserver.observe(element));
          }
        },

        onEnter() {
          refreshGeometry();
        },

        measure(vh) {
          if (!timeline || !geometry || !geometry.steps.length) return null;

          const timelineTop = timeline.getBoundingClientRect().top;
          const firstNodeCenter = timelineTop + geometry.firstNodeCenter;
          const lastNodeCenter = timelineTop + geometry.lastNodeCenter;
          const totalSpan = Math.max(1, lastNodeCenter - firstNodeCenter);
          const triggerLine = vh * 0.5;
          const progress = Math.max(0, Math.min(1, (triggerLine - firstNodeCenter) / totalSpan));

          let closestIndex = 0;
          let closestDistance = Number.POSITIVE_INFINITY;
          const states = geometry.steps.map((item, index) => {
            const stepCenter = timelineTop + item.relativeCenter;
            const distance = Math.abs(stepCenter - triggerLine);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestIndex = index;
            }
            return { ...item, stepCenter, distance };
          });

          return {
            lineTransform: `scaleY(${progress.toFixed(3)})`,
            steps: states.map((item, index) => {
              const distFromCenter = item.stepCenter - triggerLine;
              const isReached = item.stepCenter <= triggerLine + 20;
              const isFocused = index === closestIndex && closestDistance < vh * 0.22;
              let opacity;
              let offsetX;

              if (distFromCenter > 0) {
                const normApproach = Math.min(1, distFromCenter / (vh * 0.42));
                opacity = 1 - normApproach * 0.72;
                offsetX = (1 - normApproach) * 3;
              } else {
                const normPast = Math.min(1, Math.abs(distFromCenter) / (vh * 0.5));
                opacity = 1 - normPast * 0.32;
                offsetX = 0;
              }

              const normDistance = Math.max(-1, Math.min(1, (item.stepCenter - triggerLine) / triggerLine));

              return {
                step: item.step,
                title: item.title,
                copy: item.copy,
                isReached,
                isFocused,
                opacity: opacity.toFixed(2),
                transform: `translate3d(${offsetX.toFixed(1)}px, 0, 0)`,
                titleTransform: `translate3d(0, ${(normDistance * -12).toFixed(1)}px, 0)`,
                copyTransform: `translate3d(0, ${(normDistance * -5).toFixed(1)}px, 0)`
              };
            })
          };
        },

        render(measurement) {
          if (!measurement) return;

          if (measurement.lineTransform !== lastLineTransform) {
            lastLineTransform = measurement.lineTransform;
            writeStyle(lineFill, "transform", measurement.lineTransform);
          }

          measurement.steps.forEach((state) => {
            setClassIfChanged(state.step, "is-active", state.isReached);
            setClassIfChanged(state.step, "is-focused", state.isFocused);
            updateStep(state.step, "opacity", state.opacity);
            updateStep(state.step, "transform", state.transform);
            updateStep(state.title, "transform", state.titleTransform);
            updateStep(state.copy, "transform", state.copyTransform);
          });
        },

        destroy() {
          if (layoutObserver) layoutObserver.disconnect();
          clearStyle(lineFill, "transform", "transform");
          steps.forEach((step) => {
            step.classList.remove("is-active", "is-focused");
            clearStyle(step, "opacity", "opacity");
            clearStyle(step, "transform", "transform");
            clearStyle(step, "filter", "filter");
            [step.querySelector("h3"), step.querySelector("p")].filter(Boolean).forEach((child) => {
              clearStyle(child, "transform", "transform");
            });
          });
          lastLineTransform = "";
        }
      };
    }

    createExperienceMaskModule() {
      let choicesTrack = null;
      let choicesDock = null;
      let layoutObserver = null;
      let scheduleMask = null;
      let lastLeftFade = false;
      let lastRightFade = false;

      return {
        section: null,
        // Gated by the shared IntersectionObserver: scrollWidth/clientWidth are
        // layout reads, and there is no reason to pay for them off-screen.
        isVisible: false,

        init(engine) {
          choicesTrack = doc.querySelector(".experience-choices");
          choicesDock = doc.querySelector(".experience-choices-dock");
          if (!choicesTrack || !choicesDock) return;

          choicesDock.setAttribute("data-fx-section", "experienceMask");
          this.section = choicesDock;

          scheduleMask = engine.schedule;
          choicesTrack.addEventListener("scroll", scheduleMask, { passive: true });

          if ("ResizeObserver" in win) {
            layoutObserver = new ResizeObserver(scheduleMask);
            layoutObserver.observe(choicesTrack);
            layoutObserver.observe(choicesDock);
          }
        },

        measure() {
          if (!choicesTrack) return null;

          const maxScroll = Math.max(0, choicesTrack.scrollWidth - choicesTrack.clientWidth);
          const scrollLeft = choicesTrack.scrollLeft;

          return {
            leftFade: scrollLeft > 6,
            rightFade: maxScroll - scrollLeft > 6
          };
        },

        render(measurement) {
          if (!measurement || !choicesDock) return;

          if (measurement.leftFade !== lastLeftFade) {
            lastLeftFade = measurement.leftFade;
            setClassIfChanged(choicesDock, "has-left-fade", measurement.leftFade);
          }
          if (measurement.rightFade !== lastRightFade) {
            lastRightFade = measurement.rightFade;
            setClassIfChanged(choicesDock, "has-right-fade", measurement.rightFade);
          }
        },

        destroy() {
          if (choicesTrack && scheduleMask) choicesTrack.removeEventListener("scroll", scheduleMask);
          if (layoutObserver) layoutObserver.disconnect();
          if (choicesDock) {
            choicesDock.removeAttribute("data-fx-section");
            choicesDock.classList.remove("has-left-fade", "has-right-fade");
          }
          lastLeftFade = false;
          lastRightFade = false;
        }
      };
    }

    destroy() {
      if (!this.isInitialized || !win || !doc) return;

      if (this.observer) this.observer.disconnect();
      if (this.frameId) cancelAnimationFrame(this.frameId);

      this.activeModules.forEach((module) => {
        if (typeof module.destroy === "function") module.destroy();
      });

      win.removeEventListener("scroll", this.schedule);
      win.removeEventListener("resize", this.onResize);
      doc.removeEventListener("visibilitychange", this.onVisibilityChange);
      root.removeAttribute("data-fx-tier");

      this.activeModules.clear();
      this.observer = null;
      this.frameId = 0;
      this.framePending = false;
      this.isInitialized = false;
    }
  }

  return new FXEngine();
});
