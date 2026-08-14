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
     */

    createBackgroundModule() {
      const sceneMotion = {
        hero: { x: 0, y: 12, scale: 1 },
        projects: { x: -3, y: 0, scale: 1.02 },
        turn: { x: 4, y: -10, scale: 1.03 },
        program: { x: -4, y: 8, scale: 1.04 },
        experience: { x: 3, y: -6, scale: 1.02 },
        spotlight: { x: 0, y: 10, scale: 1.05 },
        deep: { x: 0, y: -4, scale: 1 }
      };

      // Scene i is fully settled once its section top sits this far into the
      // viewport. Small value keeps the stage change close to its content.
      const ANCHOR_FRACTION = 0.18;
      const MIN_ANCHOR_GAP = 120;

      let container = null;
      let planeA = null;
      let planeB = null;
      let atmosphereA = null;
      let atmosphereB = null;
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
      };

      return {
        isVisible: true,

        init(engine) {
          container = doc.querySelector(".page-background");
          planeA = doc.querySelector(".background-plane-primary");
          planeB = doc.querySelector(".background-plane-secondary");
          atmosphereA = planeA ? planeA.querySelector(".background-atmosphere") : null;
          atmosphereB = planeB ? planeB.querySelector(".background-atmosphere") : null;
          sections = Array.from(doc.querySelectorAll("[data-scene]"));

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

          // Touch tiers animate the reveal only: one moving layer, no
          // transparent full-screen layers blended on top of it.
          if (engine.isLite) {
            return { baseIndex: index, revealTransform, baseDrift: null, overDrift: null };
          }

          // Drift follows raw progress so the scene keeps moving with the
          // scroll even while the eased reveal is parked at an extreme.
          const driftX = mix(fromMotion.x, toMotion.x, progress);
          const driftY = mix(fromMotion.y, toMotion.y, progress);
          const driftScale = mix(fromMotion.scale, toMotion.scale, progress);

          return {
            baseIndex: index,
            revealTransform,
            baseDrift: `translate3d(${driftX.toFixed(2)}vw, ${driftY.toFixed(1)}px, 0) scale(${driftScale.toFixed(3)})`,
            overDrift: `translate3d(${(driftX * 0.72).toFixed(2)}vw, ${(driftY * 0.72).toFixed(1)}px, 0) scale(${driftScale.toFixed(3)})`
          };
        },

        render(measurement) {
          if (!measurement) return;

          applyRoles(measurement.baseIndex);

          writeStyle(overPlane, "transform", measurement.revealTransform);
          if (measurement.baseDrift) {
            writeStyle(baseAtmosphere, "transform", measurement.baseDrift);
            writeStyle(overAtmosphere, "transform", measurement.overDrift);
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

          baseIndex = -1;
          basePlane = null;
          overPlane = null;
          baseAtmosphere = null;
          overAtmosphere = null;
          anchors = [];
          anchorViewport = -1;
        }
      };
    }
