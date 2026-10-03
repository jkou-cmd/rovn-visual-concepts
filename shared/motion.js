/* Rōvn motion system — shared by every concept.
   GSAP 3.15 (ScrollTrigger, Flip, SplitText, CustomEase) + Lenis 1.3.
   Language (rev. 2026-10-02, after the C1 checkpoint):
   - Headings stand up word by word from their baseline (rotateX on each word's own perspective)
     and tip back to leave. Body lines rise softly.
   - Smooth scroll with a long, soft deceleration. Nothing snaps.
   - The UI is monochrome. Amber only appears as light: a glint across the logo, a glow under
     the pointer on primary buttons, and a trail while the page is moving.
   Timing uses GSAP (ticker-driven) rather than setTimeout/CSS transitions wherever motion matters. */
(function () {
  const gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger, window.Flip, window.SplitText, window.CustomEase);
  const ST = window.ScrollTrigger;

  const R = (window.Rovn = {});
  R.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  R.fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- eases ---------- */
  CustomEase.create('rovn.out', 'M0,0 C0.22,1 0.36,1 1,1');      // long settle, used for entrances
  CustomEase.create('rovn.inOut', 'M0,0 C0.65,0 0.35,1 1,1');    // UI morphs (nav)
  CustomEase.create('rovn.morph', 'M0,0 C0.7,0 0.2,1 1,1');      // card swaps: slow lift, decisive land
  CustomEase.create('rovn.glide', 'M0,0 C0.3,0 0.2,1 1,1');      // programmatic scrolls: quick start, long glide
  gsap.defaults({ ease: 'rovn.out' });

  /* ---------- smooth scroll: soft deceleration, no snapping ---------- */
  if (!R.reduce) {
    R.lenis = new window.Lenis({ lerp: 0.075, wheelMultiplier: 0.9, touchMultiplier: 1.1, smoothWheel: true });
    R.lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => R.lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  R.scrollY = () => (R.lenis ? R.lenis.scroll : window.scrollY);
  const glide = gsap.parseEase('rovn.glide');
  R.scrollTo = (y, opts = {}) => {
    if (R.lenis) R.lenis.scrollTo(y, { duration: 1.6, easing: glide, ...opts });
    else window.scrollTo({ top: y, behavior: R.reduce ? 'auto' : 'smooth' });
  };

  /* ---------- headings: words stand up from the baseline ---------- */
  // Each word carries its own perspective, so words at the ends of a line don't shear.
  R.standFrom = { autoAlpha: 0, rotateX: 72, yPercent: 32, filter: 'blur(5px)', transformOrigin: '50% 100%', transformPerspective: 600 };
  R.standTo = { autoAlpha: 1, rotateX: 0, yPercent: 0, filter: 'blur(0px)' };
  // Exit: tip back and lift away, continuing the upward motion of the scroll
  R.tipTo = { autoAlpha: 0, rotateX: 58, yPercent: -26, filter: 'blur(4px)' };

  R.words = (els) => window.SplitText.create(els, { type: 'words', wordsClass: 'split-word' }).words;
  // Staggered tweens only paint the first target's from-state up front, so every helper presets all targets.
  R.stand = (words, vars = {}) => {
    gsap.set(words, { ...R.standFrom });
    return gsap.to(words, { ...R.standTo, duration: 1.25, ease: 'expo.out', stagger: 0.045, ...vars });
  };
  R.tlStand = (tl, words, at, dur = 0.3, stagger = 0.035) => {
    gsap.set(words, { ...R.standFrom });
    return tl.fromTo(words, { ...R.standFrom }, { ...R.standTo, duration: dur, ease: 'power2.out', stagger }, at);
  };
  R.tlTip = (tl, words, at, dur = 0.26, stagger = 0.02) =>
    tl.to(words, { ...R.tipTo, duration: dur, ease: 'power1.in', stagger }, at);

  /* ---------- body lines: a softer rise ---------- */
  R.riseFrom = { autoAlpha: 0, y: 24, rotateX: 12, filter: 'blur(10px)', transformOrigin: '50% 100%', transformPerspective: 900 };
  R.riseTo = { autoAlpha: 1, y: 0, rotateX: 0, filter: 'blur(0px)' };
  R.rise = (targets, vars = {}) => {
    gsap.set(targets, { ...R.riseFrom });
    return gsap.to(targets, { ...R.riseTo, duration: 1.1, ease: 'expo.out', stagger: 0.08, ...vars });
  };
  R.tlRise = (tl, targets, at, dur = 0.3, stagger = 0.04) => {
    gsap.set(targets, { ...R.riseFrom });
    return tl.fromTo(targets, { ...R.riseFrom }, { ...R.riseTo, duration: dur, ease: 'power2.out', stagger }, at);
  };
  R.recedeTo = { autoAlpha: 0, scale: 0.98, z: -40, y: -12, filter: 'blur(6px)' };
  R.tlRecede = (tl, targets, at, dur = 0.22, stagger = 0.02) =>
    tl.to(targets, { ...R.recedeTo, duration: dur, ease: 'power1.in', stagger }, at);

  /* ---------- video ---------- */
  // Picks a size, fades in once frames are flowing, pauses when off-screen.
  R.video = (video, { mp4, mp4Small, webm }) => {
    if (!video) return;
    if (R.reduce) { video.remove(); return; }
    const small = window.innerWidth < 900 || (navigator.connection && navigator.connection.saveData);
    const srcs = [];
    if (webm && !small) srcs.push(`<source src="${webm}" type="video/webm">`);
    srcs.push(`<source src="${small && mp4Small ? mp4Small : mp4}" type="video/mp4">`);
    video.innerHTML = srcs.join('');
    video.muted = true; video.playsInline = true; video.loop = true;
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { video.dataset.playing = '1'; const p = video.play(); if (p && p.catch) p.catch(() => {}); }
        else { video.dataset.playing = '0'; video.pause(); }
      });
    }, { threshold: 0.01 });
    io.observe(video);
    video.load();
  };

  /* ---------- the scroll trail: amber, only while the page moves ---------- */
  R.progress = () => {
    const wrap = document.querySelector('.progress');
    const bar = wrap && wrap.querySelector('span');
    if (!bar || R.reduce) return;
    gsap.set(wrap, { opacity: 0 });
    const fade = gsap.delayedCall(0.7, () => gsap.to(wrap, { opacity: 0, duration: 0.6, ease: 'power1.out' })).pause();
    ST.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        gsap.set(bar, { scaleX: s.progress });
        gsap.to(wrap, { opacity: 1, duration: 0.25, ease: 'power1.out', overwrite: true });
        fade.restart(true);
      },
    });
  };

  /* ---------- hover: quiet, tactile, mostly monochrome ---------- */
  // Hovers are GSAP-driven (not CSS transitions) so they share the page's easing and timing.
  R.hover = (el, enter, leave) => {
    if (!R.fine || R.reduce || !el) return false;
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) enter(); });
    el.addEventListener('blur', leave);
    return true;
  };

  // Primary buttons: an amber light that follows the pointer, and the arrow leans in.
  R.glow = (btn) => {
    if (!R.fine || R.reduce || !btn || btn.__glow) return;
    const g = document.createElement('span'); g.className = 'btn__glow'; g.setAttribute('aria-hidden', 'true');
    btn.prepend(g); btn.__glow = g;
    const arrow = btn.querySelector('.arrow');
    gsap.set(g, { opacity: 0, scale: 0.55 });
    const xTo = gsap.quickTo(g, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = gsap.quickTo(g, 'y', { duration: 0.7, ease: 'power3' });
    const at = (e) => { const r = btn.getBoundingClientRect(); return e && 'clientX' in e ? [e.clientX - r.left, e.clientY - r.top] : [r.width - 22, r.height / 2]; };
    btn.addEventListener('pointermove', (e) => { const [x, y] = at(e); xTo(x); yTo(y); });
    R.hover(btn, (e) => {
      const [x, y] = at(e); gsap.set(g, { x, y });
      gsap.to(g, { opacity: 1, scale: 1, duration: 0.6, ease: 'rovn.out', overwrite: 'auto' });
      if (arrow) gsap.to(arrow, { x: 2, duration: 0.45, ease: 'rovn.out', overwrite: 'auto' });
    }, () => {
      gsap.to(g, { opacity: 0, scale: 0.55, duration: 0.7, ease: 'power2.out', overwrite: 'auto' });
      if (arrow) gsap.to(arrow, { x: 0, duration: 0.45, ease: 'rovn.out', overwrite: 'auto' });
    });
  };

  // Secondary buttons: the fill brightens (in the button's own colour) and the label rolls.
  R.fill = (btn, amount = () => 0.16) => {
    if (!R.fine || R.reduce || !btn || btn.__fill) return;
    const f = document.createElement('span'); f.className = 'btn__fill'; f.setAttribute('aria-hidden', 'true');
    btn.prepend(f); btn.__fill = f;
    gsap.set(f, { opacity: 0 });
    R.hover(btn,
      () => gsap.to(f, { opacity: amount(), duration: 0.5, ease: 'rovn.out', overwrite: 'auto' }),
      () => gsap.to(f, { opacity: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }));
  };

  // Logo glint: an amber copy of the logo, revealed by a band of light that sweeps across it.
  R.glint = (logo) => {
    if (!logo) return () => {};
    let over = logo.querySelector('.logo__glint');
    if (!over) {
      over = document.createElement('span'); over.className = 'logo__glint'; over.setAttribute('aria-hidden', 'true');
      logo.querySelectorAll('svg').forEach((s) => over.append(s.cloneNode(true)));
      logo.append(over);
    }
    const sweep = () => (R.reduce ? null : gsap.fromTo(over, { '--glint': -0.45 }, { '--glint': 1.45, duration: 1.15, ease: 'power2.inOut', overwrite: true }));
    R.hover(logo, sweep, () => {});
    return sweep;
  };

  // Glider: one soft highlight per group that glides to whichever item is under the pointer —
  // a pill inflated around the label ('pill'), or the item's own box in a grid of cells ('cell').
  // It appears where you arrive, travels between neighbours, and fades when you leave the group.
  R.glider = (group, items, { kind = 'pill', padX = 12, padY = 10 } = {}) => {
    items = (items || []).filter(Boolean);
    if (!R.fine || R.reduce || !group || !items.length) return null;
    const g = document.createElement('span'); g.className = `glider glider--${kind}`; g.setAttribute('aria-hidden', 'true');
    group.append(g); // last, so the items keep their :nth-child positions; z-index keeps it behind them
    group.classList.add('glider-group');
    gsap.set(g, { autoAlpha: 0, x: 0, y: 0 });
    let hideCall = null;
    const box = (el) => {
      const gr = group.getBoundingClientRect(), r = el.getBoundingClientRect();
      const px = kind === 'cell' ? 0 : padX, py = kind === 'cell' ? 0 : padY;
      return { x: r.left - gr.left - px, y: r.top - gr.top - py, width: r.width + px * 2, height: r.height + py * 2 };
    };
    const enter = (el) => {
      if (hideCall) { hideCall.kill(); hideCall = null; }
      const b = box(el);
      if (gsap.getProperty(g, 'opacity') < 0.05) {
        gsap.set(g, b); // arrive: appear in place
        gsap.fromTo(g, { autoAlpha: 0, scale: kind === 'cell' ? 1 : 0.92 }, { autoAlpha: 1, scale: 1, duration: 0.34, ease: 'rovn.out', overwrite: 'auto' });
      } else { // travel: glide to the next item and settle
        gsap.to(g, { ...b, duration: 0.46, ease: 'expo.out', overwrite: 'auto' });
        gsap.to(g, { autoAlpha: 1, scale: 1, duration: 0.2, ease: 'power1.out' });
      }
    };
    const leave = () => {
      if (hideCall) hideCall.kill();
      hideCall = gsap.delayedCall(0.16, () => gsap.to(g, { autoAlpha: 0, scale: kind === 'cell' ? 1 : 0.97, duration: 0.32, ease: 'power2.out' }));
    };
    items.forEach((el) => {
      el.classList.add('glider-item');
      el.addEventListener('pointerenter', () => enter(el));
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', () => { if (el.matches(':focus-visible')) enter(el); });
      el.addEventListener('blur', leave);
    });
    return g;
  };

  /* ---------- loading guard + fonts first ---------- */
  // Intro elements stay hidden under html.is-loading until a page has painted its load-in's first frame.
  R.loaded = () => document.documentElement.classList.remove('is-loading');
  R.ready = (fn) => {
    const go = () => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fn);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  };
})();
