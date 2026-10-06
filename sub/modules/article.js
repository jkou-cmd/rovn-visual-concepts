/* Module: article. The contents rail follows the section being read and glides to a section on click.
   Body text never animates; h2s (data-stand-view) stand up once as they arrive. */
(window.RovnSubModules = window.RovnSubModules || []).push({
  name: 'article',
  init(K) {
    const { gsap, ST, R, $, $$ } = K;
    const sec = $('.article');
    if (!sec) return;
    const heads = $$('[data-toc]', sec);
    const links = $$('[data-toc-link]', sec);
    const now = $('.article__now', sec);
    const toc = $('.article__toc', sec);
    const NAV = 48;
    let active = -1, locked = false, unlock = null;

    const set = (i) => {
      if (i === active) return;
      active = i;
      const id = heads[i] && heads[i].id;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
      const cur = links.find((a) => a.classList.contains('is-active'));
      if (now && cur) now.textContent = cur.dataset.t;
    };
    const update = () => {
      if (locked || !heads.length) return;
      const line = NAV + innerHeight * 0.3;
      let idx = 0;
      heads.forEach((h, i) => { if (h.getBoundingClientRect().top <= line) idx = i; });
      set(idx);
    };
    ST.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: update });
    update();

    links.forEach((a) => a.addEventListener('click', (e) => {
      const i = heads.findIndex((h) => '#' + h.id === a.getAttribute('href'));
      if (i < 0) return;
      e.preventDefault(); e.stopPropagation(); // sub.js also scrolls hash links; this one owns the contents
      if (toc) toc.open = false;
      set(i);
      locked = true;
      clearTimeout(unlock);
      const done = () => { locked = false; update(); };
      unlock = setTimeout(done, 2000);
      const y = heads[i].getBoundingClientRect().top + R.scrollY() - NAV - 24;
      R.scrollTo(y, { onComplete: () => { clearTimeout(unlock); done(); } });
    }));

    // h2s stand up once as they arrive (the ledger module does its own)
    if (!R.reduce) {
      $$('[data-stand-view]', sec).filter((h) => !h.closest('.ledger')).forEach((h) => {
        const words = R.words(h);
        gsap.set(words, { ...R.standFrom });
        ST.create({ trigger: h, start: 'top 90%', once: true, onEnter: () => gsap.to(words, { ...R.standTo, duration: 1.2, ease: 'expo.out', stagger: 0.04 }) });
      });
    }
  },
});
