/* Concept 3 · Editorial — scroll choreography
   23FG-0 hero (black cell bar, corridor, headline row) → 23HC-0/23IB-0 statement → pinned split:
   23NE-0 (clinicians open) → 23MB-0 (image hand-off) → 23JB-0 (facilities open). Nothing snaps.
   Split scroll units: 1 = one viewport height, from the section's top meeting the viewport bottom. */
window.Rovn.ready(() => {
  const R = window.Rovn, gsap = window.gsap, ST = window.ScrollTrigger;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const nav = $('.nav'), hero = $('.hero'), split = $('.split');
  const vh = () => window.innerHeight;

  R.video($('.hero__video'), { mp4: 'media/video/c3-hero-1080.mp4', mp4Small: 'media/video/c3-hero-720.mp4' });
  R.progress();

  /* ---------- hovers: cells fill from the bottom; the CTAs fill with the board's amber gradient ---------- */
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
  R.glider($('.nav__bar'), $$('.nav__bar .cell--link'), { kind: 'cell' });
  R.glider($('.footer'), $$('.footer .cell--link'), { kind: 'cell' });
  $$('.cell--cta').forEach((c) => cellFill(c, 'var(--c3-amber)'));
  const glint = R.glint($('.nav__logo'));
  R.glint($('.footer__logo'));

  /* ---------- nav: away while reading down, back the moment you scroll up ---------- */
  let navShown = true;
  const navTo = (show) => {
    if (show === navShown) return; navShown = show;
    gsap.to(nav, { yPercent: show ? 0 : -100, duration: show ? 0.6 : 0.45, ease: show ? 'rovn.out' : 'power2.in', overwrite: true });
    if (show) gsap.delayedCall(0.3, glint);
  };
  ST.create({ start: 0, end: 'max', onUpdate: (s) => navTo(R.scrollY() < 60 || s.direction < 0) });

  // hairlines draw in as they arrive (the hero's is part of the load-in)
  const drawRule = (r, vars = {}) => gsap.fromTo(r, { scaleX: 0 }, { scaleX: 1, duration: 1.3, ease: 'expo.inOut', ...vars });

  const L = { clinicians: 1.35, facilities: 3.2 }; // split rests, in split units
  const splitY = (t) => split.getBoundingClientRect().top + R.scrollY() - vh() + t * vh();
  let jumpTo = (key) => { const el = document.getElementById(key); if (el) el.scrollIntoView({ behavior: R.reduce ? 'auto' : 'smooth' }); };
  $$('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); jumpTo(a.dataset.jump); }));
  $$('a[href="#about"]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); R.scrollTo($('.end').getBoundingClientRect().top + R.scrollY(), { duration: 1.8 });
  }));
  $('.hero__bar').addEventListener('click', (e) => { e.preventDefault(); R.scrollTo($('.read').getBoundingClientRect().top + R.scrollY(), { duration: 1.4 }); });

  const mm = gsap.matchMedia();
  mm.add({
    motion: '(min-width: 821px) and (prefers-reduced-motion: no-preference)',
    still: '(max-width: 820px), (prefers-reduced-motion: reduce)',
  }, (ctx) => (ctx.conditions.motion ? buildMotion() : buildStatic()));
  R.loaded();

  /* ================= desktop ================= */
  function buildMotion() {
    document.body.classList.remove('is-static');
    const W = {
      hero: R.words($$('.hero__title .line')),
      statement: R.words($$('.statement .line')),
      clinLabel: R.words($('[data-item="clinicians"] .item__label')),
      clinTitle: R.words($('[data-item="clinicians"] .item__title')),
      facLabel: R.words($('[data-item="facilities"] .item__label')),
      facTitle: R.words($('[data-item="facilities"] .item__title')),
      end: R.words($$('.end__title .line')),
    };

    // hero image drifts slower than the page
    gsap.to('.hero__focus', { yPercent: 16, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

    // the wide image opens from its bottom edge; the statement stands up beneath it
    gsap.timeline({ scrollTrigger: { trigger: '.read', start: 'top 98%', end: 'top 30%', scrub: 0.4 } })
      .fromTo('.read__image', { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1, ease: 'power2.out' }, 0)
      .fromTo('.read__image img', { scale: 1.16 }, { scale: 1, duration: 1.4, ease: 'power1.out' }, 0);
    gsap.set(W.statement, { ...R.standFrom });
    gsap.timeline({ scrollTrigger: { trigger: '.read__row', start: 'top 88%', end: 'top 52%', scrub: 0.4 } })
      .to(W.statement, { ...R.standTo, duration: 0.6, ease: 'power2.out', stagger: 0.05 });

    /* ---------- the split, scrubbed: 0 → 1 arrives, 1 → 3.4 pinned, 3.4 → 4.4 leaves ----------
       One value drives the whole hand-off: the seam. It rises from the facilities header (H − 72) to just
       under the clinicians header (72). The panels and the photographs ride on it, so the motion is one
       continuous gesture instead of separate pieces swapping places. */
    const stage = $('.split__stage');
    const panelA = $('.panel--a'), panelB = $('.panel--b');
    const cA = $('.panel__content', panelA), cB = $('.panel__content', panelB);
    const shotA = $('[data-shot="clinicians"]'), shotB = $('[data-shot="facilities"]');
    const imgA = $('img', shotA), imgB = $('img', shotB);
    let H = 0, hA = 0, hB = 0;
    const measure = () => { H = stage.clientHeight; hA = cA.offsetHeight; hB = cB.offsetHeight; apply(seamP.p); };
    const seamP = { p: 0 };
    function apply(p) {
      if (!H) return;
      const top = 72, bottom = H - 72, seam = bottom - (bottom - top) * p;
      stage.style.setProperty('--seam', `${seam}px`);
      gsap.set(cA, { y: Math.max(24, (seam - hA) / 2) });                 // centred in what's left above the seam
      gsap.set(cB, { y: seam + Math.max(24, (H - seam - hB) / 2) });      // centred in what's below it
      gsap.set(imgB, { y: (seam - 4) * 0.82, scale: 1.04 - 0.04 * p });   // the next photo rises with the seam
      gsap.set(imgA, { y: -(bottom - seam) * 0.22, filter: `brightness(${1 - 0.12 * p})` }); // the last one steps back
    }
    ST.addEventListener('refreshInit', () => { H = 0; });
    ST.addEventListener('refresh', measure);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: split, start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
    // arriving: the clinicians' copy stands up and the photo settles
    tl.fromTo($('img', shotA), { scale: 1.12 }, { scale: 1, duration: 0.9, ease: 'power1.out' }, 0.2);
    tl.fromTo('.rule--item', { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: 'power2.inOut' }, 0.55);
    R.tlStand(tl, [...W.clinLabel, ...W.clinTitle], 0.62, 0.32, 0.04);
    R.tlRise(tl, $('.item__body', panelA), 0.78, 0.3);
    R.tlStand(tl, W.facLabel, 0.7, 0.3, 0.04);
    // dwell · for clinicians (1.1 → 1.6)
    // the hand-off: one long, eased rise of the seam (1.6 → 3.0); copy fades as its panel closes or opens
    tl.to(seamP, { p: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: () => apply(seamP.p) }, 1.6);
    tl.to([...W.clinTitle, $('.item__body', panelA)], { autoAlpha: 0, filter: 'blur(6px)', duration: 0.45, ease: 'power1.in', stagger: 0.02 }, 1.75);
    gsap.set([...W.facTitle], { ...R.standFrom });
    gsap.set($('.item__body', panelB), { ...R.riseFrom });
    tl.to(W.facTitle, { ...R.standTo, duration: 0.5, ease: 'power2.out', stagger: 0.05 }, 2.35)
      .to($('.item__body', panelB), { ...R.riseTo, duration: 0.45, ease: 'power2.out' }, 2.5);
    // dwell · for facilities (3.0 → 3.4), then the stage leaves
    tl.set({}, {}, 4.4);
    measure();

    jumpTo = (key) => { if (key in L) R.scrollTo(splitY(L[key]), { duration: 1.9 }); };

    endReveal(W.end);

    /* ---------- load-in (no preloader) ---------- */
    const cells = $$('.nav__bar > .cell');
    gsap.set(cells, { autoAlpha: 0, y: -8 });
    gsap.set(W.hero, { ...R.standFrom });
    gsap.set('.hero__intro', { ...R.riseFrom });
    gsap.set(['.hero__scroll', '.hero__bar .arrow'], { autoAlpha: 0, y: 10 });
    gsap.set('.hero__bar .rule', { scaleX: 0 });
    gsap.timeline({ delay: 0.05 })
      .fromTo('.hero__focus', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' }, 0)
      .fromTo('.hero__focus', { scale: 1.07, filter: 'blur(16px) brightness(0.8)' },
        { scale: 1, filter: 'blur(0px) brightness(1)', duration: 1.6, ease: 'expo.out', clearProps: 'filter' }, 0)
      .to(cells, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.05 }, 0.15)
      .to('.hero__intro', { ...R.riseTo, duration: 1.1, ease: 'expo.out' }, 0.45)
      .to(W.hero, { ...R.standTo, duration: 1.3, ease: 'expo.out', stagger: 0.06 }, 0.5)
      .add(drawRule($('.hero__bar .rule')), 0.7)
      .to(['.hero__scroll', '.hero__bar .arrow'], { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 1.0)
      .add(() => glint(), 1.2);
    gsap.to('.hero__bar .arrow', { y: 3, duration: 1.1, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: 2.2 });

    return () => {};
  }

  // end cap: rules draw, the headline stands up, the CTA cells rise
  function endReveal(words) {
    if (R.reduce) return;
    const rules = $$('.end .rule');
    gsap.set(rules, { scaleX: 0 });
    gsap.set(words, { ...R.standFrom });
    gsap.set(['.end__intro', '.end__cell'], { ...R.riseFrom });
    ST.create({
      trigger: '.end', start: 'top 78%', once: true,
      onEnter: () => {
        rules.forEach((r, i) => drawRule(r, { delay: i * 0.12 }));
        R.stand(words, { delay: 0.15, stagger: 0.05 });
        R.rise('.end__intro', { delay: 0.3 });
        R.rise('.end__cell', { delay: 0.5, stagger: 0.1 });
      },
    });
  }

  /* ================= phones, tablets, reduced motion ================= */
  function buildStatic() {
    document.body.classList.add('is-static');
    if (!R.reduce) {
      R.stand(R.words($$('.hero__title .line')), { delay: 0.25, stagger: 0.06 });
      R.rise('.hero__intro', { delay: 0.2 });
      gsap.delayedCall(1.0, glint);
      $$('.statement .line, .item__label, .item__title').forEach((line) => {
        const words = R.words(line);
        gsap.set(words, { ...R.standFrom });
        ST.create({ trigger: line, start: 'top 92%', once: true, onEnter: () => R.stand(words, { stagger: 0.05 }) });
      });
      $$('.read__image, .shot, .item__body').forEach((el) => {
        gsap.fromTo(el, { autoAlpha: 0, y: 36, filter: 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
      });
      endReveal(R.words($$('.end__title .line')));
    }
    return () => document.body.classList.remove('is-static');
  }
});
