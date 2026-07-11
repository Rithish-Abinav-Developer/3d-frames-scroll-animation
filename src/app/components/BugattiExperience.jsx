'use client';

/**
 * BugattiExperience
 * ------------------
 * Award-winning-style scroll-driven landing page.
 *
 * SETUP
 *   npm install gsap lenis
 *
 * ASSETS
 *   Put your frame sequence in:  /public/car-images/ezgif-frame-001.jpg ... ezgif-frame-240.jpg
 *   (root-relative paths like "/car-images/..." resolve correctly under Next.js,
 *   since /public is served from the domain root — no changes needed here.)
 *
 * USAGE (App Router, JS)
 *   // app/page.js
 *   import BugattiExperience from '@/components/BugattiExperience';
 *   export default function Page() {
 *     return <BugattiExperience />;
 *   }
 *
 * Only mount ONE instance of this component per page — it uses element IDs
 * internally to keep the GSAP/ScrollTrigger wiring simple and close to the
 * original implementation.
 */

import { useEffect, useRef } from 'react';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-body',
  display: 'swap',
});

const FRAME_COUNT = 240;
const FRAME_PATH = (i) =>
  `/car-images/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;

export default function BugattiExperience() {
  const rootRef = useRef(null);

  useEffect(() => {
    // Guard: this whole effect is client-only by nature of useEffect,
    // but keep an explicit mounted flag so async preload callbacks
    // never touch state/DOM after unmount.
    let mounted = true;
    let rafId = 0;

    gsap.registerPlugin(ScrollTrigger);

    /* ---------------------------------------------------------
       LENIS SMOOTH SCROLL — synced with GSAP ScrollTrigger
    --------------------------------------------------------- */
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.4,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const tickerCallback = (time) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    /* ---------------------------------------------------------
       DOM REFS (via IDs, scoped inside this component instance)
    --------------------------------------------------------- */
    const canvas = document.getElementById('frame-canvas');
    const ctx = canvas?.getContext('2d', { alpha: false }) ?? null;
    const pinWrap = document.getElementById('pinWrap');
    const loaderEl = document.getElementById('loader');
    const loaderFill = document.getElementById('loaderFill');
    const loaderPct = document.getElementById('loaderPct');
    const progressFill = document.getElementById('progressFill');

    if (!canvas || !ctx || !pinWrap || !loaderEl || !loaderFill || !loaderPct || !progressFill) {
      return; // DOM not ready — nothing to wire up
    }

    const images = new Array(FRAME_COUNT);
    const frameState = { current: 0 };

    const forceReveal = () => {
      if (loaderEl && !loaderEl.classList.contains('hidden')) {
        loaderEl.classList.add('hidden');
      }
    };
    // Independent failsafe: never leave the user stuck behind the loader.
    const failsafeTimeout = setTimeout(forceReveal, 8000);

    /* ---------------------------------------------------------
       PRELOAD — waits for every frame AND the web fonts before
       resolving, which is what prevents layout shift once we
       measure and pin the page below.
    --------------------------------------------------------- */
    function preloadFrames() {
      return new Promise((resolve) => {
        let settled = 0;
        for (let i = 0; i < FRAME_COUNT; i++) {
          const img = new Image();
          const frameNum = i + 1;

          img.onload = img.onerror = () => {
            settled++;
            const pct = Math.round((settled / FRAME_COUNT) * 100);
            if (mounted) {
              loaderFill.style.width = pct + '%';
              loaderPct.textContent = pct + '%';
            }
            if (settled === FRAME_COUNT) resolve();
          };

          img.src = FRAME_PATH(frameNum);
          images[i] = img;
        }
      });
    }

    function fontsReady() {
      if (document.fonts && document.fonts.ready) {
        return document.fonts.ready.then(() => undefined);
      }
      return Promise.resolve();
    }

    /* ---------------------------------------------------------
       CANVAS SIZING — responsive, "contain" fit, no crop/stretch
    --------------------------------------------------------- */
    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = pinWrap.clientWidth;
      const h = pinWrap.clientHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFrame(Math.round(frameState.current));
    }

    function drawFrame(index) {
      index = Math.max(0, Math.min(FRAME_COUNT - 1, index));
      const img = images[index];
      if (!img || !img.complete || img.naturalWidth === 0) return;

      const cw = pinWrap.clientWidth;
      const ch = pinWrap.clientHeight;

      const imgRatio = img.naturalWidth / img.naturalHeight;
      const boxRatio = cw / ch;

      let drawW, drawH, offX, offY;

      if (imgRatio > boxRatio) {
        drawW = cw;
        drawH = cw / imgRatio;
        offX = 0;
        offY = (ch - drawH) / 2;
      } else {
        drawH = ch;
        drawW = ch * imgRatio;
        offY = 0;
        offX = (cw - drawW) / 2;
      }

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, offX, offY, drawW, drawH);
    }

    /* ---------------------------------------------------------
       RAF LOOP — redraws only when the target frame changes
    --------------------------------------------------------- */
    let lastRendered = -1;

    function renderLoop() {
      const target = Math.round(frameState.current);
      if (target !== lastRendered) {
        drawFrame(target);
        lastRendered = target;
      }
      rafId = requestAnimationFrame(renderLoop);
    }

    /* ---------------------------------------------------------
       SCROLLTRIGGER — pin + scrub drives the frame index
    --------------------------------------------------------- */
    function initScrollAnimation() {
      ScrollTrigger.create({
        trigger: '#scrollSection',
        start: 'top top',
        end: 'bottom bottom',
        pin: '#pinWrap',
        scrub: 0.4,
        onUpdate: (self) => {
          frameState.current = self.progress * (FRAME_COUNT - 1);
          gsap.set(progressFill, { height: self.progress * 100 + '%' });
        },
      });

      rafId = requestAnimationFrame(renderLoop);
    }

    function playHeroIntro() {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.to('#heroEyebrow', { opacity: 1, y: -6, duration: 1 }, 0.1)
        .from('#heroTitle', { opacity: 0, y: 40, duration: 1.3 }, 0.15)
        .to('#heroTitle', { opacity: 1, duration: 1.3 }, 0.15)
        .to('#heroSub', { opacity: 1, y: -8, duration: 1.1 }, 0.55)
        .to('#scrollIndicator', { opacity: 1, duration: 1 }, 0.9);

      gsap.to('#hero', {
        opacity: 0.15,
        scale: 0.96,
        ease: 'none',
        scrollTrigger: {
          trigger: '#hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    function initClosingReveal() {
      gsap.from('.closing h2, .closing p, .closing .mark', {
        opacity: 0,
        y: 30,
        duration: 1.2,
        stagger: 0.15,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '.closing',
          start: 'top 75%',
        },
      });
    }

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize, { passive: true });

    /* ---------------------------------------------------------
       INIT SEQUENCE
    --------------------------------------------------------- */
    Promise.all([preloadFrames(), fontsReady()])
      .then(() => {
        if (!mounted) return;
        resizeCanvas();
        drawFrame(0);
        initScrollAnimation();
        lenis.resize();

        requestAnimationFrame(() => {
          if (!mounted) return;
          ScrollTrigger.refresh(true);
          forceReveal();
          playHeroIntro();
          initClosingReveal();
        });
      })
      .catch((err) => {
        console.error('Preload failed, revealing anyway:', err);
        forceReveal();
      });

    /* ---------------------------------------------------------
       CLEANUP — critical in React: kill every side effect this
       component created, or a second mount (Strict Mode, route
       change) will double everything up.
    --------------------------------------------------------- */
    return () => {
      mounted = false;
      clearTimeout(failsafeTimeout);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
      gsap.ticker.remove(tickerCallback);
      ScrollTrigger.getAll().forEach((st) => st.kill());
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={rootRef} className={`${cormorant.variable} ${inter.variable} bugatti-root`}>
      {/* ===================== PRELOADER ===================== */}
      <div className="loader" id="loader">
        <div className="loader-label">Preparing the Experience</div>
        <div className="loader-bar">
          <div className="loader-bar-fill" id="loaderFill" />
        </div>
        <div className="loader-pct" id="loaderPct">0%</div>
      </div>

      {/* ===================== SECTION 1 — HERO ===================== */}
      <section className="hero" id="hero">
        <div className="hero-eyebrow" id="heroEyebrow">Est. Molsheim</div>
        <h1 className="hero-title" id="heroTitle">BUGATTI</h1>
        <p className="hero-sub" id="heroSub">
          Engineering beyond imagination. Precision sculpted into motion.
          Experience the future of automotive craftsmanship.
        </p>
        <div className="scroll-indicator" id="scrollIndicator">
          <span>Scroll to Explore</span>
          <div className="arrow">↓</div>
        </div>
      </section>

      {/* ===================== SECTION 2 — SCROLL ANIMATION ===================== */}
      <section className="scroll-section" id="scrollSection">
        <div className="pin-wrap" id="pinWrap">
          <canvas id="frame-canvas" />

          <div className="frame-caption">
            <div className="num">01 — The Sculpture</div>
            <h2>Form follows velocity.</h2>
          </div>

          <div className="progress-rail">
            <div className="progress-fill" id="progressFill" />
          </div>
        </div>
      </section>

      {/* ===================== SECTION 3 — CLOSING ===================== */}
      <section className="closing">
        <h2>Thank You</h2>
        <p>Crafted with passion, precision, and timeless design.</p>
        <div className="mark">Bugatti — Molsheim, France</div>
      </section>

      <style jsx global>{`
        :root {
          --bg: #050505;
          --text: #ffffff;
          --text-secondary: rgba(255, 255, 255, 0.65);
          --accent: #6b7280;
          --hairline: rgba(255, 255, 255, 0.12);
        }

        .bugatti-root * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .bugatti-root {
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-body), sans-serif;
          font-weight: 300;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          overflow-x: hidden;
        }

        .bugatti-root ::selection {
          background: var(--text);
          color: var(--bg);
        }

        .bugatti-root h1,
        .bugatti-root h2,
        .bugatti-root h3 {
          font-family: var(--font-display), serif;
          font-weight: 400;
          letter-spacing: 0.02em;
        }

        @media (prefers-reduced-motion: reduce) {
          .bugatti-root * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .bugatti-root a:focus-visible,
        .bugatti-root button:focus-visible {
          outline: 1px solid var(--text);
          outline-offset: 4px;
        }

        /* ============ HERO ============ */
        .hero {
          position: relative;
          height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255, 255, 255, 0.045), transparent 60%),
            var(--bg);
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute;
          top: 62%;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--hairline) 20%, var(--hairline) 80%, transparent);
          opacity: 0;
          animation: lineIn 1.8s ease forwards 0.6s;
        }

        @keyframes lineIn {
          to {
            opacity: 1;
          }
        }

        .hero-eyebrow {
          font-family: var(--font-body), sans-serif;
          font-size: 11px;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: var(--text-secondary);
          margin-bottom: 28px;
          opacity: 0;
        }

        .hero-title {
          font-size: clamp(70px, 10vw, 180px);
          line-height: 0.92;
          letter-spacing: 0.03em;
          color: var(--text);
          opacity: 0;
        }

        .hero-sub {
          margin-top: 32px;
          max-width: 560px;
          padding: 0 24px;
          font-family: var(--font-body), sans-serif;
          font-weight: 300;
          font-size: clamp(14px, 1.4vw, 17px);
          line-height: 1.75;
          color: var(--text-secondary);
          opacity: 0;
        }

        .scroll-indicator {
          position: absolute;
          bottom: 52px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          opacity: 0;
        }

        .scroll-indicator span {
          font-family: var(--font-body), sans-serif;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .scroll-indicator .arrow {
          font-size: 16px;
          color: var(--text-secondary);
          animation: bob 2.6s ease-in-out infinite;
        }

        @keyframes bob {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateY(8px);
            opacity: 1;
          }
        }

        /* ============ SCROLL / CANVAS SECTION ============ */
        .scroll-section {
          position: relative;
          height: 400vh;
          width: 100%;
          background: var(--bg);
        }

        .pin-wrap {
          position: relative;
          height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        #frame-canvas {
          display: block;
          width: 100%;
          height: 100%;
        }

        .frame-caption {
          position: absolute;
          left: 6%;
          bottom: 8%;
          z-index: 2;
          pointer-events: none;
        }

        .frame-caption .num {
          font-family: var(--font-body), sans-serif;
          font-size: 11px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .frame-caption h2 {
          margin-top: 10px;
          font-size: clamp(28px, 3.4vw, 48px);
          color: var(--text);
        }

        .progress-rail {
          position: absolute;
          right: 6%;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 220px;
          background: var(--hairline);
          z-index: 2;
        }

        .progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 0%;
          background: var(--text);
          transform-origin: top;
        }

        .loader {
          position: fixed;
          inset: 0;
          background: var(--bg);
          z-index: 999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 22px;
          transition: opacity 0.9s ease, visibility 0.9s ease;
        }

        .loader.hidden {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .loader-label {
          font-family: var(--font-body), sans-serif;
          font-size: 11px;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }

        .loader-bar {
          width: 220px;
          height: 1px;
          background: var(--hairline);
          position: relative;
          overflow: hidden;
        }

        .loader-bar-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 0%;
          background: var(--text);
          transition: width 0.2s ease-out;
        }

        .loader-pct {
          font-family: var(--font-display), serif;
          font-size: 26px;
          color: var(--text);
          letter-spacing: 0.05em;
        }

        /* ============ SECTION 3 — CLOSING ============ */
        .closing {
          height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          background: var(--bg);
          position: relative;
        }

        .closing::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 1px;
          height: 80px;
          background: linear-gradient(var(--hairline), transparent);
        }

        .closing h2 {
          font-size: clamp(48px, 7vw, 96px);
          letter-spacing: 0.03em;
        }

        .closing p {
          margin-top: 24px;
          max-width: 420px;
          padding: 0 24px;
          font-family: var(--font-body), sans-serif;
          font-size: 14px;
          font-weight: 300;
          letter-spacing: 0.02em;
          line-height: 1.8;
          color: var(--text-secondary);
        }

        .closing .mark {
          margin-top: 56px;
          font-family: var(--font-body), sans-serif;
          font-size: 10px;
          letter-spacing: 0.4em;
          text-transform: uppercase;
          color: var(--accent);
        }

        @media (max-width: 768px) {
          .frame-caption {
            left: 6%;
            bottom: 10%;
          }
          .progress-rail {
            display: none;
          }
          .hero-sub {
            max-width: 320px;
          }
        }
      `}</style>
    </div>
  );
}
