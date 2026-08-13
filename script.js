(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const nav = document.querySelector(".site-nav");
  const hero = document.querySelector(".hero");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const revealElements = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "200px 0px 50% 0px", threshold: 0.01 }
    );

    revealElements.forEach((element) => revealObserver.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("in"));
  }

  if (reducedMotion) {
    revealElements.forEach((element) => element.classList.add("in"));
  }

  if (nav && hero) {
    const navObserver = new IntersectionObserver(
      ([entry]) => nav.classList.toggle("is-scrolled", !entry.isIntersecting),
      { threshold: 0.12 }
    );
    navObserver.observe(hero);
  }

  const sections = document.querySelectorAll("[data-chrome][data-scene]");
  const navLinks = document.querySelectorAll("[data-nav-link]");
  let lastChromeColor = "";
  const updateTheme = (section) => {
    const color = section.dataset.chrome;
    const scene = section.dataset.scene;
    if (!color || !scene) return;

    root.dataset.scene = scene;

    if (color !== lastChromeColor) {
      root.style.setProperty("--chrome-bridge", color);
      root.style.setProperty("--scene-tint", color);
      root.style.setProperty("--overscroll-color", color);
      if (themeMeta) themeMeta.setAttribute("content", color);
      lastChromeColor = color;
    }

    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${section.id}`);
    });
  };

  if (sections.length) updateTheme(sections[0]);

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) updateTheme(entry.target);
      });
    },
    { rootMargin: "-42% 0px -42% 0px", threshold: 0 }
  );

  sections.forEach((section) => sectionObserver.observe(section));

  const track = document.querySelector("#project-track");
  const cards = track ? [...track.querySelectorAll(".project-card")] : [];
  const dots = [...document.querySelectorAll(".dot")];

  const setActiveCard = (index) => {
    cards.forEach((card, cardIndex) => card.classList.toggle("is-active", cardIndex === index));
    dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
      dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
    });
  };

  if (track && cards.length) {
    const updateActiveFromCenter = () => {
      const trackBounds = track.getBoundingClientRect();
      const trackCenter = trackBounds.left + trackBounds.width / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;

      cards.forEach((card, index) => {
        const bounds = card.getBoundingClientRect();
        const visible = bounds.right > trackBounds.left && bounds.left < trackBounds.right;
        if (!visible) return;
        const distance = Math.abs((bounds.left + bounds.right) / 2 - trackCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveCard(closestIndex);
    };

    const cardObserver = new IntersectionObserver(
      () => updateActiveFromCenter(),
      { root: track, threshold: 0.65 }
    );

    cards.forEach((card) => cardObserver.observe(card));
    updateActiveFromCenter();

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const index = Number(dot.dataset.slide);
        cards[index]?.scrollIntoView({
          behavior: reducedMotion ? "auto" : "smooth",
          block: "nearest",
          inline: "center"
        });
      });
    });

    if (!reducedMotion && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      cards.forEach((card) => {
        let bounds = null;
        let frameId = 0;
        let latestPointer = null;

        const resetTilt = () => {
          if (frameId) cancelAnimationFrame(frameId);
          frameId = 0;
          latestPointer = null;
          bounds = null;
          card.style.removeProperty("--card-tilt-x");
          card.style.removeProperty("--card-tilt-y");
          card.style.removeProperty("will-change");
        };

        card.addEventListener("pointerenter", () => {
          bounds = card.getBoundingClientRect();
          card.style.willChange = "transform";
        });

        card.addEventListener("pointermove", (event) => {
          if (!bounds) bounds = card.getBoundingClientRect();
          latestPointer = { x: event.clientX, y: event.clientY };
          if (frameId) return;

          frameId = requestAnimationFrame(() => {
            frameId = 0;
            if (!bounds || !latestPointer) return;
            const x = (latestPointer.x - bounds.left) / bounds.width - 0.5;
            const y = (latestPointer.y - bounds.top) / bounds.height - 0.5;
            card.style.setProperty("--card-tilt-x", `${(-y * 2.4).toFixed(2)}deg`);
            card.style.setProperty("--card-tilt-y", `${(x * 2.8).toFixed(2)}deg`);
          });
        });

        card.addEventListener("pointerleave", resetTilt);
        card.addEventListener("pointercancel", resetTilt);
      });
    }
  }

  const timeline = document.querySelector("[data-timeline]");
  if (timeline && reducedMotion) timeline.classList.add("in");

  const experienceData = {
    workshops: {
      title: "make your first project.",
      copy: "a place to try something small, ask questions, and leave with something you made."
    },
    "project teams": {
      title: "take an idea further.",
      copy: "find people who care about the same problem and keep building together."
    },
    competitions: {
      title: "test what you built.",
      copy: "share your work, learn from the room, and see how far the idea can go."
    },
    community: {
      title: "make something useful for others.",
      copy: "work on ideas that can help your school, your neighborhood, or someone who needs it."
    },
    entrepreneurship: {
      title: "turn a strong project into something bigger.",
      copy: "keep asking good questions and see where the work can lead."
    }
  };

  const experienceButtons = document.querySelectorAll(".experience-choice");
  const experienceContent = document.querySelector(".experience-panel-content");
  const experienceTitle = document.querySelector("#experience-panel-title");
  const experienceCopy = document.querySelector("#experience-panel-copy");
  let experienceAnimation = null;
  let experienceRequest = 0;

  const stopExperienceAnimation = () => {
    if (!experienceAnimation) return;
    experienceAnimation.cancel();
    experienceAnimation = null;
  };

  experienceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.experienceKey;
      const content = experienceData[key];
      if (!content || !experienceTitle || !experienceCopy) return;

      experienceButtons.forEach((choice) => {
        const active = choice === button;
        choice.classList.toggle("is-active", active);
        choice.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (reducedMotion) {
        experienceTitle.textContent = content.title;
        experienceCopy.textContent = content.copy;
        return;
      }

      if (!experienceContent) return;

      const request = ++experienceRequest;
      const computed = getComputedStyle(experienceContent);
      const startOpacity = Number.parseFloat(computed.opacity);
      const startTransform = computed.transform === "none" ? "translate3d(0, 0, 0)" : computed.transform;
      stopExperienceAnimation();
      experienceContent.style.willChange = "opacity, transform";

      const exitAnimation = experienceContent.animate(
        [
          { opacity: Number.isFinite(startOpacity) ? startOpacity : 1, transform: startTransform },
          { opacity: 0, transform: "translate3d(0, 8px, 0)" }
        ],
        { duration: 160, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" }
      );
      experienceAnimation = exitAnimation;

      exitAnimation.finished
        .then(() => {
          if (request !== experienceRequest) return;
          experienceTitle.textContent = content.title;
          experienceCopy.textContent = content.copy;

          const enterAnimation = experienceContent.animate(
            [
              { opacity: 0, transform: "translate3d(0, -8px, 0)" },
              { opacity: 1, transform: "translate3d(0, 0, 0)" }
            ],
            { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" }
          );
          experienceAnimation = enterAnimation;

          return enterAnimation.finished.then(() => {
            if (request !== experienceRequest) return;
            experienceContent.style.willChange = "auto";
            experienceAnimation = null;
          });
        })
        .catch(() => {
          if (request === experienceRequest) experienceContent.style.willChange = "auto";
        });
    });
  });
})();
