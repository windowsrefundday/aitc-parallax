/* AITC — modern parallax hero & scrub reveal */
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

  const hero = document.querySelector(".hero");
  const bg = document.querySelector(".hero-bg");
  const lines = [...document.querySelectorAll(".line")];
  const ctaGroup = document.querySelector(".hero-cta");
  const ctaMain = document.querySelector(".cta-main");
  const ctaFade = document.querySelector(".cta-fade");
  const aboutSec = document.querySelector(".about");
  const scrubWords = [...document.querySelectorAll(".scrub-word")];

  let scrollY = window.scrollY;
  let px = 0; // pointer target, -1..1
  let py = 0;
  let cx = 0; // lerped pointer
  let cy = 0;
  let ticking = false;
  let animatedOnce = false;

  // Allow initial CSS entrance animation to run uninterrupted
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

    // Smooth pointer lerp
    cx += (px - cx) * 0.08;
    cy += (py - cy) * 0.08;

    /* 1. Hero Parallax & 3D Tilt */
    if (scrollY <= vh * 1.3) {
      // Gentle 3D poster rotation from pointer
      const rotX = (-cy * 2.8).toFixed(2);
      const rotY = (cx * 3.8).toFixed(2);

      if (hero) {
        hero.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg)`;
      }

      // Background drift
      if (bg) {
        bg.style.transform = `translate3d(${(cx * -15).toFixed(2)}px, ${(scrollY * 0.14 + cy * -10).toFixed(2)}px, -30px) scale(1.08)`;
      }

      // Apply line transforms after initial entrance
      if (scrollY > 0 || animatedOnce) {
        lines.forEach((line, i) => {
          const depth = (i + 1) / lines.length;
          const lift = -scrollY * (0.09 + i * 0.08);
          // Alternate horizontal drift: odd lines left, even lines right
          const sideDrift = (i % 2 === 0 ? -1 : 1) * scrollY * 0.038;
          const mx = cx * 12 * depth;
          const my = cy * 8 * depth;
          const scale = Math.max(0.85, (1 - scrollY * 0.00035).toFixed(4));
          const fade = Math.max(0, 1 - scrollY / (vh * 0.78));

          line.style.transform = `translate3d(${(mx + sideDrift).toFixed(2)}px, ${(lift + my).toFixed(2)}px, ${i * 8}px) scale(${scale})`;
          line.style.opacity = fade.toFixed(3);
        });

        // Opposing CTA velocity & floating depth
        if (ctaGroup) {
          const baseLift = -scrollY * 0.22;
          const fade = Math.max(0, 1 - scrollY / (vh * 0.72));
          ctaGroup.style.opacity = fade.toFixed(3);
          ctaGroup.style.transform = `translate3d(${(cx * 14).toFixed(2)}px, ${(baseLift + cy * 8).toFixed(2)}px, 40px)`;
        }

        if (ctaMain) {
          const mainLift = -scrollY * 0.06;
          ctaMain.style.transform = `translate3d(0, ${mainLift.toFixed(2)}px, 15px)`;
        }

        if (ctaFade) {
          const fadeLift = scrollY * 0.04;
          ctaFade.style.transform = `translate3d(0, ${fadeLift.toFixed(2)}px, 5px)`;
        }
      }
    }

    /* 2. Scrubbing Text Reveal & Depth Shift in #about */
    if (aboutSec) {
      const rect = aboutSec.getBoundingClientRect();
      const viewCenter = vh * 0.6;
      const progress = Math.max(0, Math.min(1, (viewCenter - rect.top) / rect.height));

      // Deep obsidian green background shift
      if (progress > 0) {
        aboutSec.style.background = `linear-gradient(180deg, #1e5c33 0%, #103822 ${(progress * 40).toFixed(1)}%, #07190e 100%)`;
      }

      // Word-by-word scrub reveal
      if (scrubWords.length > 0 && rect.top < vh && rect.bottom > 0) {
        scrubWords.forEach((word, idx) => {
          const threshold = 0.2 + idx * 0.12;
          if (progress > threshold) {
            const wordVal = Math.min(1, (progress - threshold) / 0.15);
            word.style.opacity = wordVal.toFixed(3);
            word.style.transform = `translate3d(0, ${((1 - wordVal) * 18).toFixed(2)}px, 0)`;
            word.style.filter = `blur(${((1 - wordVal) * 6).toFixed(1)}px)`;
          } else {
            word.style.opacity = "0.2";
            word.style.transform = "translate3d(0, 18px, 0)";
            word.style.filter = "blur(6px)";
          }
        });
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
