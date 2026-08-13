/* AITC — modern parallax hero */
(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* scroll reveal */
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.1 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* slider pagination */
  const slides = document.querySelectorAll(".slide-card");
  const dots = document.querySelectorAll(".slider-pagination .dot");
  if (slides.length > 0 && dots.length > 0) {
    const sliderIo = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Array.from(slides).indexOf(entry.target);
            dots.forEach((dot, i) => {
              dot.classList.toggle("active", i === index);
            });
          }
        });
      },
      { root: document.querySelector(".slider-track"), threshold: 0.5 }
    );
    slides.forEach((slide) => sliderIo.observe(slide));
  }


  /* ambient background fade & theme color */
  const bgHero = document.querySelector(".bg-hero");
  const bgPossibilities = document.querySelector(".bg-possibilities");
  const bgAbout = document.querySelector(".bg-about");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const updateBackgrounds = () => {
    const vh = window.innerHeight;
    const currentScrollY = window.scrollY;
    const docHeight = Math.max(1, document.documentElement.scrollHeight - vh);

    const heroSec = document.querySelector(".hero");
    const possSec = document.querySelector(".possibilities");

    const heroHeight = heroSec ? heroSec.offsetHeight : vh;
    const possTop = possSec ? possSec.offsetTop : heroHeight;
    const possHeight = possSec ? possSec.offsetHeight : vh;

    let heroOpacity = 1;
    let possOpacity = 0;
    let aboutOpacity = 0;

    const fadeStart1 = heroHeight * 0.35;
    const fadeEnd1 = possTop + possHeight * 0.25;

    if (currentScrollY <= fadeStart1) {
      heroOpacity = 1;
      possOpacity = 0;
      aboutOpacity = 0;
    } else if (currentScrollY < fadeEnd1) {
      const p = (currentScrollY - fadeStart1) / (fadeEnd1 - fadeStart1);
      heroOpacity = Math.max(0, 1 - p);
      possOpacity = Math.min(1, p);
      aboutOpacity = 0;
    } else {
      const fadeStart2 = fadeEnd1;
      const p = Math.min(1, Math.max(0, (currentScrollY - fadeStart2) / (docHeight - fadeStart2)));
      heroOpacity = 0;
      possOpacity = Math.max(0, 1 - p);
      aboutOpacity = Math.min(1, p);
    }

    if (bgHero) bgHero.style.opacity = heroOpacity.toFixed(3);
    if (bgPossibilities) bgPossibilities.style.opacity = possOpacity.toFixed(3);
    if (bgAbout) bgAbout.style.opacity = aboutOpacity.toFixed(3);

    if (themeMeta) {
      if (currentScrollY < heroHeight * 0.5) {
        themeMeta.setAttribute("content", "#fff3cb");
      } else if (currentScrollY < possTop + possHeight * 0.4) {
        themeMeta.setAttribute("content", "#1e5c33");
      } else {
        themeMeta.setAttribute("content", "#0c2719");
      }
    }
  };
  updateBackgrounds();
  if (reduced) return;

    const lines = [...document.querySelectorAll(".line")];
  const ctaGroup = document.querySelector(".hero-cta");
  const aboutSec = document.querySelector(".about");

  let scrollY = window.scrollY;
  let px = 0;
  let py = 0;
  let cx = 0;
  let cy = 0;
  let ticking = false;

  const isMobile = () => window.innerWidth < 768;

  const onScroll = () => {
    scrollY = window.scrollY;
    requestTick();
  };

  const onPointer = (e) => {
    if (e.pointerType === "touch") {
      px = ((e.clientX / window.innerWidth) * 2 - 1) * 0.4;
      py = ((e.clientY / window.innerHeight) * 2 - 1) * 0.4;
    } else {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
    }
    requestTick();
  };

  const resetPointer = () => {
    px = 0;
    py = 0;
    requestTick();
  };

  const requestTick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  const update = () => {
    ticking = false;
    updateBackgrounds();
    const vh = window.innerHeight;
    const mobile = isMobile();

    // Smooth pointer lerp
    const lerpFactor = mobile ? 0.12 : 0.08;
    cx += (px - cx) * lerpFactor;
    cy += (py - cy) * lerpFactor;

    /* 1. Hero Parallax */
    if (scrollY <= vh * 1.3) {
      // Parallax shifts only activate when scrolling or moving pointer (no position jump on load)
      if (scrollY > 0 || Math.abs(cx) > 0.005 || Math.abs(cy) > 0.005) {
        lines.forEach((line, i) => {
          const depth = (i + 1) / lines.length;
          const liftRate = mobile ? 0.07 + i * 0.05 : 0.09 + i * 0.08;
          const lift = -scrollY * liftRate;
          const driftCoeff = mobile ? 0.015 : 0.038;
          const sideDrift = (i % 2 === 0 ? -1 : 1) * scrollY * driftCoeff;
          const mx = cx * (mobile ? 5 : 12) * depth;
          const my = cy * (mobile ? 4 : 8) * depth;
          const scale = Math.max(0.88, (1 - scrollY * (mobile ? 0.0002 : 0.00035)).toFixed(4));
          const fade = Math.max(0, 1 - scrollY / (vh * (mobile ? 0.7 : 0.78)));

          line.style.transform = `translate3d(${(mx + sideDrift).toFixed(2)}px, ${(lift + my).toFixed(2)}px, 0) scale(${scale})`;
          line.style.opacity = fade.toFixed(3);
        });

        if (ctaGroup) {
          const baseLift = -scrollY * (mobile ? 0.16 : 0.22);
          const mx = cx * (mobile ? 6 : 14);
          const my = cy * (mobile ? 4 : 8);
          const fade = Math.max(0, 1 - scrollY / (vh * (mobile ? 0.68 : 0.72)));
          ctaGroup.style.opacity = fade.toFixed(3);
          ctaGroup.style.transform = `translate3d(${mx.toFixed(2)}px, ${(baseLift + my).toFixed(2)}px, 0)`;
        }
      }
    }

      };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointercancel", resetPointer, { passive: true });
  window.addEventListener("touchend", resetPointer, { passive: true });
  window.addEventListener("resize", requestTick, { passive: true });
})();
