/* Concept 2 · Doors — interaction and scroll choreography
   22KS-0: headline + two equal doors. 22ML-0: a door opens (1113 / 303) to its line and arrow, and its clip plays.
   22GL-0: the statement in a stone frame among floating photographs; the nav becomes the 960px pill.
   Scroll units in the gallery: 1 = one viewport height. Nothing snaps. */
window.Rovn.ready(() => {
  const R = window.Rovn, gsap = window.gsap, ST = window.ScrollTrigger;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const nav = $('.nav'), navInner = $('.nav__inner');
  const row = $('.doors'), doors = $$('.door');
  const gallery = $('.gallery'), floats = $$('.float');
  const vh = () => window.innerHeight, vw = () => window.innerWidth;

  R.progress();

  /* ---------- hovers (fine pointers only; see motion.js) ---------- */
  const glint = R.glint($('.nav__logo'));
  R.glint($('.footer__logo'));
  // one soft highlight travels between the nav items
  R.glider($('.nav__links'), $$('.nav__links a'));
  R.glider($('.nav__actions'), [$('.nav__contact')], { padX: 0, padY: 0 });
  R.glider($('.footer__links'), $$('.footer__links a'), { padX: 10, padY: 8 });
  R.glow($('.nav__join'));
  R.glow($('.close__join'));
  doors.forEach((d) => R.glow($('.door__go', d)));
  R.fill($('.close__demo'), () => 0.16);

  /* ---------- door clips: loaded on first intent, played only while a door is open ---------- */
  const clipOf = (door) => {
    const v = $('.door__video', door);
    if (!v || R.reduce) return null;
    if (!v.__ready) {
      const size = vw() < 900 || (navigator.connection && navigator.connection.saveData) ? 720 : 1080;
      v.innerHTML = `<source src="media/video/${v.dataset.clip}-${size}.mp4" type="video/mp4">`;
      v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto'; v.load();
      v.__ready = true;
    }
    return v;
  };
  const playClip = (door) => {
    const v = clipOf(door); if (!v) return;
    v.dataset.playing = '1';
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    // a blur dissolve: the photo softens as the moving picture comes up through it
    gsap.to(v, { opacity: 1, duration: 0.45, delay: 0.04, ease: 'power2.out', overwrite: 'auto' });
    gsap.to($('.door__img', door), { filter: 'blur(8px)', duration: 0.45, delay: 0.04, ease: 'power2.out', overwrite: 'auto' });
  };
  const stopClip = (door) => {
    const v = $('.door__video', door); if (!v || !v.__ready) return;
    v.dataset.playing = '0';
    gsap.to(v, { opacity: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto', onComplete: () => { if (v.dataset.playing !== '1') v.pause(); } });
    gsap.to($('.door__img', door), { filter: 'blur(0px)', duration: 0.35, ease: 'power2.out', overwrite: 'auto', clearProps: 'filter' });
  };

  /* ---------- the accordion (22KS-0 → 22ML-0) ---------- */
  const OPEN = 1113 / 303; // flex-grow that splits the row 1113 : 303, as on the board
  window.CustomEase.create('rovn.snap', 'M0,0 C0.2,0.85 0.25,1 1,1'); // quick off the mark, firm landing, no long tail
  let openKey = null, pending = null, accordion = false;
  function setOpen(key) {
    if (!accordion || key === openKey) return;
    openKey = key;
    doors.forEach((d) => {
      const on = d.dataset.door === key;
      gsap.to(d, { flexGrow: key ? (on ? OPEN : 1) : 1, duration: 0.6, ease: 'rovn.snap', overwrite: 'auto' });
      const more = $('.door__more', d), body = $('.door__body', d), go = $('.door__go', d);
      if (on) {
        gsap.to(more, { height: 'auto', duration: 0.5, ease: 'rovn.snap', overwrite: 'auto' });
        gsap.fromTo(body, { autoAlpha: 0, y: 12, filter: 'blur(5px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.55, delay: 0.06, ease: 'expo.out', overwrite: 'auto' });
        gsap.fromTo(go, { autoAlpha: 0, scale: 0.6, rotate: -30 },
          { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.5, delay: 0.12, ease: 'expo.out', overwrite: 'auto' });
        playClip(d);
      } else {
        gsap.to(more, { height: 0, duration: 0.38, ease: 'power2.inOut', overwrite: 'auto' });
        gsap.to(body, { autoAlpha: 0, y: 6, filter: 'blur(4px)', duration: 0.18, ease: 'power1.in', overwrite: 'auto' });
        gsap.to(go, { autoAlpha: 0, scale: 0.7, duration: 0.18, ease: 'power2.in', overwrite: 'auto' });
        stopClip(d);
      }
    });
  }
  const want = (key, delay) => {
    if (pending) pending.kill();
    pending = gsap.delayedCall(delay, () => setOpen(key));
  };
  doors.forEach((d) => {
    d.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') want(d.dataset.door, 0); });
    d.addEventListener('focusin', () => want(d.dataset.door, 0));
    // touch: the first tap opens a door; on an open door, anywhere is its way in
    d.addEventListener('click', (e) => {
      if (!accordion) return;
      const go = $('.door__go', d);
      if (openKey !== d.dataset.door) { e.preventDefault(); setOpen(d.dataset.door); return; }
      if (!e.target.closest('a')) window.location.href = go.href;
    });
  });
  row.addEventListener('pointerenter', () => doors.forEach(clipOf), { once: true }); // warm both clips on first intent
  row.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') want(null, 0.1); });
  row.addEventListener('focusout', (e) => { if (!row.contains(e.relatedTarget)) want(null, 0.12); });

  // nav and footer links open their door (scrolling back up to it first if needed)
  $$('[data-door-link]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const key = a.dataset.doorLink;
    if (R.scrollY() > 40) { R.scrollTo(0, { duration: 1.4 }); gsap.delayedCall(1.0, () => setOpen(key)); }
    else setOpen(key);
  }));
  $$('a[href="#about"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); R.scrollTo($('.close').getBoundingClientRect().top + R.scrollY(), { duration: 1.8 });
  }));

  /* ---------- nav: full bar → the 960px pill (22KS-0 → 22GL-0) ---------- */
  function navMorph(start) {
    const navTl = gsap.timeline({ paused: true, defaults: { duration: 0.8, ease: 'rovn.inOut' } })
      .to('.nav__links', { autoAlpha: 0, y: -6, filter: 'blur(6px)', duration: 0.32, ease: 'power2.in' }, 0)
      .to('.nav__fade', { opacity: 1, duration: 0.6, ease: 'power1.out' }, 0.1)
      .to(navInner, {
        width: () => Math.min(960, vw() - 24), padding: 4, marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(16px) saturate(1.2)',
      }, 0.04);
    ST.create({
      start,
      onEnter: () => { if (R.reduce) navTl.progress(1); else { navTl.play(); gsap.delayedCall(0.45, glint); } },
      onLeaveBack: () => { if (R.reduce) navTl.progress(0); else navTl.reverse(); },
      onRefresh: (self) => { if (R.scrollY() > self.start) navTl.progress(1); },
    });
  }

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(min-width: 821px) and (prefers-reduced-motion: no-preference)',
    still: '(max-width: 820px), (prefers-reduced-motion: reduce)',
  }, (ctx) => (ctx.conditions.motion ? buildMotion() : buildStatic()));
  R.loaded();

  /* ================= desktop ================= */
  function buildMotion() {
    document.body.classList.remove('is-static');
    accordion = true;

    const W = {
      hero: R.words($$('.hero__title .line')),
      doors: R.words($$('.door__heads .line')),
      statement: R.words($$('.statement .line')),
    };

    /* ---------- gallery, scrubbed: 0 → 1 the frame arrives, 1 → 2.6 pinned, 2.6 → 3.6 it leaves ---------- */
    const depth = (el) => parseFloat(el.style.getPropertyValue('--z')) || 0;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: gallery, start: 'top bottom', end: 'bottom top', scrub: 0.4, invalidateOnRefresh: true },
    });
    // photos come forward out of the frame's depth and land exactly on the board's composition;
    // their depth (--z) sets how far back they start and how fast they drift
    floats.forEach((f, i) => {
      tl.fromTo(f, { z: () => -720 + depth(f) * 2, yPercent: 26, rotateX: 10, autoAlpha: 0, filter: 'blur(14px)' },
        { z: 0, yPercent: 0, rotateX: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.62, ease: 'power2.out' }, 0.32 + i * 0.11);
    });
    // a slow parallax drift across the whole scene, zero at the middle of the dwell (1.62) so the
    // composition rests exactly on the board; nearer photos travel further
    floats.forEach((f) => {
      const d = 1 + Math.abs(depth(f)) / -400; // 1 at the front plane, smaller further back
      tl.fromTo(f, { y: () => vh() * 0.09 * d }, { y: () => -vh() * 0.09 * d, duration: 3.24 }, 0);
    });
    R.tlStand(tl, W.statement, 0.78, 0.3, 0.05);
    // dwell · 1.25 → 2.0
    // the photos pass the camera and are gone; the statement stays as the frame leaves
    floats.forEach((f, i) => {
      tl.to(f, { z: 640, autoAlpha: 0, filter: 'blur(12px)', duration: 0.7, ease: 'power2.in' }, 2.0 + i * 0.07);
    });
    tl.set({}, {}, 3.6);

    // idle float, independent of scroll
    floats.forEach((f, i) => {
      gsap.to($('.float__inner', f), { y: i % 2 ? 6 : -6, rotate: i % 2 ? -0.5 : 0.5, duration: 5.2 + i * 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true });
    });

    navMorph(() => gallery.getBoundingClientRect().top + R.scrollY() - vh() * 0.38);
    closeReveal();

    /* ---------- load-in (no preloader) ---------- */
    const navUi = ['.nav__links li', '.nav__actions .btn'];
    gsap.set(navUi, { autoAlpha: 0, y: -10, filter: 'blur(4px)' });
    gsap.set(W.hero, { ...R.standFrom });
    gsap.set(W.doors, { ...R.standFrom });
    gsap.set(doors, { y: 70, clipPath: 'inset(100% 0% 0% 0% round 24px)' });
    gsap.timeline({ delay: 0.05 })
      .fromTo('.nav .logo__mark', { autoAlpha: 0, scale: 0.5, rotate: -18, filter: 'blur(6px)', transformOrigin: '50% 50%' },
        { autoAlpha: 1, scale: 1, rotate: 0, filter: 'blur(0px)', duration: 1.0, ease: 'expo.out', clearProps: 'filter' }, 0.1)
      .fromTo('.nav .logo__word', { clipPath: 'inset(0% 100% 0% 0%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.0, ease: 'expo.out', clearProps: 'clipPath' }, 0.24)
      .to(navUi, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.8, stagger: 0.06, ease: 'expo.out' }, 0.32)
      .to(W.hero, { ...R.standTo, duration: 1.3, ease: 'expo.out', stagger: 0.06 }, 0.2)
      .to(doors, { y: 0, clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.5, ease: 'expo.out', stagger: 0.1, clearProps: 'clipPath' }, 0.5)
      .fromTo('.door__img', { scale: 1.14 }, { scale: 1, duration: 2.0, ease: 'expo.out', stagger: 0.1, clearProps: 'transform' }, 0.5)
      .to(W.doors, { ...R.standTo, duration: 1.15, ease: 'expo.out', stagger: 0.04 }, 1.0)
      .add(() => glint(), 1.2);

    return () => { accordion = false; setOpen(null); };
  }

  // the ink band's two columns stand up as they arrive
  function closeReveal() {
    $$('.close__col').forEach((col, i) => {
      const words = R.words($$('.close__label, .close__title', col));
      const rest = $$('.close__body, .close__cta', col);
      if (R.reduce) return;
      gsap.set(words, { ...R.standFrom });
      gsap.set(rest, { ...R.riseFrom });
      ST.create({
        trigger: col, start: 'top 82%', once: true,
        onEnter: () => { R.stand(words, { delay: i * 0.12, stagger: 0.05 }); R.rise(rest, { delay: 0.35 + i * 0.12 }); },
      });
    });
  }

  /* ================= phones, tablets, reduced motion ================= */
  function buildStatic() {
    document.body.classList.add('is-static');
    accordion = false;
    navMorph(() => $('.hero__title').getBoundingClientRect().bottom + R.scrollY() - 40);
    closeReveal();
    if (!R.reduce) {
      R.stand(R.words($$('.hero__title .line')), { delay: 0.25, stagger: 0.06 });
      gsap.delayedCall(1.0, glint);
      $$('.door, .float').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 40, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
      });
      $$('.door__heads .line, .statement .line').forEach((line) => {
        const words = R.words(line);
        gsap.set(words, { ...R.standFrom });
        ST.create({ trigger: line, start: 'top 92%', once: true, onEnter: () => R.stand(words, { stagger: 0.05 }) });
      });
    }
    return () => document.body.classList.remove('is-static');
  }
});
