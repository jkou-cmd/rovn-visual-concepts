/* Rōvn home · 9 · Close: two doors, the ink footer and the giant wordmark band.
   No pin. Doors: the photos drift inside their frames as the doors cross the screen (as section 1);
   once a door's copy is on screen its label and title stand up word by word and its paper pill
   unrolls out of the arrow chip. Desktop hover (fine pointers): the door widens, its neighbour gives
   way and the arrow slides through its chip (section 1's doors(), rebuilt here for .cdoor).
   Footer: the brand block and the link columns rise; the links share one glider (R.glider, pill).
   Band: a curtain reveal (INVENTORY §15). The band is sticky to the bottom of the screen behind the
   ink sheet (CSS), so the sheet scrolls up off it. As it uncovers, the band comes out of the sheet's
   shadow and its photo settles; once the wordmark is mostly uncovered, amber light sweeps it once.
   The light is never left resting on it. */
(function () {
  // listeners from the last init; removed whenever the breakpoint (and so the layout) changes
  const offs = [];
  const clean = () => { while (offs.length) offs.pop()(); };
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); offs.push(() => el.removeEventListener(type, fn, opt)); };

  // The CTA unrolls out of its chip: the ink chip lands at the pill's left end (its paper rim grows
  // with it from a point), then the pill opens to the right carrying the chip along, and the label
  // clears behind it. The pill is cut by its own rounded shape, so no straight edge shows.
  function ctaIn(btn, H) {
    const { gsap, $, K } = H;
    const chip = $('.pbtn__chip', btn), label = $('.pbtn__label', btn);
    const W = () => btn.offsetWidth, c = () => chip.offsetWidth + 8 * K();
    const run = () => Math.max(0, W() - c());
    const dot = () => { const r = c() / 2; return `inset(${r}px ${W() - r}px ${r}px ${r}px round 999px)`; };
    const shut = () => `inset(0px ${run()}px 0px 0px round 999px)`;
    gsap.set(btn, { clipPath: dot() });
    gsap.set(chip, { x: -run(), scale: 0.4 });
    gsap.set(label, { autoAlpha: 0, x: -12 * K(), filter: 'blur(6px)' });
    return gsap.timeline({ paused: true })
      .fromTo(btn, { clipPath: dot }, { clipPath: shut, duration: 0.45, ease: 'power3.out', immediateRender: false }, 0)
      .to(chip, { scale: 1, duration: 0.55, ease: 'back.out(2)' }, 0)
      .to(btn, { clipPath: 'inset(0px 0px 0px 0px round 999px)', duration: 0.9, ease: 'expo.out' }, 0.3)
      .fromTo(chip, { x: () => -run() }, { x: 0, duration: 0.9, ease: 'expo.out', immediateRender: false }, 0.3)
      .to(label, { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out' }, 0.42)
      .set(btn, { clearProps: 'clipPath' });
  }

  // Desktop hover: the hovered door widens and its neighbour gives way; the arrow slides through its chip.
  function doorsHover(row, H) {
    const { gsap, R, $, $$, K } = H;
    if (!R.fine) return;
    const all = $$('.cdoor', row);
    const grow = (el, g) => gsap.to(el, { flexGrow: g, duration: 0.9, ease: 'expo.out', overwrite: 'auto' });
    all.forEach((d) => {
      const arrow = $('.pbtn__chip svg', d), shade = $('.door__shade', d);
      let slide = null;
      on(d, 'pointerenter', () => {
        all.forEach((o) => grow(o, o === d ? 1.6 : 1));
        gsap.to(shade, { opacity: 0.8, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
        if (slide) slide.kill();
        slide = gsap.timeline().to(arrow, { x: 22 * K(), duration: 0.18, ease: 'power2.in' }).set(arrow, { x: -22 * K() }).to(arrow, { x: 0, duration: 0.45, ease: 'expo.out' });
      });
      on(d, 'pointerleave', () => gsap.to(shade, { opacity: 1, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }));
    });
    on(row, 'pointerleave', () => all.forEach((o) => grow(o, 1)));
  }

  function init(desk, H) {
    clean();
    const { gsap, ST, R, $, $$, K } = H;
    const sec = $('.close'); if (!sec) return;
    const sheet = $('.close__sheet', sec), row = $('.close__doors', sec), doors = $$('.cdoor', row);
    const foot = $('.foot', sec), links = $('.foot__links', foot), band = $('.band', sec);

    /* ---------------- doors */
    doors.forEach((d, i) => {
      const img = $('.cdoor__img', d);
      gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: d, start: 'top bottom', end: 'bottom top', scrub: true } });

      const words = H.split([$('.door__label', d), $('.door__title', d)]);
      gsap.set(words, { ...R.standFrom });
      const cta = ctaIn($('.cdoor__cta', d), H);
      const lag = desk ? i * 0.12 : 0;
      ST.create({
        trigger: d, start: 'bottom 94%', once: true,
        onEnter: () => { R.stand(words, { delay: lag }); gsap.delayedCall(0.4 + lag, () => cta.play()); },
      });
    });
    if (desk) doorsHover(row, H);
    $$('.cdoor__cta', row).forEach((b) => R.glow(b));

    /* ---------------- footer */
    H.riseOnEnter([$('.foot__logo', foot), $('.foot__tag', foot), $('.foot__copy', foot), ...$$('.foot__col', foot)], foot, 'top 92%', 0.1);
    if (!links.dataset.glider) { links.dataset.glider = '1'; R.glider(links, $$('.foot__link', links), { kind: 'pill', padX: 12, padY: 6 }); }

    /* ---------------- band: out of the sheet's shadow while it uncovers, then one sweep of amber light */
    const reveal = () => ({ trigger: sheet, start: 'bottom bottom', end: () => 'bottom ' + (innerHeight - band.offsetHeight) + 'px', scrub: true, invalidateOnRefresh: true });
    gsap.fromTo($('.band__shade', band), { opacity: 0.5 }, { opacity: 0, ease: 'none', scrollTrigger: reveal() });
    gsap.fromTo($('.band__img', band), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: reveal() });
    const glow = $('.band__glow', band);
    ST.create({
      trigger: sheet, start: () => 'bottom ' + (innerHeight - band.offsetHeight * 0.6) + 'px',
      onEnter: () => gsap.fromTo(glow, { '--glint': -0.6 }, { '--glint': 1.6, duration: 2.4, ease: 'power1.inOut', overwrite: true }),
    });
  }

  (window.RovnHomeSections = window.RovnHomeSections || []).push({
    name: 'close',
    init,
    // reduced motion: the CSS already is the final state; the band scrolls in normally (no sticky)
    reduce() { clean(); },
  });
})();
