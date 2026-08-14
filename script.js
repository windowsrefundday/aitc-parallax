(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const nav = document.querySelector(".site-nav");
  const hero = document.querySelector(".hero");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const staticBackgroundPlane = document.querySelector(".background-plane-primary");

  const scrollStateKey = `aitc-scroll:${window.location.pathname}${window.location.search}`;
  let savedScrollY = null;
  try {
    const storedScrollY = window.sessionStorage.getItem(scrollStateKey);
    if (storedScrollY !== null) {
      const parsedScrollY = Number(storedScrollY);
      if (Number.isFinite(parsedScrollY)) savedScrollY = parsedScrollY;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const restoreScrollPosition = () => {
    const hash = window.location.hash.slice(1);
    const hashTarget = hash ? document.getElementById(hash) : null;
    if (savedScrollY !== null) {
      window.scrollTo({ top: savedScrollY, behavior: "auto" });
    } else if (hashTarget) {
      hashTarget.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
    }
  };

  restoreScrollPosition();
  window.addEventListener("pagehide", () => {
    try {
      window.sessionStorage.setItem(scrollStateKey, String(window.scrollY));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const hash = link.getAttribute("href");
      const target = hash ? document.getElementById(hash.slice(1)) : null;
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
        inline: "nearest"
      });

      if (window.location.hash !== hash) {
        window.history.pushState(null, "", hash);
      }
    });
  });

  const revealElements = Array.from(document.querySelectorAll(".reveal")).filter((el) => el.id !== "turn");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "60px 0px", threshold: 0 }
    );

    revealElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight + 80) {
        element.classList.add("in");
      } else {
        revealObserver.observe(element);
      }
    });

    const turnSection = document.querySelector("#turn");
    if (turnSection) {
      const turnObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            turnSection.classList.add("in");
            observer.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -42% 0px", threshold: 0 }
      );
      turnObserver.observe(turnSection);
    }
  } else {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("in"));
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

    if (reducedMotion && staticBackgroundPlane && staticBackgroundPlane.dataset.backgroundScene !== scene) {
      staticBackgroundPlane.dataset.backgroundScene = scene;
    }

    if (color !== lastChromeColor) {
      // --overscroll-color is the only consumed custom property here; writing
      // the unused ones invalidated style for the whole document per section.
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

  const setupCardRail = (trackSelector, dotsSelector) => {
    const track = document.querySelector(trackSelector);
    const cards = track ? [...track.querySelectorAll(".project-card")] : [];
    const dots = [...document.querySelectorAll(`${dotsSelector} .dot`)];

    if (!track || !cards.length) return;

    const setActiveCard = (index) => {
      cards.forEach((card, cardIndex) => card.classList.toggle("is-active", cardIndex === index));
      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle("is-active", dotIndex === index);
        dot.setAttribute("aria-current", dotIndex === index ? "true" : "false");
      });
    };

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
  };

  setupCardRail("#project-track", "#project-dots");
  setupCardRail("#breakthroughs-track", "#breakthrough-dots");

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

      button.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });

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

  // Initialize Modular AITC_FX Engine
  if (window.AITC_FX && typeof window.AITC_FX.init === "function") {
    window.AITC_FX.init();
  }
})();
