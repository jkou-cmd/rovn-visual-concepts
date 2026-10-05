/* Rōvn home · 9 · Close: two doors, the ink footer and the giant wordmark band.
   No pin. Doors: the photos drift inside their frames as the doors cross the screen (as section 1);
   once a door's copy is on screen its label and title stand up word by word and its paper pill
   unrolls out of the arrow chip. Desktop hover (fine pointers): the doors keep their width; the hovered photo eases in
   close and to full colour while the other door dims (see doorsHover).
   Footer: the brand block and the link columns rise; the links share one glider (R.glider, pill).
   Band: a curtain reveal (INVENTORY §15). The band is sticky to the bottom of the screen behind the
   ink sheet (CSS), so the sheet scrolls up off it. As it uncovers, the band comes out of the sheet's
   shadow, its photo settles and the wordmark rises out of the bottom edge into place.
   (2026-10-05: the amber light sweep was cut, Jerry found it cheesy.) */
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

  // Desktop hover: the doors keep their width, so no text ever moves (2026-10-05: the widening made Jerry queasy).
  // Instead the hovered door comes forward in light, not in position: its photo eases in close and to full
  // colour, its shade lifts, and the arrow slides through its chip. The other door steps back: it dims and
  // loses some colour.
  function doorsHover(row, H) {
    const { gsap, R, $, $$, K } = H;
    if (!R.fine) return;
    const all = $$('.cdoor', row);
    const look = (d, state) => {
      const img = $('.cdoor__img', d), shade = $('.door__shade', d);
      const v = { rest: [1, 'saturate(1) brightness(1)', 1], on: [1.045, 'saturate(1.08) brightness(1.04)', 0.72], off: [1, 'saturate(0.55) brightness(0.82)', 1] }[state];
      gsap.to(img, { scale: v[0], filter: v[1], duration: state === 'on' ? 1.4 : 0.8, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(shade, { opacity: v[2], duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    };
    all.forEach((d) => {
      const arrow = $('.pbtn__chip svg', d);
      let slide = null;
      on(d, 'pointerenter', () => {
        all.forEach((o) => look(o, o === d ? 'on' : 'off'));
        if (slide) slide.kill();
        slide = gsap.timeline().to(arrow, { x: 22 * K(), duration: 0.18, ease: 'power2.in' }).set(arrow, { x: -22 * K() }).to(arrow, { x: 0, duration: 0.45, ease: 'expo.out' });
      });
    });
    on(row, 'pointerleave', () => all.forEach((o) => look(o, 'rest')));
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

    /* ---------------- band: out of the sheet's shadow while it uncovers; the wordmark rises into place */
    const reveal = () => ({ trigger: sheet, start: 'bottom bottom', end: () => 'bottom ' + (innerHeight - band.offsetHeight) + 'px', scrub: true, invalidateOnRefresh: true });
    gsap.fromTo($('.band__shade', band), { opacity: 0.5 }, { opacity: 0, ease: 'none', scrollTrigger: reveal() });
    gsap.fromTo($('.band__img', band), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: reveal() });
    // the wordmark rises out of the band's bottom edge as it is uncovered, and settles; no light on it
    gsap.fromTo($('.band__mark', band), { yPercent: 24 }, { yPercent: 0, ease: 'none', scrollTrigger: reveal() });
  }

  (window.RovnHomeSections = window.RovnHomeSections || []).push({
    name: 'close',
    init,
    // reduced motion: the CSS already is the final state; the band scrolls in normally (no sticky)
    reduce() { clean(); },
  });
})();
