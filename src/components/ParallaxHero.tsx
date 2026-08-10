import React, { useEffect, useRef, useState } from 'react';

interface ParallaxHeroProps {
  // Configurable positioning controls for image alignment
  initialFgScale?: number;
  initialFgX?: number;
  initialFgY?: number;
}

export const ParallaxHero: React.FC<ParallaxHeroProps> = ({
  initialFgScale = 1.03,
  initialFgX = 54,
  initialFgY = 30,
}) => {
  // Configurable positioning state for visual tuning
  const [fgScale, setFgScale] = useState(initialFgScale);
  const [fgOffsetX, setFgOffsetX] = useState(initialFgX);
  const [fgOffsetY, setFgOffsetY] = useState(initialFgY);
  const [showTuning, setShowTuning] = useState(false);

  // Parallax animation state refs (prevent React re-renders on scroll)
  const bgRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<HTMLDivElement>(null);

  // Motion physics variables
  const currentScroll = useRef(0);
  const targetScroll = useRef(0);
  const animFrameId = useRef<number | null>(null);
  const isReducedMotion = useRef(false);

  useEffect(() => {
    // Check user preferred reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion.current = mediaQuery.matches;

    const handleMediaChange = (e: MediaQueryListEvent) => {
      isReducedMotion.current = e.matches;
    };
    mediaQuery.addEventListener('change', handleMediaChange);

    // Scroll listener updating target scroll position
    const handleScroll = () => {
      targetScroll.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Smooth rAF Lerp Loop
    const lerp = (start: number, end: number, factor: number) => {
      return start + (end - start) * factor;
    };

    const updateParallax = () => {
      if (isReducedMotion.current) {
        // Reset transforms if reduced motion is requested
        if (bgRef.current) bgRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        if (headlineRef.current) headlineRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
        if (fgRef.current) fgRef.current.style.transform = `translate3d(${fgOffsetX}px, ${fgOffsetY}px, 0px) scale(${fgScale})`;
        animFrameId.current = requestAnimationFrame(updateParallax);
        return;
      }

      // Smoothly interpolate current scroll toward target scroll
      currentScroll.current = lerp(currentScroll.current, targetScroll.current, 0.08);
      const scroll = currentScroll.current;

      // Mobile check: reduce motion substantially on mobile screens (< 768px)
      const isMobile = window.innerWidth < 768;
      const motionFactor = isMobile ? 0.35 : 1.0;

      // Parallax calculations (scrolling down moves mountain UP)
      const bgY = scroll * 0.08 * motionFactor;
      const headlineY = scroll * 0.18 * motionFactor;
      const fgY = scroll * -0.38 * motionFactor;
      const fgX = scroll * -0.03 * motionFactor;

      // Apply transforms
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0px, ${bgY.toFixed(2)}px, 0px)`;
      }
      if (headlineRef.current) {
        headlineRef.current.style.transform = `translate3d(0px, ${headlineY.toFixed(2)}px, 0px)`;
      }
      if (fgRef.current) {
        const totalX = fgX + (isMobile ? fgOffsetX * 0.4 : fgOffsetX);
        const totalY = fgY + (isMobile ? fgOffsetY * 0.4 : fgOffsetY);
        fgRef.current.style.transform = `translate3d(${totalX.toFixed(2)}px, ${totalY.toFixed(2)}px, 0px) scale(${fgScale})`;
      }

      animFrameId.current = requestAnimationFrame(updateParallax);
    };

    animFrameId.current = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      mediaQuery.removeEventListener('change', handleMediaChange);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [fgScale, fgOffsetX, fgOffsetY]);

  return (
    <div className="relative w-full min-h-[230vh] bg-[#0b0d10] text-[#f5f5f0]">
      {/* Fixed Sticky Hero Container */}
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden select-none">

        {/* LAYER 1: Background Landscape Image (z-index 10) */}
        <div
          ref={bgRef}
          className="absolute inset-0 w-full h-full z-10 will-change-transform pointer-events-none"
        >
          <img
            src="./hero-bg.png"
            alt="Sky, distant mountains and valley landscape background"
            className="w-full h-full object-cover object-[75%_center] md:object-center scale-[1.05]"
          />
        </div>

        {/* LAYER 2: Navigation & Hero Typography (z-index 20) */}
        <div
          ref={headlineRef}
          className="absolute inset-0 w-full h-full z-20 will-change-transform flex flex-col justify-between p-4 sm:p-8 md:p-12 lg:p-16 pointer-events-none"
        >
          {/* Header Navigation Bar */}
          <header className="w-full flex items-center justify-between pointer-events-auto">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <span className="font-black tracking-widest text-xl sm:text-2xl md:text-3xl text-white">AITC</span>
              <span className="h-4 sm:h-5 w-[1px] sm:w-[2px] bg-white/30"></span>
              <span className="text-[10px] sm:text-xs md:text-sm font-mono uppercase tracking-widest text-white/80 font-semibold">
                AI & TECH
              </span>
            </div>

            <nav className="hidden md:flex items-center space-x-10 text-sm font-semibold tracking-widest text-white/90">
              <a href="#about" className="hover:text-white transition-colors">ABOUT</a>
              <a href="#projects" className="hover:text-white transition-colors">PROJECTS</a>
              <a href="#events" className="hover:text-white transition-colors">EVENTS</a>
              <a href="#resources" className="hover:text-white transition-colors">RESOURCES</a>
              <a href="#join" className="flex items-center space-x-2 hover:text-white transition-colors">
                <span>JOIN</span>
                <span className="w-2 h-2 rounded-full bg-[#c5a059]"></span>
              </a>
            </nav>
          </header>

          {/* Center Main Headline Content */}
          <main className="my-auto w-full max-w-7xl mx-auto pt-2 md:pt-4">
            {/* Small Eyebrow */}
            <div className="mb-2 sm:mb-4">
              <span className="inline-block text-xs sm:text-sm md:text-base font-mono tracking-[0.25em] sm:tracking-[0.3em] font-bold text-[#c5a059] uppercase">
                AITC
              </span>
            </div>

            {/* Oversized Bold Headline (Responsive wrapping for mobile vs desktop) */}
            <h1 className="font-display font-black tracking-tight text-white uppercase max-w-full md:max-w-6xl 2xl:max-w-7xl drop-shadow-lg flex flex-col items-start">
              <span className="block text-3xl sm:text-4xl md:text-[4.2rem] lg:text-[5.4rem] xl:text-[6.3rem] 2xl:text-[7rem] leading-none md:leading-[0.88] whitespace-normal md:whitespace-nowrap break-words max-w-full">
                WHAT IF YOU COULD
              </span>
              <span className="block text-white/95 text-3.5xl sm:text-5xl md:text-[4.8rem] lg:text-[6.2rem] xl:text-[7.2rem] 2xl:text-[8rem] leading-none md:leading-[0.88] whitespace-normal md:whitespace-nowrap break-words mt-1 md:mt-0 max-w-full">
                BUILD ANYTHING?
              </span>
            </h1>

            {/* Supporting Subtitle */}
            <p className="mt-3 sm:mt-6 text-lg sm:text-2xl md:text-3xl lg:text-4xl font-serif italic text-white/95 font-normal tracking-wide drop-shadow">
              You probably can.
            </p>

            {/* CTA Buttons */}
            <div className="mt-6 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-8 pointer-events-auto">
              <a
                href="#join"
                className="px-6 py-3 sm:px-10 sm:py-4 border-2 border-[#c5a059] text-[#c5a059] text-xs sm:text-sm font-mono font-bold tracking-widest uppercase hover:bg-[#c5a059] hover:text-[#0b0d10] transition-all duration-300 rounded-sm shadow-lg"
              >
                JOIN AITC →
              </a>
              <a
                href="#explore"
                className="text-xs sm:text-sm font-mono font-bold tracking-widest uppercase text-white/80 hover:text-white transition-colors flex items-center space-x-2 sm:space-x-3"
              >
                <span>EXPLORE</span>
                <span className="text-[#c5a059] text-base sm:text-lg">↓</span>
              </a>
            </div>
          </main>

          {/* Hero Bottom Bar */}
          <footer className="w-full flex items-end justify-between text-[11px] sm:text-sm md:text-base font-mono font-semibold tracking-widest text-white/80">
            <div className="hidden sm:block leading-relaxed uppercase">
              Connect.<br />
              Collaborate.<br />
              Create Impact.
            </div>

            {/* SCROLL ↓ Indicator */}
            <div className="mx-auto sm:mx-0 flex flex-col items-center space-y-1 sm:space-y-2 animate-pulse">
              <span className="text-[11px] sm:text-xs md:text-sm font-mono font-bold tracking-[0.2em] text-white">SCROLL</span>
              <span className="text-[#c5a059] text-lg sm:text-xl font-bold">↓</span>
            </div>
          </footer>
        </div>

        {/* LAYER 3: Transparent Foreground Mountain / Forest PNG (z-index 30) */}
        {/* Extended bottom height (-bottom-[45vh]) ensures upward movement never exposes a bottom gap */}
        <div
          ref={fgRef}
          className="absolute -inset-x-0 top-0 -bottom-[45vh] w-full h-[145vh] z-30 will-change-transform pointer-events-none origin-top"
        >
          <img
            src="./hero-fg.png"
            alt="Foreground right-side cliff and forested mountain slope"
            className="w-full h-full object-cover object-[75%_center] md:object-center scale-[1.08]"
          />
        </div>

        {/* Optional Alignment Control Panel for Visual Tuning */}
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <button
            onClick={() => setShowTuning(!showTuning)}
            className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-black/60 backdrop-blur-md border border-white/20 text-white/70 hover:text-white rounded"
          >
            {showTuning ? 'Hide Controls' : 'Tune Alignment'}
          </button>

          {showTuning && (
            <div className="mt-2 p-4 w-64 bg-black/85 backdrop-blur-md border border-white/20 rounded shadow-2xl text-xs space-y-3 font-mono">
              <div className="font-bold text-[#c5a059] border-b border-white/10 pb-1">
                Foreground Alignment
              </div>
              
              <div>
                <label className="block text-white/70 mb-1">Scale: {fgScale.toFixed(2)}</label>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.01"
                  value={fgScale}
                  onChange={(e) => setFgScale(parseFloat(e.target.value))}
                  className="w-full accent-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1">Offset X: {fgOffsetX}px</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={fgOffsetX}
                  onChange={(e) => setFgOffsetX(parseInt(e.target.value))}
                  className="w-full accent-[#c5a059]"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1">Offset Y: {fgOffsetY}px</label>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={fgOffsetY}
                  onChange={(e) => setFgOffsetY(parseInt(e.target.value))}
                  className="w-full accent-[#c5a059]"
                />
              </div>

              <button
                onClick={() => {
                  setFgScale(1.0);
                  setFgOffsetX(0);
                  setFgOffsetY(0);
                }}
                className="w-full py-1 text-[10px] uppercase bg-white/10 hover:bg-white/20 text-white rounded transition-colors"
              >
                Reset Defaults
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section directly below hero to allow scrolling and parallax separation */}
      <section className="relative z-40 bg-[#08090a] py-24 px-6 md:px-12 text-center border-t border-white/10">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-[#c5a059]">
            AI & TECHNOLOGY INNOVATION CLUB
          </p>
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight text-white uppercase">
            THIS WEBSITE WAS BUILT WITH AI.
          </h2>
          <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-xl mx-auto">
            A single-page prototype demonstrating 2.5D depth separation, photographic alignment, and smooth lerped parallax.
          </p>
        </div>
      </section>
    </div>
  );
};
