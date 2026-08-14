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
