/* AITC — parallax hero */
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
    { threshold: 0.25 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  if (reduced) return;

  const bg = document.querySelector(".hero-bg");
  const lines = [...document.querySelectorAll(".line")];
  const cta = document.querySelector(".hero-cta");
  const hero = document.querySelector(".hero");

  let scrollY = window.scrollY;
  let px = 0; // pointer target, -1..1
  let py = 0;
  let cx = 0; // lerped pointer
  let cy = 0;
  let ticking = false;
  let animatedOnce = false;

  // Allow CSS entrance keyframe animation to complete before applying JS transform at scroll=0
  setTimeout(() => {
    animatedOnce = true;
  }, 1000);

  const onScroll = () => {
    scrollY = window.scrollY;
    requestTick();
  };

  const onPointer = (e) => {
    px = (e.clientX / window.innerWidth) * 2 - 1;
    py = (e.clientY / window.innerHeight) * 2 - 1;
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
    const vh = window.innerHeight;

    // hero has left viewport
    if (scrollY > vh * 1.3) return;

    // ease pointer toward target
    cx += (px - cx) * 0.07;
    cy += (py - cy) * 0.07;

    // gradient drift
    if (bg) bg.style.transform = `translate3d(0, ${(scrollY * 0.12).toFixed(2)}px, 0)`;

    // apply parallax transforms when scrolled or after initial entrance animation completes
    if (scrollY > 0 || animatedOnce) {
      lines.forEach((line, i) => {
        const depth = (i + 1) / lines.length;
        const lift = -scrollY * (0.08 + i * 0.07);
        const mx = cx * 9 * depth;
        const my = cy * 6 * depth;
        const fade = Math.max(0, 1 - scrollY / (vh * 0.8));
        line.style.transform = `translate3d(${mx.toFixed(2)}px, ${(lift + my).toFixed(2)}px, 0)`;
        line.style.opacity = fade.toFixed(3);
      });

      if (cta) {
        const lift = -scrollY * 0.22;
        const mx = cx * 8;
        const my = cy * 5;
        const fade = Math.max(0, 1 - scrollY / (vh * 0.75));
        cta.style.transform = `translate3d(${mx.toFixed(2)}px, ${(lift + my).toFixed(2)}px, 0)`;
        cta.style.opacity = fade.toFixed(3);
      }
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onPointer, { passive: true });
  if (hero) {
    hero.addEventListener("pointerleave", () => {
      px = 0;
      py = 0;
      requestTick();
    });
  }
})();
