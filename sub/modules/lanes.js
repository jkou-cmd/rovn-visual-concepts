/* module · lanes: bars grow in left to right once (staggered by row), the Today marker arrives last.
   Hover (a 2px lift) is plain CSS. Nothing pins or scrubs. */
(window.RovnSubModules = window.RovnSubModules || []).push({
  name: 'lanes',
  init(K) {
    const { gsap, ST, R, $, $$ } = K;
    const sec = $('.lanes'); if (!sec) return;
    const chart = $('[data-lanes]', sec), scroller = $('.lanes__scroll', sec);
    if (R.reduce) return;
    const lanes = $$('.lane', chart);
    const bars = $$('.bar', chart);
    const names = $$('.lane__name', chart);
    const outs = $$('.lane__out', chart);
    const axis = $$('.lband, .laxl', chart);
    const today = $$('.today__line, .lpill--today', chart);
    const shift = $$('.shift__line, .lpill--shift', chart);
    gsap.set([...bars, ...names, ...outs, ...axis, ...today, ...shift], { autoAlpha: 0 });
    ST.create({ trigger: chart, start: 'top 78%', once: true, onEnter: () => {
      const widths = bars.map((b) => b.offsetWidth);
      const tl = gsap.timeline();
      tl.to(axis, { autoAlpha: 1, duration: 0.9, ease: 'power2.out', stagger: 0.05 }, 0);
      tl.to(names, { autoAlpha: 1, duration: 0.8, ease: 'power2.out', stagger: 0.08 }, 0.05);
      lanes.forEach((lane, i) => {
        const b = $('.bar', lane), o = $('.lane__out', lane), w = widths[bars.indexOf(b)];
        const at = 0.25 + i * 0.1;
        tl.fromTo(b, { width: 0, minWidth: 0 }, { width: w, autoAlpha: 1, duration: 1.0, ease: 'expo.out',
          onComplete: () => gsap.set(b, { clearProps: 'width,minWidth' }) }, at);
        tl.set(b, { autoAlpha: 1 }, at);
        if (o) tl.to(o, { autoAlpha: 1, duration: 0.7, ease: 'power2.out' }, at + 0.25);
      });
      const end = 0.25 + (lanes.length - 1) * 0.1 + 0.7;
      tl.fromTo($('.today__line', chart), { scaleY: 0, autoAlpha: 1 }, { scaleY: 1, duration: 0.9, ease: 'expo.out' }, end);
      tl.fromTo($('.lpill--today', chart), { autoAlpha: 0, y: -4 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out' }, end + 0.1);
      tl.fromTo($('.shift__line', chart), { scaleY: 0, autoAlpha: 1 }, { scaleY: 1, duration: 0.9, ease: 'expo.out' }, end + 0.2);
      tl.fromTo($('.lpill--shift', chart), { autoAlpha: 0, y: -4 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out' }, end + 0.3);
    } });
  },
});
