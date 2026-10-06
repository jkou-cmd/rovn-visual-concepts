/* module · lanes: bars grow in left to right once (staggered by row), the Today marker arrives last.
   Hover (a 2px lift) is plain CSS. Nothing pins or scrubs. */
(window.RovnSubModules = window.RovnSubModules || []).push({
  name: 'lanes',
  init(K) {
    const { gsap, ST, R, $, $$ } = K;
    const sec = $('.lanes'); if (!sec) return;
    const chart = $('[data-lanes]', sec), scroller = $('.lanes__scroll', sec);
    // the status beside each name on phones: the lane's own bar label (or the label outside it), as text
    $$('.lane', chart).forEach((lane) => {
      if ($('.lane__note', lane)) return;
      const src = $('.bar__c .bar__t', lane) ? $('.bar__c', lane) : $('.lane__out', lane);
      if (!src) return;
      const note = document.createElement('span'); note.className = 'lane__note';
      if ($('.bar--decide', lane)) note.classList.add('lane__note--decide');
      $$('.bar__t, .bar__d', src).forEach((t) => note.append(t.cloneNode(true)));
      $('.lane__plot', lane).before(note);
    });
    // phones: hide an axis date the Today pill would sit on
    const cover = () => {
      const pill = $('.lpill--today', chart); if (!pill) return;
      const pr = pill.getBoundingClientRect();
      $$('.laxl', chart).forEach((l) => { l.classList.remove('is-covered'); const r = l.getBoundingClientRect(); if (r.right > pr.left - 6 && r.left < pr.right + 6) l.classList.add('is-covered'); });
    };
    cover(); addEventListener('resize', cover); if (document.fonts) document.fonts.ready.then(cover);
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
