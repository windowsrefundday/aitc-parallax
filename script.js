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
    /* Stage content before it reaches the viewport so scroll does not reveal a
       completely transparent heading in the same frame it becomes visible. */
    { rootMargin: "0px 0px 18% 0px", threshold: 0.01 }
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


  /* Best-effort browser chrome tint. Chrome/iOS may keep its own UI color while scrolling. */
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const gradientStops = [
    [0.00, [255, 243, 203]],
    [0.08, [240, 233, 176]],
    [0.17, [211, 215, 164]],
    [0.28, [169, 196, 147]],
    [0.39, [121, 169, 117]],
    [0.49, [78, 144, 93]],
    [0.58, [49, 115, 65]],
    [0.68, [33, 100, 52]],
    [0.82, [20, 63, 39]],
    [1.00, [12, 39, 25]]
  ];
  const gradientColorAt = (progress) => {
    const p = Math.min(1, Math.max(0, progress));
    for (let i = 1; i < gradientStops.length; i += 1) {
      const [end, endRgb] = gradientStops[i];
      const [start, startRgb] = gradientStops[i - 1];
      if (p <= end) {
        const ratio = (p - start) / (end - start);
        const rgb = startRgb.map((value, index) => Math.round(value + (endRgb[index] - value) * ratio));
        return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
      }
    }
    return "#0c2719";
  };
  const updateThemeColor = () => {
    if (!themeMeta) return;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight);
    const color = gradientColorAt(progress);
    document.documentElement.style.setProperty("--chrome-bridge", color);
    const overscrollColor = window.scrollY <= 0
      ? "#fff3cb"
      : window.scrollY >= maxScroll
        ? "#0c2719"
        : color;
    document.documentElement.style.setProperty("--overscroll-color", overscrollColor);
    if (themeMeta.getAttribute("content") !== color) themeMeta.setAttribute("content", color);
  };
  updateThemeColor();
  window.addEventListener("scroll", updateThemeColor, { passive: true });

  if (reduced) return;

  const lines = [...document.querySelectorAll(".line")];
  const ctaGroup = document.querySelector(".hero-cta");

  let scrollY = window.scrollY;
  let viewportHeight = window.innerHeight;
  let px = 0;
  let py = 0;
  let cx = 0;
  let cy = 0;
  let ticking = false;

  const hasFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!hasFinePointer) return;

  const onScroll = () => {
    scrollY = window.scrollY;
    requestTick();
  };

  const onPointer = (e) => {
    if (!hasFinePointer) return;
    px = (e.clientX / window.innerWidth) * 2 - 1;
    py = (e.clientY / window.innerHeight) * 2 - 1;
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
    const vh = viewportHeight;

    // Smooth pointer lerp
    const lerpFactor = 0.08;
    cx += (px - cx) * lerpFactor;
    cy += (py - cy) * lerpFactor;

    lines.forEach((line, i) => {
      const depth = (i + 1) / lines.length;
      const liftRate = 0.09 + i * 0.08;
      const lift = -Math.min(scrollY, vh * 1.3) * liftRate;
      const driftCoeff = 0.038;
      const sideDrift = (i % 2 === 0 ? -1 : 1) * Math.min(scrollY, vh * 1.3) * driftCoeff;
      const mx = cx * 12 * depth;
      const my = cy * 8 * depth;
      const scale = Math.max(0.88, 1 - Math.min(scrollY, vh * 1.3) * 0.00035);
      const fade = Math.max(0, 1 - scrollY / (vh * 0.78));

      line.style.transform = `translate3d(${(mx + sideDrift).toFixed(2)}px, ${(lift + my).toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      line.style.opacity = fade.toFixed(3);
    });

    if (ctaGroup) {
      const cappedScroll = Math.min(scrollY, vh * 1.3);
      const baseLift = -cappedScroll * 0.22;
      const mx = cx * 14;
      const my = cy * 8;
      const fade = Math.max(0, 1 - scrollY / (vh * 0.72));
      ctaGroup.style.opacity = fade.toFixed(3);
      ctaGroup.style.transform = `translate3d(${mx.toFixed(2)}px, ${(baseLift + my).toFixed(2)}px, 0)`;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  if (hasFinePointer) window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointercancel", resetPointer, { passive: true });
  window.addEventListener("resize", () => {
    viewportHeight = window.innerHeight;
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    updateThemeColor();
    requestTick();
  }, { passive: true });
  requestTick();
})();
