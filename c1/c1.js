/* Concept 1 · Cover — scroll choreography
   Storyboards 22QJ-0 → 22A0-0. One pinned stage; the hero lifts away over it.
   Scroll units: 1 = one viewport height. Nothing snaps: each story beat ends in a short dwell
   (a stretch of scroll where nothing moves) so the page rests naturally wherever you stop. */
window.Rovn.ready(() => {
  const R = window.Rovn, gsap = window.gsap, ST = window.ScrollTrigger;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const scene = $('.scene'), stage = $('.stage'), hero = $('.hero');
  const nav = $('.nav'), navInner = $('.nav__inner');
  const cards = { clin: $('[data-card="clin"]'), fac: $('[data-card="fac"]'), close: $('[data-card="close"]') };
  const statement = $('.statement');

  const VIDEO = { mp4: 'media/video/hero-montage-1080.mp4', mp4Small: 'media/video/hero-montage-720.mp4' }; // H.264 keeps the grain better than the VP9 cut
  R.video($('.hero__video'), VIDEO);
  let closeVideoReady = false;
  const readyCloseVideo = () => { if (!closeVideoReady) { closeVideoReady = true; R.video($('.close__video'), VIDEO); } };
  R.progress();
  // decode the card photos while the hero plays, so the first card frame doesn't hitch
  const predecode = () => $$('.card__img').forEach((img) => { if (img.decode) img.decode().catch(() => {}); });
  if ('requestIdleCallback' in window) requestIdleCallback(predecode, { timeout: 1500 }); else setTimeout(predecode, 800);

  // Story rests (middle of each dwell) and the scene length, in scroll units
  const L = { top: 0, statement: 1.18, clinicians: 3.1, facilities: 4.28, close: 5.66, end: 5.85 };
  const sceneTop = () => scene.getBoundingClientRect().top + R.scrollY();
  const vh = () => window.innerHeight, vw = () => window.innerWidth;

  /* ---------- hovers (fine pointers only; see motion.js) ---------- */
  const glint = R.glint($('.nav__logo'));
  R.glint($('.footer__logo'));
  // one soft highlight travels between the nav items (glass over the photo, ink over paper)
  R.glider($('.nav__links'), $$('.nav__links a'));
  R.glider($('.nav__actions'), [$('.nav__contact')], { padX: 0, padY: 0 });
  R.glider($('.footer__links'), $$('.footer__links a'), { padX: 10, padY: 8 });
  R.glow($('.nav__join'));
  R.glow($('.close__join'));
  R.fill($('.close__demo'), () => 0.16);

  // Jumps from nav links, thumbs and footer
  let jumpTo = (key) => { const el = document.getElementById(key); if (el) el.scrollIntoView({ behavior: R.reduce ? 'auto' : 'smooth' }); };
  $$('[data-jump]').forEach((el) => el.addEventListener('click', (e) => {
    if (el.tagName === 'FIGURE' && !el.classList.contains('is-thumb')) return;
    e.preventDefault(); jumpTo(el.dataset.jump);
  }));

  /* ---------- nav: full bar over the photo → pill over paper (22TF-0 → 22U9-0) ---------- */
  function navMorph(start) {
    const pill = (on) => nav.classList.toggle('is-pill', on); // colours cross-fade in CSS
    const navTl = gsap.timeline({ paused: true, defaults: { duration: 0.8, ease: 'rovn.inOut' } })
      .to('.nav__links', { autoAlpha: 0, y: -6, filter: 'blur(6px)', duration: 0.32, ease: 'power2.in' }, 0)
      .to(navInner, {
        width: () => Math.min(636, vw() - 24), height: 48, padding: 4, marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px) saturate(1.2)',
        boxShadow: '0 1px 2px rgba(10,8,6,0.04), 0 12px 32px -18px rgba(10,8,6,0.25)',
      }, 0.04)
      .to('.nav__logo', { paddingLeft: 16, gap: 9 }, 0.04) // pill logo group: gap 9, mark ~25px (22U9-0)
      .to('.nav .logo__mark', { width: 25, height: 25 }, 0.04)
      .to('.nav__actions', { gap: 16 }, 0.04)
      // Contact becomes plain text; the padding stays (offset by margin) so its hover pill has room
      .to('.nav__contact', { paddingLeft: 12, paddingRight: 12, marginLeft: -12, marginRight: -12 }, 0.04);
    ST.create({
      start,
      onEnter: () => { pill(true); if (R.reduce) navTl.progress(1); else { navTl.play(); gsap.delayedCall(0.45, glint); } },
      onLeaveBack: () => { pill(false); if (R.reduce) navTl.progress(0); else navTl.reverse(); },
      onRefresh: (self) => { if (R.scrollY() > self.start) { pill(true); navTl.progress(1); } },
    });
  }

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(min-width: 821px) and (prefers-reduced-motion: no-preference)',
    still: '(max-width: 820px), (prefers-reduced-motion: reduce)',
  }, (ctx) => (ctx.conditions.motion ? buildMotion() : buildStatic()));
  R.loaded();

  /* ================= desktop: the full scene ================= */
  function buildMotion() {
    document.body.classList.remove('is-static');
    scene.style.height = `${(L.end + 1) * 100}vh`;

    // Storyboard geometry (1440×900) mapped to the viewport. Cards stay bottom-anchored 11px up.
    let g;
    const G = () => {
      const W0 = vw(), H0 = vh();
      let h = H0 - 24, w = (h * 496) / 876;
      if (w > W0 * 0.3444) { w = W0 * 0.3444; h = (w * 876) / 496; }
      const x = (W0 - w) / 2, y = H0 - 11 - h;
      const box = (bw, bh, bx, by) => ({ w: bw, h: bh, x: bx, y: by });
      const s0w = (w * 160) / 496, s0h = (h * 281) / 876;
      const s1w = (w * 368) / 496, s1h = (h * 649) / 876;
      const ntw = (w * 90) / 496, nth = (h * 160) / 876;
      const ptw = (w * 92) / 496, pth = (h * 161) / 876;
      return {
        w, h,
        s0: box(s0w, s0h, (W0 - s0w) / 2, H0 - 11 - s0h),
        s1: box(s1w, s1h, (W0 - s1w) / 2, H0 - 11 - s1h),
        main: box(w, h, x, y),
        next: box(ntw, nth, x + w + 12, H0 - 11 - nth),
        prev: box(ptw, pth, x - 19 - ptw, Math.max(19, y + 6)),
        full: box(W0 - 16, H0 - 16, 8, 8),
      };
    };
    const setVars = () => {
      g = G();
      stage.style.setProperty('--img-w', `${g.w}px`);
      stage.style.setProperty('--img-h', `${g.h}px`);
      stage.style.setProperty('--close-w', `${g.full.w}px`);
      stage.style.setProperty('--close-h', `${g.full.h}px`);
    };
    setVars();
    ST.addEventListener('refreshInit', setVars);
    const at = (key) => ({ x: () => g[key].x, y: () => g[key].y, width: () => g[key].w, height: () => g[key].h });

    // Headings stand up word by word
    const W = {
      hero: R.words($$('.hero__title .line')),
      statement: R.words($$('.statement .line')),
      clin: R.words($$('.aud--clin .line')),
      fac: R.words($$('.aud--fac .line')),
      close: R.words($$('.close__title .line')),
    };

    /* ---------- master timeline, scrubbed ---------- */
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: scene, start: 'top top', end: 'bottom bottom', scrub: 0.4, invalidateOnRefresh: true,
        onUpdate: () => syncThumbs(tl.time()),
      },
    });

    // A · The hero opens to the edges and lifts away; its headline tips back; the statement stands up beneath
    tl.fromTo(hero, { padding: 8 }, { padding: 0, duration: 0.22, ease: 'power1.out' }, 0)
      .fromTo('.hero__media', { yPercent: 0, scale: 1 }, { yPercent: 22, scale: 1.06, duration: 1.0 }, 0);
    R.tlTip(tl, W.hero, 0.16, 0.26, 0.02);
    tl.fromTo(statement, { y: () => vh() * 0.3 }, { y: 0, duration: 0.6, ease: 'power2.out' }, 0.42);
    R.tlStand(tl, W.statement, 0.52, 0.3, 0.05);
    tl.fromTo(cards.clin,
      { ...at('s0'), y: () => g.s0.y + vh() * 0.45, autoAlpha: 0, filter: 'blur(12px)' },
      { y: () => g.s0.y, autoAlpha: 1, filter: 'blur(0px)', duration: 0.26, ease: 'power2.out' }, 0.76);
    // dwell · statement (1.02 → 1.35)

    // B · The card opens like an aperture and the statement is pushed up and away (22U9-0 → 22UF-0 → 22V6-0)
    tl.to(cards.clin, { ...at('s1'), duration: 0.7, ease: 'power1.inOut' }, 1.35)
      .to(statement, { y: () => (-330 * vh()) / 900, duration: 0.7, ease: 'power1.inOut' }, 1.35)
      .fromTo('[data-card="clin"] .card__img', { scale: 1.16 }, { scale: 1, duration: 1.3, ease: 'power1.out' }, 1.35)
      .to(cards.clin, { ...at('main'), duration: 0.6, ease: 'power1.inOut' }, 2.05)
      .to(statement, { y: () => (-560 * vh()) / 900, duration: 0.45, ease: 'power1.in' }, 2.05);
    R.tlTip(tl, W.statement, 2.05, 0.3, 0.03);
    R.tlStand(tl, W.clin, 2.42, 0.32, 0.035);
    R.tlRise(tl, '.aud-body--clin', 2.56, 0.3);
    tl.fromTo(cards.fac,
      { ...at('next'), autoAlpha: 0, scale: 0.72, filter: 'blur(10px)' },
      { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'power2.out' }, 2.5);
    // dwell · for clinicians (2.92 → 3.3)

    // C · Swap: the next card comes forward into the middle while this one steps back (22A0-0)
    const lift = ['0 0 0 0 rgba(10,8,6,0)', '0 40px 90px -30px rgba(10,8,6,0.45)', '0 0 0 0 rgba(10,8,6,0)'];
    tl.to(cards.clin, { ...at('prev'), duration: 0.7, ease: 'rovn.morph' }, 3.3)
      .to(cards.clin, { keyframes: { filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'] }, duration: 0.7 }, 3.3)
      .to(cards.fac, { ...at('main'), duration: 0.7, ease: 'rovn.morph' }, 3.3)
      .to(cards.fac, { keyframes: { filter: ['blur(0px)', 'blur(4px)', 'blur(0px)'], boxShadow: lift }, duration: 0.7 }, 3.3)
      .fromTo('[data-card="fac"] .card__img', { scale: 1.12 }, { scale: 1, duration: 0.8, ease: 'power1.out' }, 3.3);
    R.tlTip(tl, W.clin, 3.3, 0.26, 0.02);
    R.tlRecede(tl, '.aud-body--clin', 3.3, 0.22);
    R.tlStand(tl, W.fac, 3.62, 0.32, 0.035);
    R.tlRise(tl, '.aud-body--fac', 3.74, 0.3);
    tl.fromTo(cards.close,
      { ...at('next'), autoAlpha: 0, scale: 0.72, filter: 'blur(10px)', borderRadius: 24 },
      { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.3, ease: 'power2.out' }, 3.68);
    // dwell · for facilities (4.12 → 4.45)

    // D · Close: the waiting card opens to the full frame — the hero returns, with the way in
    tl.to(cards.close, { ...at('full'), borderRadius: 14, duration: 0.62, ease: 'rovn.morph' }, 4.45)
      .to(cards.close, { keyframes: { filter: ['blur(0px)', 'blur(3px)', 'blur(0px)'] }, duration: 0.62 }, 4.45)
      .to(cards.fac, { scale: 0.88, autoAlpha: 0, filter: 'blur(10px)', duration: 0.34, ease: 'power2.out' }, 4.48)
      .to(cards.clin, { x: () => g.prev.x - 40, autoAlpha: 0, filter: 'blur(8px)', duration: 0.4, ease: 'power1.in' }, 4.5);
    R.tlTip(tl, W.fac, 4.45, 0.26, 0.02);
    R.tlRecede(tl, '.aud-body--fac', 4.45, 0.22);
    R.tlStand(tl, W.close, 5.02, 0.3, 0.04);
    R.tlRise(tl, ['.close__sub', '.close__ctas'], 5.14, 0.28, 0.06);
    tl.set({}, {}, L.end);
    // dwell · close (5.5 → 5.85), then the stage releases into the footer

    // thumbs are clickable while they wait at the edges
    function syncThumbs(t) {
      cards.fac.classList.toggle('is-thumb', t > 2.85 && t < 3.3);
      cards.clin.classList.toggle('is-thumb', t > 4.05 && t < 4.45);
      cards.close.classList.toggle('is-thumb', t > 4.0 && t < 4.45);
      if (t > 2.6) readyCloseVideo();
    }

    navMorph(() => sceneTop() + vh() * 0.88);

    /* ---------- load-in (no preloader) ---------- */
    // every staggered target gets its first frame up front, then the guard lifts (R.loaded)
    const navUi = ['.nav__links li', '.nav__actions .btn'];
    gsap.set(navUi, { autoAlpha: 0, y: -10, filter: 'blur(4px)' });
    gsap.set(W.hero, { ...R.standFrom });
    gsap.timeline({ delay: 0.05 })
      .fromTo('.hero__focus', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, 0)
      // explicit end values: GSAP reads a missing filter as zeros, which would sink brightness to black
      .fromTo('.hero__focus', { scale: 1.08, filter: 'blur(16px) brightness(0.7)' },
        { scale: 1, filter: 'blur(0px) brightness(1)', duration: 1.6, ease: 'expo.out', clearProps: 'filter' }, 0)
      .fromTo('.nav .logo__mark', { autoAlpha: 0, scale: 0.5, rotate: -18, filter: 'blur(6px)', transformOrigin: '50% 50%' },
        { autoAlpha: 1, scale: 1, rotate: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', clearProps: 'filter' }, 0.2)
      .fromTo('.nav .logo__word', { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0, ease: 'expo.out', clearProps: 'clipPath' }, 0.34)
      .to(navUi, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.42)
      .to(W.hero, { ...R.standTo, duration: 1.3, ease: 'expo.out', stagger: 0.06 }, 0.55)
      .add(() => glint(), 1.15); // the one amber moment of the load-in: light passes across the logo

    jumpTo = (key) => {
      if (key in L) R.scrollTo(sceneTop() + L[key] * vh(), { duration: 1.9 });
    };

    return () => {
      ST.removeEventListener('refreshInit', setVars);
      scene.style.height = '';
    };
  }

  /* ================= phones, tablets, reduced motion ================= */
  function buildStatic() {
    document.body.classList.add('is-static');
    readyCloseVideo();
    navMorph(() => hero.getBoundingClientRect().bottom + R.scrollY() - 64);
    if (!R.reduce) {
      R.stand(R.words($$('.hero__title .line')), { delay: 0.3, stagger: 0.06 });
      gsap.delayedCall(1.1, glint);
      $$('.statement .line, .aud .line, .close__title .line').forEach((line) => {
        const words = R.words(line);
        gsap.set(words, { ...R.standFrom });
        ST.create({ trigger: line, start: 'top 90%', once: true, onEnter: () => R.stand(words, { stagger: 0.05 }) });
      });
      $$('.aud-body, .close__sub, .close__ctas').forEach((el) => {
        gsap.set(el, { ...R.riseFrom });
        ST.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => R.rise(el) });
      });
      $$('.card').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 40, filter: 'blur(10px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
      });
    }
    jumpTo = (key) => { const el = document.getElementById(key) || $(`[data-card="${key}"]`); if (el) el.scrollIntoView({ behavior: R.reduce ? 'auto' : 'smooth' }); };
    return () => document.body.classList.remove('is-static');
  }
});
