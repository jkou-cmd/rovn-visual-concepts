/* Rōvn home · 8 · Rōvn Lab ("How we think.")
   One beat, no pin. The headline stands up word by word and the sub rises. The three note tiles then
   stand up from lying back, left to right (Collins's case-study shelf, INVENTORY §4), while each photo
   settles from 1.12× to 1× inside its frame and its caption rises. The tiles never fade: they are
   objects, so they stay opaque and simply stand up.
   Desktop: the photos drift a little as the row crosses the screen. Hover (fine pointers) answers at
   once: the photo zooms gently and the tile leans its top edge toward you (Collins's lean, kept small).
   Phone: the row is a native horizontal scroller (momentum, proximity snap) with the next note peeking
   in; each photo slides a little against the swipe, so the tiles read as windows. */
(function () {
  // listeners from the last init; removed whenever the breakpoint (and so the layout) changes
  const offs = [];
  const clean = () => { while (offs.length) offs.pop()(); };
  const on = (el, type, fn, opt) => { el.addEventListener(type, fn, opt); offs.push(() => el.removeEventListener(type, fn, opt)); };

  function init(desk, H) {
    clean();
    const { gsap, ST, R, $, $$ } = H;
    const sec = $('.lab'); if (!sec) return;
    const head = $('.lab__head', sec), row = $('.lab__row', sec);
    const posts = $$('.lab__post', row), tiles = $$('.lab__tile', row), imgs = $$('.lab__img', row);
    const caps = posts.map((p) => [$('.lab__date', p), $('.lab__name', p)]);

    // the headline stands up; the eyebrow (desktop) and the sub rise just after
    H.standOnEnter(H.split($('.lab__title', sec)), head, 'top 80%');
    H.riseOnEnter([...(desk ? [$('.lab__eyebrow', sec)] : []), ...$$('.lab__sub .ln', sec)], head, 'top 80%', 0.3);

    // the tiles lie back on their bottom edges until the row arrives, then stand up one after another
    gsap.set(tiles, { rotationX: desk ? 62 : 56, transformPerspective: desk ? 1100 : 900, transformOrigin: '50% 100%' });
    gsap.set(imgs, { scale: 1.12 });
    gsap.set(caps.flat(), { ...R.riseFrom });
    ST.create({
      trigger: row, start: desk ? 'top 86%' : 'top 88%', once: true,
      onEnter: () => {
        gsap.to(tiles, { rotationX: 0, duration: 1.5, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' });
        gsap.to(imgs, { scale: 1, duration: 2.1, ease: 'expo.out', stagger: 0.09, overwrite: 'auto' });
        caps.forEach((c, i) => gsap.to(c, { ...R.riseTo, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.35 + i * 0.09 }));
      },
    });

    if (desk) {
      // the photos drift inside their frames while the row crosses the screen (the frames hold still)
      gsap.fromTo(imgs, { yPercent: 4 }, { yPercent: -4, ease: 'none', scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: true } });

      // hover: the photo zooms and the tile leans toward you, starting the moment the pointer arrives
      if (R.fine) posts.forEach((p, i) => {
        const t = tiles[i], img = imgs[i];
        const enter = () => {
          gsap.to(t, { rotationX: -4, duration: 0.8, ease: 'expo.out', overwrite: 'auto' });
          gsap.to(img, { scale: 1.05, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
        };
        const leave = () => {
          gsap.to(t, { rotationX: 0, duration: 0.9, ease: 'expo.out', overwrite: 'auto' });
          gsap.to(img, { scale: 1, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
        };
        on(p, 'pointerenter', enter);
        on(p, 'pointerleave', leave);
        on(p, 'focus', () => { if (p.matches(':focus-visible')) enter(); });
        on(p, 'blur', leave);
      });
    } else {
      // phone: each photo slides against the swipe (about 7% of the tile across a screen of travel)
      const set = imgs.map((img) => gsap.quickSetter(img, 'xPercent'));
      let raf = 0;
      const place = () => {
        raf = 0;
        const w = row.clientWidth, x = row.scrollLeft;
        posts.forEach((p, i) => set[i](-6 * gsap.utils.clamp(-1.25, 1.25, (p.offsetLeft - x + p.offsetWidth / 2 - w / 2) / w)));
      };
      on(row, 'scroll', () => { if (!raf) raf = requestAnimationFrame(place); }, { passive: true });
      on(window, 'resize', place);
      place();
    }
  }

  (window.RovnHomeSections = window.RovnHomeSections || []).push({
    name: 'lab',
    init,
    // reduced motion: the CSS already is the final state (tiles upright, photos at rest, captions shown)
    reduce() { clean(); },
  });
})();
