/* Module: ledger. Bars grow once as the chart arrives (stagger, subtle); table rows tick in once. */
(window.RovnSubModules = window.RovnSubModules || []).push({
  name: 'ledger',
  init(K) {
    const { gsap, ST, R, $, $$, tick } = K;
    const sec = $('.ledger');
    if (!sec) return;
    if (R.reduce) return;
    const h = $('[data-stand-view]', sec);
    if (h) {
      const words = R.words(h);
      gsap.set(words, { ...R.standFrom });
      ST.create({ trigger: h, start: 'top 90%', once: true, onEnter: () => gsap.to(words, { ...R.standTo, duration: 1.2, ease: 'expo.out', stagger: 0.04 }) });
    }
    const chart = $('.chart', sec);
    if (chart) {
      const bars = $$('.chart__bar', chart), labels = $$('.chart__v, .chart__m', chart), chip = $('.chart__chip', chart);
      gsap.set(bars, { scaleY: 0 });
      gsap.set(labels, { autoAlpha: 0, y: 4 });
      if (chip) gsap.set(chip, { autoAlpha: 0, y: 6 });
      ST.create({ trigger: chart, start: 'top 80%', once: true, onEnter: () => {
        const tl = gsap.timeline();
        tl.to(bars, { scaleY: 1, duration: 1.1, ease: 'expo.out', stagger: 0.07 }, 0);
        tl.to(labels, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out', stagger: 0.03 }, 0.25);
        if (chip) tl.to(chip, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, 0.9);
      } });
    }
    const table = $('.ltable', sec);
    if (table) {
      gsap.set($$('[data-tick]', table), { autoAlpha: 0, y: 6 });
      ST.create({ trigger: table, start: 'top 85%', once: true, onEnter: () => tick(table) });
    }
  },
});
