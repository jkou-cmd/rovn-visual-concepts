/* Rōvn home — motion for Jerry's Working Board 2 storyboards.
   Each storyboard beat (1a→1c, 2.1→2.2, 3.1→3.2 …) is a scroll-scrubbed scene. Long pins have
   still stretches at both ends so the page rests between beats. Smooth scroll comes from
   shared/motion.js (Lenis); nothing snaps.
   Desktop follows the 1440×900 frames and phones the 390×844 frames (gsap.matchMedia). */
(function () {
  const gsap = window.gsap, ST = window.ScrollTrigger, R = window.Rovn, C = window.RovnCards;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const root = document.documentElement;
  const K = () => parseFloat(getComputedStyle(root).getPropertyValue('--k')) || 1;
  const px = (n) => () => n * K();

  ST.config({ ignoreMobileResize: true });
  // Lenis: a touch quicker than the concept prototypes (.075) so the pinned scenes don't feel heavy
  if (R.lenis) R.lenis.options.lerp = 0.1;

  /* ---------------------------------------------------------------- build objects */
  $$('[data-stack]').forEach((el) => C.stack(el, el.dataset.stack.split(',')));
  $$('[data-card]').forEach((el) => { el.innerHTML = C.html(el.dataset.card); });
  $$('.card--share, .card--shareDark').forEach((c) => c.classList.add('is-live'));

  /* ---------------------------------------------------------------- motion blur
     Elements that travel get a blur proportional to their speed (read from their GSAP x/y),
     so fast scrolls smear and slow ones stay crisp. The blur sits on a child, so it never
     fights the transform that moves the element. */
  const MB = (() => {
    const items = [];
    let last = performance.now();
    if (!R.reduce) gsap.ticker.add(() => {
      const now = performance.now(), dt = Math.max(8, now - last) / 16.67; last = now;
      for (const it of items) {
        const x = gsap.getProperty(it.src, 'x'), y = gsap.getProperty(it.src, 'y');
        const vx = (x - it.x) / dt, vy = (y - it.y) / dt; it.x = x; it.y = y;
        it.v += (Math.hypot(vx, vy) - it.v) * 0.3;
        const b = Math.min(it.max, Math.max(0, it.v - 1.2) * it.gain);
        if (b > 0.3) { it.on = true; it.dst.style.filter = `blur(${b.toFixed(2)}px)`; }
        else if (it.on) { it.on = false; it.dst.style.filter = ''; }
      }
    });
    return (src, dst, o = {}) => items.push({ src, dst: dst || src.firstElementChild, max: o.max || 5, gain: o.gain || 0.16, x: 0, y: 0, v: 0, on: false });
  })();

  /* ---------------------------------------------------------------- hover helpers */
  // 3D tilt toward the pointer, with a soft glare that follows it.
  function tilt(el, { max = 5, lift = 0, glare = true } = {}) {
    if (!R.fine || R.reduce || !el) return;
    const card = el.querySelector('.card') || el;
    let g = null;
    if (glare) { g = document.createElement('span'); g.className = 'card__glare'; card.append(g); }
    gsap.set(el, { transformPerspective: 900, transformStyle: 'preserve-3d' });
    const rx = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' });
    const ry = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' });
    const gx = g && gsap.quickTo(g, 'xPercent', { duration: 0.5, ease: 'power3' });
    const gy = g && gsap.quickTo(g, 'yPercent', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      ry(u * max * 2); rx(-v * max * 2);
      if (g) { gx(u * 60); gy(v * 60); }
    });
    el.addEventListener('pointerenter', () => { if (g) gsap.to(g, { opacity: 1, duration: 0.5 }); if (lift) gsap.to(el, { z: lift, duration: 0.6, ease: 'power3' }); });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); if (g) gsap.to(g, { opacity: 0, duration: 0.6 }); if (lift) gsap.to(el, { z: 0, duration: 0.8, ease: 'power3' }); });
  }

  // A stack fans under the pointer like a dock: the hovered card lifts, its neighbours follow.
  function fan(stack) {
    if (!R.fine || R.reduce || !stack) return;
    const cards = $$('.fly > .card', stack), n = cards.length;
    const ys = cards.map((c) => gsap.quickTo(c, 'y', { duration: 0.55, ease: 'power3' }));
    stack.addEventListener('pointermove', (e) => {
      const r = stack.getBoundingClientRect(), step = 38 * K();
      const at = Math.min(n - 1, Math.max(0, (e.clientY - r.top) / step - 0.5));
      ys.forEach((to, i) => to(-Math.max(0, 1 - Math.abs(i - at) / 2.2) * 10 * K() - (i < at ? 3 * K() : 0)));
    });
    stack.addEventListener('pointerleave', () => ys.forEach((to) => to(0)));
  }

  // Door tiles: the photo leans in, the arrow slides through its chip.
  function door(el) {
    if (!R.fine || R.reduce) return;
    const img = $('.door__img', el), shade = $('.door__shade', el), arrow = $('.door__chip svg', el);
    const inner = document.createElement('span'); inner.className = 'door__zoom';
    R.hover(el, () => {
      gsap.to(img, { scale: 1.045, duration: 1.4, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(shade, { opacity: 0.82, duration: 0.9, ease: 'power2.out' });
      gsap.timeline().to(arrow, { x: 22 * K(), duration: 0.22, ease: 'power2.in' }).set(arrow, { x: -22 * K() }).to(arrow, { x: 0, duration: 0.5, ease: 'expo.out' });
    }, () => {
      gsap.to(img, { scale: 1, duration: 1.2, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(shade, { opacity: 1, duration: 0.9, ease: 'power2.out' });
    });
  }

  /* ---------------------------------------------------------------- nav */
  const nav = $('.nav');
  nav.style.setProperty('--glider', 'rgba(255, 255, 255, 0.08)');
  R.glider($('.nav__links'), $$('.nav__links .nav__cell'), { kind: 'cell' });
  const glint = R.glint($('.nav__logo'));
  (function ctaLight() {
    const cta = $('.nav__cta'); if (!cta || !R.fine || R.reduce) return;
    const band = document.createElement('span'); band.className = 'nav__band'; band.setAttribute('aria-hidden', 'true');
    Object.assign(band.style, { position: 'absolute', inset: '0', zIndex: 0, pointerEvents: 'none',
      background: 'linear-gradient(105deg, rgba(255,240,210,0) 30%, rgba(255,240,210,.6) 50%, rgba(255,240,210,0) 70%)' });
    cta.prepend(band); gsap.set(band, { xPercent: -110 });
    const arrow = $('.arrow', cta);
    R.hover(cta, () => {
      gsap.fromTo(band, { xPercent: -110 }, { xPercent: 110, duration: 0.9, ease: 'power2.inOut', overwrite: true });
      gsap.to(arrow, { x: 3, duration: 0.45, ease: 'rovn.out' });
    }, () => gsap.to(arrow, { x: 0, duration: 0.45, ease: 'rovn.out' }));
  })();
  // hides on the way down, returns on the way up
  let navShown = true;
  ST.create({
    start: 0, end: 'max',
    onUpdate(self) {
      const show = self.scroll() < innerHeight * 0.4 || self.direction < 0;
      if (show === navShown) return;
      navShown = show;
      gsap.to(nav, show ? { yPercent: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' } : { yPercent: -102, duration: 0.45, ease: 'power2.in', overwrite: 'auto' });
    },
  });
  // in-page links glide
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const t = document.querySelector(a.getAttribute('href')); if (!t) return;
    e.preventDefault(); R.scrollTo(t.getBoundingClientRect().top + R.scrollY());
  }));

  /* ---------------------------------------------------------------- hero: the amber stage */
  const heroStage = { ctl: null };
  async function mountStage() {
    const host = $('.hero__canvas'); if (!host) return;
    try {
      const mod = await import(new URL('home/stage/stage.js', document.baseURI).href);
      // portrait screens get the same scene with the tulips brought into frame under the headline
      const portrait = innerWidth / innerHeight < 0.75;
      heroStage.ctl = await mod.mountStage(host, {
        sceneUrl: new URL(portrait ? 'home/stage/scene-portrait.json' : 'home/stage/scene.json', document.baseURI).href,
        assetBase: new URL('home/stage/', document.baseURI).href,
        maxDpr: innerWidth < 768 ? 1 : 1.5,
        onReady: () => { gsap.to(host, { autoAlpha: 1, duration: 1.6, ease: 'power2.out' }); guard(); },
      });
      // if a device can't hold the scene smoothly, keep the poster (it is the scene's first frame)
      function guard() {
        const ts = []; let last = performance.now();
        const tick = () => { const now = performance.now(); ts.push(now - last); last = now; if (ts.length < 90) requestAnimationFrame(tick); else check(); };
        const check = () => {
          const med = ts.slice(10).sort((a, b) => a - b)[Math.floor((ts.length - 10) / 2)];
          if (med > 26 && heroStage.ctl) { heroStage.ctl.setPaused(true); gsap.to(host, { autoAlpha: 0, duration: 0.8 }); console.info('[home] stage paused: median frame', med.toFixed(1), 'ms'); }
        };
        requestAnimationFrame(tick);
      }
      if (R.reduce && heroStage.ctl) heroStage.ctl.setPaused(true);
      const hero = $('.hero__frame');
      const to = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        to.x = ((e.clientX - r.left) / r.width) * 2 - 1; to.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      });
      hero.addEventListener('pointerleave', () => { to.x = 0; to.y = 0; });
      gsap.ticker.add(() => {
        cur.x += (to.x - cur.x) * 0.08; cur.y += (to.y - cur.y) * 0.08;
        heroStage.ctl && heroStage.ctl.setPointer(cur.x, cur.y);
      });
    } catch (err) { console.warn('[home] hero stage unavailable, keeping the poster', err); }
  }

  /* ---------------------------------------------------------------- split headings */
  const heroWords = R.words($$('.hero__title > span'));
  const moveT1 = R.words($('.move__t1'));
  const moveT2 = R.words($('.move__t2'));
  const recordWords = R.words($('.record__title'));

  /* ---------------------------------------------------------------- load-in (no preloader) */
  function loadIn() {
    const poster = $('.hero__poster'), sub = $('.hero__sub'), ctas = $('.hero__ctas');
    if (R.reduce) { R.loaded(); return; }
    gsap.set(nav, { yPercent: -102 });
    gsap.set(heroWords, { ...R.standFrom });
    gsap.set([sub, ctas], { ...R.riseFrom });
    R.loaded();
    // the amber stage opens from a window to full bleed while it pulls into focus (Lassie /stories,
    // Collins sections); the headline stands up inside it, then the nav arrives
    const frame = $('.hero__frame'), stage = $('.hero__stage');
    const tl = gsap.timeline({ delay: 0.05 });
    tl.fromTo(frame, { '--lt': () => innerHeight * 0.13 + 'px', '--ls': () => innerWidth * 0.2 + 'px' }, { '--lt': '0px', '--ls': '0px', duration: 1.7, ease: 'expo.inOut' }, 0)
      .fromTo(stage, { scale: 1.14 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0)
      .fromTo(poster, { filter: 'blur(14px)' }, { filter: 'blur(0px)', duration: 2.2, ease: 'power2.out', clearProps: 'filter' }, 0)
      .to(heroWords, { ...R.standTo, duration: 1.3, ease: 'expo.out', stagger: 0.05 }, 0.55)
      .to([sub, ctas], { ...R.riseTo, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, 0.95)
      .to(nav, { yPercent: 0, duration: 1.1, ease: 'expo.out' }, 1.15)
      .add(() => glint && glint(), 1.6);
  }

  /* ---------------------------------------------------------------- headings that stand up on arrival */
  function standOnEnter(words, trigger, start = 'top 82%') {
    if (R.reduce) return;
    gsap.set(words, { ...R.standFrom });
    ST.create({ trigger, start, once: true, onEnter: () => R.stand(words) });
  }
  function riseOnEnter(targets, trigger, start = 'top 80%', delay = 0.25) {
    if (R.reduce) return;
    gsap.set(targets, { ...R.riseFrom });
    ST.create({ trigger, start, once: true, onEnter: () => R.rise(targets, { delay }) });
  }

  /* ================================================================ scenes */
  const mm = gsap.matchMedia();
  mm.add({ desk: '(min-width: 768px)', phone: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    const { desk, reduce } = ctx.conditions;
    if (reduce) return;
    hero(desk);
    move(desk);
    record(desk);
    return () => { /* matchMedia reverts every tween and trigger made in here */ };
  });

  /* ---------------------------------------------------------------- 1 · hero → doors */
  function hero(desk) {
    const frame = $('.hero__frame'), stage = $('.hero__stage'), content = $('.hero__content');
    const sub = $('.hero__sub'), ctas = $('.hero__ctas');
    // 1a → 1b: once the page starts to move, the full-bleed frame settles into the 8px shell (a short
    // eased morph, reversed at the top). While it rises, the stage lags behind the frame (parallax) and
    // the copy drifts slower still, then tips back and leaves.
    const inset = gsap.to(frame, { '--hi': () => 8 * K() + 'px', duration: 1, ease: 'rovn.out', paused: true });
    ST.create({ start: () => 60 * K(), end: 'max', onToggle: (self) => (self.isActive ? inset.play() : inset.reverse()) });
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: frame, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
    tl.fromTo(stage, { yPercent: 0, scale: 1 }, { yPercent: 24, scale: 1.05, duration: 1 }, 0)
      .fromTo(content, { y: 0 }, { y: () => frame.offsetHeight * 0.3, duration: 1 }, 0)
      .to([sub, ctas], { autoAlpha: 0, y: -12, filter: 'blur(6px)', duration: 0.22, stagger: 0.04, ease: 'power1.in' }, 0.14)
      .to(heroWords, { ...R.tipTo, duration: 0.3, stagger: 0.012, ease: 'power1.in' }, 0.24);

    // the doors rise out of the page and settle flat; their photos drift inside the frame
    $$('.door').forEach((d, i) => {
      gsap.fromTo(d, { y: px(desk ? 90 : 60), rotationX: desk ? 9 : 6, transformPerspective: 1600 },
        { y: 0, rotationX: 0, ease: 'none', scrollTrigger: { trigger: d, start: 'top bottom', end: desk ? 'top 58%' : 'top 70%', scrub: true, invalidateOnRefresh: true } });
      gsap.fromTo($('.door__img', d), { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true } });
      door(d);
    });
  }

  /* ---------------------------------------------------------------- 2 · one career move, seen from both sides */
  function move(desk) {
    const sec = $('.move'), pin = $('.move__pin'), row = $('.move__row');
    const rn = $('.panel--renee'), qs = $('.panel--qs');
    const qsPill = $('.pill', qs), qsImg = $('.panel__img', qs), rnImg = $('.panel__img', rn);
    const qsFlys = $$('.stack .fly', qs);
    const rnFly = Object.fromEntries($$('.stack .fly', rn).map((f) => [f.dataset.key, f]));
    const subLines = $$('.move__sub .ln');

    standOnEnter(moveT1, sec, 'top 70%');
    gsap.set(moveT2, { ...R.standFrom });
    gsap.set(subLines, { ...R.riseFrom });
    fan($('.stack', rn));
    // the cards stand up from the panel, back to front, like the headings do
    const rnCards = $$('.stack .fly > .card', rn);
    gsap.set(rnCards, { rotationX: 50, autoAlpha: 0, y: px(30), transformPerspective: 1000 });
    ST.create({ trigger: $('.stack', rn), start: 'top 88%', once: true,
      onEnter: () => gsap.to(rnCards, { rotationX: 0, autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.1 }) });
    gsap.fromTo($('.pill', rn), { autoAlpha: 0, y: px(-12), filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'expo.out',
      scrollTrigger: { trigger: rn, start: 'top 80%', once: true } });

    // panels drift as the section arrives (the pin holds them afterwards)
    gsap.fromTo([rnImg, qsImg], { yPercent: 6 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true } });

    if (desk) {
      // where each copy starts: its twin in Renée's stack, measured in the 2.2 layout
      const off = {};
      const pos = (el) => { let x = 0, y = 0, n = el; while (n && n !== row) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y }; };
      const half = () => (row.clientWidth - 8 * K()) / 2;
      const measure = () => {
        const prev = qs.style.flexBasis; qs.style.flexBasis = half() + 'px';
        qsFlys.forEach((f) => { const a = pos(rnFly[f.dataset.key]), b = pos(f); off[f.dataset.key] = { x: a.x - b.x, y: a.y - b.y }; });
        qs.style.flexBasis = prev;
      };
      measure(); ST.addEventListener('refreshInit', measure);

      qsFlys.forEach((f) => { MB(f, f.firstElementChild, { max: 6, gain: 0.14 }); });

      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + innerHeight * 2.2, pin, scrub: 0.35, invalidateOnRefresh: true } });
      tl.to({}, { duration: 0.08 })
        // 2.1 → 2.2: Quarrystone's sliver opens into its half
        .fromTo(qs, { flexBasis: px(50) }, { flexBasis: half, duration: 0.4, ease: 'power2.inOut' }, 0.08)
        .fromTo(qsImg, { xPercent: 8, scale: 1.12 }, { xPercent: 0, scale: 1, duration: 0.4, ease: 'power2.out' }, 0.08)
        .fromTo(qsPill, { autoAlpha: 0, y: px(-12), scale: 0.92, filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' }, 0.38)
        .fromTo(moveT2, { ...R.standFrom }, { ...R.standTo, duration: 0.18, stagger: 0.03, ease: 'power2.out' }, 0.2)
        .fromTo(subLines, { ...R.riseFrom }, { ...R.riseTo, duration: 0.16, stagger: 0.05, ease: 'power2.out' }, 0.3);
      // the copies peel off Renée's cards, lift, cross with an amber glow and land in order
      qsFlys.forEach((f, i) => {
        const k = f.dataset.key, t = 0.46 + i * 0.07;
        tl.fromTo(f, { x: () => off[k].x, y: () => off[k].y, autoAlpha: 0, rotation: 0, rotationY: 0, scale: 1, '--glow': 0 },
          { y: () => off[k].y - 46 * K(), autoAlpha: 1, rotation: -2.5, rotationY: -14, scale: 1.04, '--glow': 1, duration: 0.07, ease: 'power2.out' }, t)
          .to(f, { x: 0, y: 0, rotation: 0, rotationY: 0, scale: 1, '--glow': 0, duration: 0.17, ease: 'power3.inOut' }, t + 0.07);
      });
      tl.to({}, { duration: 0.12 });
    } else {
      // phone: one side per beat. Quarrystone's panel rises from its 20px peek while Renée's
      // collapses into a 20px sliver at the top; the copies cascade into place.
      const qsCards = $$('.stack .fly > .card', qs);
      gsap.set(qs, { yPercent: 0, y: () => qs.offsetHeight - 20 * K() });
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + innerHeight * 1.8, pin, scrub: 0.35, invalidateOnRefresh: true } });
      tl.to({}, { duration: 0.08 })
        .fromTo(qs, { y: () => qs.offsetHeight - 20 * K() }, { y: 0, duration: 0.4, ease: 'power2.inOut' }, 0.08)
        .fromTo(rn, { height: () => row.offsetHeight }, { height: px(20), duration: 0.4, ease: 'power2.inOut' }, 0.08)
        .fromTo([$('.pill', rn), $('.stack', rn)], { autoAlpha: 1, scale: 1, filter: 'blur(0px)' }, { autoAlpha: 0, scale: 0.94, filter: 'blur(6px)', duration: 0.22 }, 0.1)
        .fromTo(qsImg, { yPercent: 10 }, { yPercent: 0, duration: 0.4, ease: 'power2.out' }, 0.08)
        .fromTo(moveT2, { ...R.standFrom }, { ...R.standTo, duration: 0.16, stagger: 0.03, ease: 'power2.out' }, 0.22)
        .fromTo(subLines, { ...R.riseFrom }, { ...R.riseTo, duration: 0.16, stagger: 0.04, ease: 'power2.out' }, 0.3)
        .fromTo(qsPill, { autoAlpha: 0, y: px(-10), filter: 'blur(8px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.12, ease: 'power2.out' }, 0.42)
        .fromTo(qsCards, { autoAlpha: 0, y: px(70), rotationX: -18, filter: 'blur(8px)' },
          { autoAlpha: 1, y: 0, rotationX: 0, filter: 'blur(0px)', duration: 0.2, stagger: 0.06, ease: 'power3.out' }, 0.48)
        .to({}, { duration: 0.14 });
    }
  }

  /* ---------------------------------------------------------------- 3 · a record that does more */
  function record(desk) {
    const sec = $('.record'), pin = $('.record__pin'), stage = $('.record__stage');
    const wrap = $('.record__logwrap'), log = $('.log', wrap), rows = $$('.log__row', log), head = $('.log__head', log);
    const holder = $('.record__card'), card = $('.card', holder);
    const sub = $$('.record__sub .ln');

    tilt(holder, { max: 6 });
    standOnEnter(recordWords, sec, 'top 55%');
    riseOnEnter(sub, sec, 'top 55%', 0.35);
    gsap.fromTo(card, { y: px(40), rotationX: 18, autoAlpha: 0, filter: 'blur(10px)', transformPerspective: 1200 },
      { y: 0, rotationX: 0, autoAlpha: 1, filter: 'blur(0px)', ease: 'none', scrollTrigger: { trigger: sec, start: 'top 75%', end: 'top 10%', scrub: true, invalidateOnRefresh: true } });

    // the dark sheet arrives inset in the 8px shell and opens to full bleed as it reaches the top
    if (desk) gsap.fromTo(pin, { '--ri': px(8)().toFixed(2) + 'px' }, { '--ri': '0px', ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'top top', scrub: true, invalidateOnRefresh: true } });

    gsap.set(rows, { autoAlpha: 0, y: px(14), filter: 'blur(6px)' });
    gsap.set(head, { autoAlpha: 0 });
    const rowsBox = $('.log__rows', log);
    gsap.set(rowsBox, { autoAlpha: 0 });
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + innerHeight * 1.6, pin, scrub: 0.35, invalidateOnRefresh: true } });
    tl.to({}, { duration: 0.1 })
      // 3.1 → 3.2: the log unfolds under the card; the card lifts with it, tipping toward you
      .fromTo(wrap, { height: 0 }, { height: () => log.offsetHeight, duration: 0.4, ease: 'power2.inOut' }, 0.1)
      .to(card, { rotationX: 9, duration: 0.2, ease: 'power1.out' }, 0.1)
      .to(card, { rotationX: 0, duration: 0.25, ease: 'power2.out' }, 0.3);
    if (desk) tl.fromTo(stage, { gap: px(32) }, { gap: px(48), duration: 0.4, ease: 'power2.inOut' }, 0.1);
    // the drawer opens top-down and each entry settles as the edge passes it
    tl.to(head, { autoAlpha: 1, duration: 0.1 }, 0.12)
      .to(rowsBox, { autoAlpha: 1, duration: 0.12 }, 0.14)
      .to(rows, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.16, stagger: 0.06, ease: 'power2.out' }, 0.2)
      .to({}, { duration: 0.22 });
  }

  /* ---------------------------------------------------------------- go */
  R.progress();
  R.glow($('.hero .pbtn'));
  R.ready(() => {
    loadIn();
    mountStage();
    ST.refresh();
  });
  if (R.reduce) { gsap.set([...heroWords, ...moveT1, ...moveT2, ...recordWords], { clearProps: 'all' }); }
})();
