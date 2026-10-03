/* Concept 4 · Dark — scroll choreography (finished from 22HG-0)
   Nav cells → headline row → the montage, full bleed → image + statement → two rails.
   Each rail pins while its track slides left; the next card (the board's amber strip) arrives in full
   and blooms from a warm edge-light into the amber gradient: dark at rest, amber only through motion. */
window.Rovn.ready(() => {
  const R = window.Rovn, gsap = window.gsap, ST = window.ScrollTrigger;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const nav = $('.nav'), rails = $$('.rail');
  const vh = () => window.innerHeight;

  R.video($('.reel__video'), { mp4: 'media/video/hero-montage-1080.mp4', mp4Small: 'media/video/hero-montage-720.mp4' });
  R.progress();

  /* ---------- hovers ---------- */
  const cellFill = (cell, background) => {
    if (!R.fine || R.reduce || !cell || cell.__fill) return;
    const f = document.createElement('span'); f.className = 'cell__fill'; f.setAttribute('aria-hidden', 'true');
    f.style.background = background; cell.prepend(f); cell.__fill = f;
    const arrow = $('.arrow', cell);
    R.hover(cell, () => {
      gsap.to(f, { scaleY: 1, duration: 0.55, ease: 'rovn.out', overwrite: 'auto' });
      if (arrow) gsap.to(arrow, { x: 4, duration: 0.5, ease: 'rovn.out', overwrite: 'auto' });
    }, () => {
      gsap.to(f, { scaleY: 0, duration: 0.5, ease: 'power2.inOut', overwrite: 'auto' });
      if (arrow) gsap.to(arrow, { x: 0, duration: 0.45, ease: 'rovn.out', overwrite: 'auto' });
    });
  };
  // one highlight travels between the link cells; the CTA cells fill with amber
  R.glider($('.nav__wrap'), $$('.nav__wrap .cell--link'), { kind: 'cell' });
  R.glider($('.footer__wrap'), $$('.footer__wrap .cell--link'), { kind: 'cell' });
  $$('.cell--line').forEach((c) => cellFill(c, 'rgba(255,255,255,0.07)'));
  $$('.cell--cta').forEach((c) => cellFill(c, 'var(--c4-amber)'));
  const glint = R.glint($('.nav__logo'));
  R.glint($('.footer__logo'));
  // the rail cards brighten and their arrow leans in
  $$('.rail__card').forEach((card) => {
    const arrow = $('.arrow', card);
    R.hover(card, () => { gsap.to(card, { '--lift': 1, duration: 0.5, ease: 'rovn.out' }); if (arrow) gsap.to(arrow, { x: 4, duration: 0.5, ease: 'rovn.out', overwrite: 'auto' }); },
      () => { gsap.to(card, { '--lift': 0, duration: 0.5, ease: 'rovn.out' }); if (arrow) gsap.to(arrow, { x: 0, duration: 0.45, ease: 'rovn.out', overwrite: 'auto' }); });
  });

  /* ---------- nav: away while reading down, back the moment you scroll up ---------- */
  let navShown = true;
  const navTo = (show) => {
    if (show === navShown) return; navShown = show;
    gsap.to(nav, { yPercent: show ? 0 : -100, duration: show ? 0.6 : 0.45, ease: show ? 'rovn.out' : 'power2.in', overwrite: true });
    if (show) gsap.delayedCall(0.3, glint);
  };
  ST.create({ start: 0, end: 'max', onUpdate: (s) => navTo(R.scrollY() < 60 || s.direction < 0) });

  // jumps land each rail at the moment its card has arrived
  const railY = (rail, p) => rail.getBoundingClientRect().top + R.scrollY() - (vh() / 2 - 270) + p * vh() * 1.1;
  let jumpTo = (key) => { const el = document.getElementById(key); if (el) el.scrollIntoView({ behavior: R.reduce ? 'auto' : 'smooth' }); };
  $$('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(a.dataset.jump); }));
  $$('a[href="#about"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); R.scrollTo($('.end').getBoundingClientRect().top + R.scrollY() - 60, { duration: 1.9 });
  }));

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(min-width: 821px) and (prefers-reduced-motion: no-preference)',
    still: '(max-width: 820px), (prefers-reduced-motion: reduce)',
  }, (ctx) => (ctx.conditions.motion ? buildMotion() : buildStatic()));
  R.loaded();

  /* ================= desktop ================= */
  function buildMotion() {
    document.body.classList.remove('is-static');

    // the reel drifts slower than the page
    gsap.fromTo('.reel__media > img, .reel__media > video', { yPercent: -4 }, { yPercent: 4, ease: 'none', scrollTrigger: { trigger: '.reel', start: 'top bottom', end: 'bottom top', scrub: true } });

    // image + statement: the photo opens from its left edge, the statement stands up, its line rises
    const W = { hero: R.words($$('.hero__title .line')), statement: R.words($$('.statement .line')), end: R.words($$('.end__title .line')) };
    gsap.timeline({ scrollTrigger: { trigger: '.pair', start: 'top 92%', end: 'top 35%', scrub: 0.4 } })
      .fromTo('.pair__image', { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.out' }, 0)
      .fromTo('.pair__image img', { scale: 1.16 }, { scale: 1, duration: 1.3, ease: 'power1.out' }, 0)
      .fromTo('.pair__panel', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.1);
    gsap.set(W.statement, { ...R.standFrom });
    gsap.set('.pair__line', { ...R.riseFrom });
    gsap.timeline({ scrollTrigger: { trigger: '.pair', start: 'top 70%', end: 'top 20%', scrub: 0.4 } })
      .to(W.statement, { ...R.standTo, duration: 0.6, ease: 'power2.out', stagger: 0.05 }, 0)
      .to('.pair__line', { ...R.riseTo, duration: 0.5, ease: 'power2.out' }, 0.45);

    /* ---------- rails: each holds for 110vh while the photo closes like a door and the card opens ----------
       Both stay inside the grid's right column. The photo's image keeps its width (an aperture, not a squash);
       the card grows from a warm sliver at the edge into the amber gradient, then its words arrive. */
    rails.forEach((rail) => {
      const view = $('.rail__view', rail), photo = $('.rail__photo', rail), img = $('.rail__photo img', rail), card = $('.rail__card', rail);
      const words = R.words($$('.rail__text .line', rail));
      const open = () => view.clientWidth - 8 - 48;          // at rest: a 48px sliver of the next card
      const half = () => Math.round((view.clientWidth - 8) / 2); // after: the column shared evenly
      const setW = () => { rail.style.setProperty('--photo-w', `${open()}px`); };
      setW(); ST.addEventListener('refreshInit', setW);
      gsap.set(words, { ...R.standFrom });
      gsap.set($('.rail__body', rail), { ...R.riseFrom });
      gsap.set([$('.rail__card-label', card), $('.rail__card-cta', card)], { autoAlpha: 0, y: 14, filter: 'blur(6px)' });
      // the copy stands up as the row comes into the frame
      gsap.timeline({ scrollTrigger: { trigger: rail, start: 'top 82%', end: 'top 40%', scrub: 0.4 } })
        .to(words, { ...R.standTo, duration: 0.6, ease: 'power2.out', stagger: 0.04 }, 0)
        .to($('.rail__body', rail), { ...R.riseTo, duration: 0.45, ease: 'power2.out' }, 0.35);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: rail, start: () => `top ${vh() / 2 - 270}px`, end: () => `+=${vh() * 1.1}`, scrub: 0.5, invalidateOnRefresh: true },
      });
      tl.fromTo(photo, { width: () => open() }, { width: () => half(), duration: 0.7, ease: 'power2.inOut' }, 0.12)
        .fromTo(img, { x: 0, scale: 1 }, { x: () => -(open() - half()) * 0.35, scale: 1.03, duration: 0.7, ease: 'power2.inOut' }, 0.12)
        .to($('.rail__bloom', card), { opacity: 1, duration: 0.42, ease: 'power1.inOut' }, 0.36)
        .to($('.rail__light', card), { opacity: 0, duration: 0.3, ease: 'power1.in' }, 0.56)
        .to([$('.rail__card-label', card), $('.rail__card-cta', card)], { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.16, stagger: 0.05, ease: 'power2.out' }, 0.74)
        .set({}, {}, 1);
    });
    jumpTo = (key) => { const rail = $(`.rail[data-rail="${key}"]`); if (rail) R.scrollTo(railY(rail, 1.0), { duration: 1.9 }); };

    endReveal(W.end);

    /* ---------- load-in (no preloader) ---------- */
    const cells = $$('.nav__wrap > .cell');
    gsap.set(cells, { autoAlpha: 0, y: -8 });
    gsap.set(W.hero, { ...R.standFrom });
    gsap.set('.grid__line', { scaleY: 0 });
    gsap.timeline({ delay: 0.05 })
      .to(cells, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05 }, 0.1)
      .to('.grid__line', { scaleY: 1, duration: 2.2, ease: 'expo.inOut', stagger: 0.1 }, 0.15) // the grid draws down the page
      .to(W.hero, { ...R.standTo, duration: 1.3, ease: 'expo.out', stagger: 0.06 }, 0.35)
      .fromTo('.reel', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.45)
      .fromTo('.reel__media', { scale: 1.08, filter: 'blur(10px) brightness(0.8)' }, { scale: 1, filter: 'blur(0px) brightness(1)', duration: 1.8, ease: 'expo.out', clearProps: 'filter' }, 0.45)
      .add(() => glint(), 1.2);

    return () => {};
  }

  // end cap: the grid lines draw, the headline stands up, the cells rise
  function endReveal(words) {
    if (R.reduce) return;
    gsap.set(words, { ...R.standFrom });
    gsap.set('.end__cell', { ...R.riseFrom });
    ST.create({
      trigger: '.end', start: 'top 72%', once: true,
      onEnter: () => { R.stand(words, { stagger: 0.05 }); R.rise('.end__cell', { delay: 0.3, stagger: 0.1 }); },
    });
  }

  /* ================= phones, tablets, reduced motion ================= */
  function buildStatic() {
    document.body.classList.add('is-static');
    if (!R.reduce) {
      R.stand(R.words($$('.hero__title .line')), { delay: 0.25, stagger: 0.06 });
      gsap.delayedCall(1.0, glint);
      $$('.statement .line, .rail__text .line').forEach((line) => {
        const words = R.words(line);
        gsap.set(words, { ...R.standFrom });
        ST.create({ trigger: line, start: 'top 92%', once: true, onEnter: () => R.stand(words, { stagger: 0.05 }) });
      });
      $$('.pair__image, .pair__panel, .rail__photo, .rail__card').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 36, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 94%' } });
      });
      // the cards still arrive through motion: edge-light first, then the amber blooms as they enter
      $$('.rail__card').forEach((card) => {
        const bloom = $('.rail__bloom', card), light = $('.rail__light', card);
        gsap.set(bloom, { opacity: 0 }); gsap.set(light, { opacity: 1 });
        ST.create({ trigger: card, start: 'top 72%', once: true, onEnter: () => {
          gsap.to(bloom, { opacity: 1, duration: 1.4, ease: 'power2.inOut' });
          gsap.to(light, { opacity: 0, duration: 1.0, delay: 0.5, ease: 'power1.in' });
        } });
      });
      endReveal(R.words($$('.end__title .line')));
    }
    return () => document.body.classList.remove('is-static');
  }
});
