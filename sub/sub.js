/* Rōvn subpage kit — motion. Entrance, exit and hover only; nothing is pinned or scrubbed to a story.
   Everything is attribute-driven so a new page needs no script of its own:
     [data-stand]   heading: words stand up from the baseline when it enters
     [data-rise]    body, buttons, small blocks: a soft rise (siblings in one section stagger)
     [data-photo]   photo: fades in from a soft focus pull
     [data-object]  product object: rises 24px; on hover it tilts toward the pointer with an amber glint
     [data-exit]    section content lifts and fades as it leaves the top of the screen
     [data-morph]   a mask that morphs round ⇄ square: on the opener photo it arrives as a pill and opens
                    square (and rounds a little as you leave); on .acc__stage each new scene grows out of a
                    circle over the last; on <body data-morph-doors> the close doors open from pills and
                    round their corners on hover
     .gl            gridlines: hairlines that draw themselves in when their section enters
     .acc / .faq    accordion and questions open on click
     .close         home's own close (home/sections/s9.js): doors, ink footer, wordmark band
   Built on shared/motion.js (GSAP + Lenis, eases, word split, glow, glider, glint). */
(function () {
  const gsap = window.gsap, ST = window.ScrollTrigger, R = window.Rovn;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const phone = () => document.documentElement.classList.contains('is-phone');
  const rem = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 1;

  ST.config({ ignoreMobileResize: true });
  if (R.lenis) R.lenis.options.lerp = 0.1;

  /* ---------------------------------------------------------------- nav */
  const nav = $('.nav');
  if (nav) {
    nav.style.setProperty('--glider', 'rgba(255, 255, 255, 0.08)');
    R.glider($('.nav__links'), $$('.nav__links .nav__cell'), { kind: 'cell' });
    R.logoGlint($('.nav__logo')); // the same slow pass of light as home
    // hides on the way down, returns on the way up
    let shown = true;
    ST.create({
      start: 0, end: 'max',
      onUpdate(self) {
        const show = self.scroll() < innerHeight * 0.4 || self.direction < 0 || nav.classList.contains('is-open');
        if (show === shown) return;
        shown = show;
        gsap.to(nav, show ? { yPercent: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' } : { yPercent: -102, duration: 0.45, ease: 'power2.in', overwrite: 'auto' });
      },
    });
    // phone menu
    const menu = $('.nav__menu'), sheet = $('.nav__sheet');
    if (menu && sheet) menu.addEventListener('click', () => {
      const open = sheet.hidden;
      sheet.hidden = !open; nav.classList.toggle('is-open', open); menu.setAttribute('aria-expanded', String(open));
      if (open && !R.reduce) gsap.fromTo(sheet.children, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.04, ease: 'expo.out' });
    });
  }

  /* ---------------------------------------------------------------- buttons */
  $$('.pbtn').forEach((b) => R.glow(b));

  /* ---------------------------------------------------------------- objects: tilt + amber glint on hover */
  function tilt(obj) {
    if (!R.fine || R.reduce || obj.__tilt) return;
    obj.__tilt = true;
    const g = document.createElement('span'); g.className = 'obj__glint'; g.setAttribute('aria-hidden', 'true'); obj.append(g);
    const rx = gsap.quickTo(obj, 'rotationX', { duration: 0.8, ease: 'power3' });
    const ry = gsap.quickTo(obj, 'rotationY', { duration: 0.8, ease: 'power3' });
    gsap.set(obj, { transformPerspective: 1400 });
    obj.addEventListener('pointermove', (e) => {
      const r = obj.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      rx((0.5 - y) * 4); ry((x - 0.5) * 5);
      g.style.setProperty('--gx', `${x * 100}%`); g.style.setProperty('--gy', `${y * 100}%`);
    });
    obj.addEventListener('pointerenter', () => gsap.to(g, { opacity: 1, duration: 0.25, ease: 'power1.out', overwrite: 'auto' }));
    obj.addEventListener('pointerleave', () => { rx(0); ry(0); gsap.to(g, { opacity: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' }); });
  }
  $$('[data-object]').forEach(tilt);

  /* ---------------------------------------------------------------- objects fit their stage
     Page type never scales; an object (a picture of the product) shrinks to fit a narrow stage instead of
     overflowing it. */
  function fitObjects() {
    $$('.scene__mid > .obj').forEach((o) => {
      const mid = o.parentNode, room = mid.clientWidth - 48, w = o.offsetWidth;
      o.style.setProperty('--fit', w && room > 0 ? Math.min(1, room / w).toFixed(3) : 1);
    });
  }
  fitObjects();
  addEventListener('resize', fitObjects);

  /* ---------------------------------------------------------------- statuses tick forward once, then rest */
  const played = new WeakSet();
  function tick(obj) {
    if (!obj || played.has(obj) || R.reduce) return;
    played.add(obj);
    const rows = $$('[data-tick]', obj);
    if (rows.length) gsap.fromTo(rows, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out', delay: 0.15 });
    const live = $('[data-live]', obj);
    if (live) gsap.fromTo(live, { boxShadow: '0 0 0rem rgba(235,148,49,0)' }, { boxShadow: `0 0 ${14 * rem()}px rgba(235,148,49,.75)`, duration: 1.2, delay: 0.15 + rows.length * 0.07, ease: 'power2.out', clearProps: 'boxShadow' });
    $$('[data-count]', obj).forEach((el) => {
      const to = parseFloat(el.dataset.count), o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.4, delay: 0.2, ease: 'expo.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('en-US'); }, onComplete: () => { el.textContent = to.toLocaleString('en-US'); } });
    });
  }

  /* ---------------------------------------------------------------- mask morphs
     clip-path strings can't be tweened reliably (browsers shorten them, so numbers pair up wrong), so the
     shape is a set of numbers we tween and write out ourselves: [top, right, bottom, left] in %, radius in rem. */
  const ROUND = [30, 33, 30, 33, 999], SQUARE = [0, 0, 0, 0, 0];
  // 999 means "fully round": resolve it to half the shape's short side, so the corners straighten evenly through the morph
  const fit = (el, v) => (v[4] < 999 ? v : [...v.slice(0, 4), Math.min(el.offsetWidth * (1 - (v[1] + v[3]) / 100), el.offsetHeight * (1 - (v[0] + v[2]) / 100)) / 2 / rem()]);
  const shape = (v) => `inset(${v[0]}% ${v[1]}% ${v[2]}% ${v[3]}% round ${v[4] * rem()}px)`;
  function clip(el, to, vars = {}) {
    const st = el.__clip || (el.__clip = { v: SQUARE.slice() });
    if (vars.from) { st.v = fit(el, vars.from); el.style.clipPath = shape(st.v); }
    const { from, ...rest } = vars;
    const o = { p: 0 }, a = st.v.slice();
    return gsap.to(o, { p: 1, ...rest, onUpdate: () => { st.v = a.map((x, i) => x + (to[i] - x) * o.p); el.style.clipPath = shape(st.v); },
      onComplete: () => { if (to.every((x) => x === 0)) el.style.clipPath = ''; if (rest.onComplete) rest.onComplete(); } });
  }
  const setClip = (el, v) => { el.__clip = { v: fit(el, v) }; el.style.clipPath = shape(el.__clip.v); };

  /* ---------------------------------------------------------------- entrances */
  function enter(section, now) {
    const stand = $$('[data-stand]', section).filter((el) => !el.closest('.scene'));
    const rise = $$('[data-rise]', section).filter((el) => !el.closest('.scene'));
    const photos = $$('[data-photo]', section).filter((el) => !el.closest('.scene'));
    const objs = $$('[data-object]', section).filter((el) => !el.closest('.scene:not(.is-on)'));
    const words = stand.flatMap((h) => h.__words || (h.__words = R.words(h)));
    if (R.reduce) return () => {};
    if (!words.length && !rise.length && !photos.length && !objs.length && !$('.gl', section)) return () => {};
    if (words.length) gsap.set(words, { ...R.standFrom });
    if (rise.length) gsap.set(rise, { ...R.riseFrom });
    if (photos.length) gsap.set(photos, { autoAlpha: 0, scale: 1.06, filter: 'blur(10px)' });
    if (objs.length) gsap.set(objs, { autoAlpha: 0, y: 24 * rem() });
    const lines = $$('.gl', section);
    if (lines.length) gsap.set(lines, { scaleX: (i, el) => (el.classList.contains('gl--h') ? 0 : 1), scaleY: (i, el) => (el.classList.contains('gl--v') ? 0 : 1) });
    const play = () => {
      const tl = gsap.timeline();
      if (lines.length) tl.to(lines, { scaleX: 1, scaleY: 1, duration: 1.6, ease: 'expo.inOut', stagger: 0.12 }, 0);
      if (photos.length) tl.to(photos, { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'expo.out', stagger: 0.08 }, 0);
      if (words.length) tl.to(words, { ...R.standTo, duration: 1.2, ease: 'expo.out', stagger: 0.04 }, photos.length ? 0.2 : 0);
      if (rise.length) tl.to(rise, { ...R.riseTo, duration: 1.1, ease: 'expo.out', stagger: 0.08 }, words.length ? 0.38 : 0.1);
      if (objs.length) tl.to(objs, { autoAlpha: 1, y: 0, duration: 1.3, ease: 'expo.out', stagger: 0.1, onStart: () => objs.forEach(tick) }, 0.3);
      return tl;
    };
    if (now) return play;
    ST.create({ trigger: section, start: 'top 78%', once: true, onEnter: play });
    return () => {};
  }

  /* exit: content lifts and fades as its section leaves the top (scroll-linked, short and soft) */
  function exit(section) {
    if (R.reduce) return;
    const inner = $('[data-exit]', section) || section.querySelector(':scope > *');
    if (!inner) return;
    gsap.fromTo(inner, { y: 0, autoAlpha: 1 }, {
      y: -32 * rem(), autoAlpha: 0.25, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: section, start: 'bottom 30%', end: 'bottom top', scrub: 0.4 },
    });
  }

  /* ---------------------------------------------------------------- opener: arrives on load, photo drifts as you leave */
  function opener(section) {
    const play0 = enter(section, true);
    const photo = $('.opener__photo[data-morph]', section);
    let play = play0;
    if (photo && !R.reduce) {
      // arrives as a pill in the middle of the strip and opens out to the square frame
      const img = $('.opener__img', photo);
      setClip(photo, ROUND);
      play = () => {
        const tl = play0();
        tl.add(clip(photo, SQUARE, { duration: 1.5, ease: 'expo.inOut' }), 0);
        if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.9, ease: 'expo.out' }, 0);
        // leaving: the frame rounds a little and draws in, the way it arrived
        tl.add(() => {
          const o = { p: 0 };
          gsap.to(o, { p: 1, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.4 },
            onUpdate: () => { const p = o.p; photo.style.clipPath = p ? shape([0, 2 * p, 6 * p, 2 * p, 120 * p]) : ''; } });
        }, 1.6);
        return tl;
      };
    }
    const img = $('.opener__img', section);
    if (img && !R.reduce) gsap.to(img, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.4 } });
    const copy = $('.opener__body', section);
    if (copy && !R.reduce) gsap.fromTo(copy, { y: 0, autoAlpha: 1 }, { y: -32 * rem(), autoAlpha: 0, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: copy, start: 'top 30%', end: 'bottom top', scrub: 0.4 } });
    return play;
  }

  /* ---------------------------------------------------------------- accordion: one item open; the stage crossfades */
  function accordion(acc) {
    const items = $$('.acc__item', acc), scenes = $$('.scene', acc), stage = $('.acc__stage', acc), inner = $('.acc__inner', acc);
    let current = Math.max(0, items.findIndex((i) => i.classList.contains('is-open')));
    const place = () => { // phones: the stage travels with the open item
      if (phone()) items[current].append(stage);
      else if (stage.parentNode !== inner) inner.append(stage);
    };
    let leaveCall = null;
    const showScene = (i, animate) => {
      const prev = scenes.find((s) => s.classList.contains('is-on'));
      scenes.forEach((s, j) => { s.classList.toggle('is-on', j === i); s.classList.remove('is-leaving'); s.style.zIndex = j === i ? 2 : 0; });
      const s = scenes[i], obj = $('[data-object]', s), top = $('.scene__top', s), bg = $('.scene__img', s) || s;
      if (!animate || R.reduce) { tick(obj); return; }
      // the outgoing scene stays underneath until the new one has faded in over it
      if (prev && prev !== s) {
        prev.classList.add('is-leaving'); prev.style.zIndex = 1;
        if (leaveCall) leaveCall.kill();
        leaveCall = gsap.delayedCall(stage.hasAttribute('data-morph') ? 1.15 : 0.9, () => prev.classList.remove('is-leaving'));
      }
      if (stage.hasAttribute('data-morph')) {
        // the new scene grows out of a circle over the last one, then squares off at the frame
        gsap.set([s, bg], { opacity: 1 });
        if (s.__clipTw) s.__clipTw.kill();
        s.__clipTw = clip(s, SQUARE, { from: [34, 30, 34, 30, 999], duration: 1.1, ease: 'expo.inOut' });
        if (bg !== s) gsap.fromTo(bg, { scale: 1.12 }, { scale: 1, duration: 1.4, ease: 'expo.out', overwrite: true });
      } else {
        if (bg !== s) gsap.set(s, { opacity: 1 });
        gsap.fromTo(bg, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
      }
      if (top) gsap.fromTo(top, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.1, ease: 'expo.out', overwrite: true });
      if (obj) gsap.fromTo(obj, { opacity: 0, y: 24 * rem() }, { opacity: 1, y: 0, duration: 1.0, delay: 0.12, ease: 'expo.out', overwrite: 'auto', onStart: () => tick(obj) });
    };
    const open = (i) => {
      if (i === current) return;
      const state = window.Flip && !R.reduce ? window.Flip.getState(items.map((it) => $('.acc__head', it)).concat(items)) : null;
      items[current].classList.remove('is-open'); $('.acc__head', items[current]).setAttribute('aria-expanded', 'false');
      items[i].classList.add('is-open'); $('.acc__head', items[i]).setAttribute('aria-expanded', 'true');
      current = i; place();
      if (state) {
        window.Flip.from(state, { duration: 0.75, ease: 'expo.out', simple: true });
        gsap.fromTo($$('.acc__body > *', items[i]), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, delay: 0.12, ease: 'expo.out' });
      }
      fitObjects();
      showScene(i, true);
      if (phone() && R.lenis) R.lenis.scrollTo(items[i], { offset: -60, duration: 1.1 });
      ST.refresh();
    };
    items.forEach((it, i) => $('.acc__head', it).addEventListener('click', () => open(i)));
    place(); showScene(current, false);
    let wasPhone = phone();
    addEventListener('resize', () => { if (phone() !== wasPhone) { wasPhone = phone(); place(); } });
    // the first object ticks when the module comes into view
    ST.create({ trigger: acc, start: 'top 60%', once: true, onEnter: () => tick($('[data-object]', scenes[current])) });
  }

  /* ---------------------------------------------------------------- questions */
  function faq(list) {
    $$('.faq__item', list).forEach((it) => {
      const q = $('.faq__q', it), a = $('.faq__a', it);
      q.setAttribute('aria-expanded', String(it.classList.contains('is-open')));
      q.addEventListener('click', () => {
        const opening = !it.classList.contains('is-open');
        it.classList.toggle('is-open', opening); q.setAttribute('aria-expanded', String(opening));
        if (R.reduce) { ST.refresh(); return; }
        if (opening) {
          gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.7, ease: 'expo.out', onComplete: () => ST.refresh() });
          gsap.fromTo(a.firstElementChild, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.08, ease: 'expo.out' });
        } else {
          gsap.fromTo(a, { height: a.offsetHeight }, { height: 0, duration: 0.5, ease: 'power3.out', onComplete: () => { a.style.height = ''; ST.refresh(); } });
        }
      });
    });
  }

  /* ---------------------------------------------------------------- close doors: pill → square on entry, round on hover */
  function morphDoors() {
    if (!document.body.hasAttribute('data-morph-doors') || R.reduce) return;
    $$('.close .cdoor').forEach((d, i) => {
      let ready = false;
      setClip(d, [10, 14, 10, 14, 999]);
      ST.create({ trigger: d, start: 'top 88%', once: true, onEnter: () => clip(d, SQUARE, { duration: 1.4, delay: i * 0.1, ease: 'expo.inOut', onComplete: () => { ready = true; } }) });
      if (!R.fine) return;
      let hov = null;
      d.addEventListener('pointerenter', () => { if (!ready) return; if (hov) hov.kill(); hov = clip(d, [0, 0, 0, 0, 40], { duration: 0.7, ease: 'expo.out' }); });
      d.addEventListener('pointerleave', () => { if (!ready) return; if (hov) hov.kill(); hov = clip(d, SQUARE, { duration: 0.6, ease: 'expo.out' }); });
    });
  }

  /* ---------------------------------------------------------------- page exit: the page lifts and fades before the next one loads */
  const veil = document.createElement('div'); veil.className = 'veil'; veil.setAttribute('aria-hidden', 'true'); document.body.append(veil);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    if (a.hasAttribute('data-soon')) { e.preventDefault(); return; }
    const url = new URL(a.href, location.href);
    if (a.target || e.metaKey || e.ctrlKey || e.shiftKey || url.origin !== location.origin || (url.pathname === location.pathname && url.hash)) return;
    e.preventDefault();
    if (R.reduce) { location.href = url.href; return; }
    gsap.to($('main'), { y: -16 * rem(), duration: 0.45, ease: 'power2.in' });
    gsap.to(veil, { opacity: 1, duration: 0.42, ease: 'power1.in', onComplete: () => { location.href = url.href; } });
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { gsap.set(veil, { opacity: 0 }); gsap.set($('main'), { y: 0 }); } });

  /* ---------------------------------------------------------------- home's shared sections (the close)
     home/sections/s9.js registers itself on window.RovnHomeSections; run it with the same helper kit and
     breakpoint handling home.js gives it, so the close behaves exactly as on home. */
  function homeSections() {
    const sections = window.RovnHomeSections || [];
    if (!sections.length) return;
    const K = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--k')) || 1;
    const split = (els) => { const list = [].concat(els).filter(Boolean); return list.length ? R.words(list) : []; };
    const riseOnEnter = (targets, trigger, start = 'top 80%', delay = 0.25) => {
      if (R.reduce) return;
      gsap.set(targets, { ...R.riseFrom });
      ST.create({ trigger, start, once: true, onEnter: () => R.rise(targets, { delay }) });
    };
    const H = { gsap, ST, R, $, $$, K, split, riseOnEnter };
    gsap.matchMedia().add({ desk: '(min-width: 768px)', phone: '(max-width: 767px)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      const { desk, reduce } = ctx.conditions;
      sections.forEach((sec) => {
        try { if (reduce) { if (sec.reduce) sec.reduce(desk, H); } else sec.init(desk, H); }
        catch (err) { console.error('[sub] section ' + sec.name, err); }
      });
    });
  }

  /* ---------------------------------------------------------------- boot */
  R.ready(() => {
    const sections = $$('main > section');
    let first = null;
    sections.forEach((s, i) => {
      if (i === 0 && s.classList.contains('opener')) first = opener(s);
      else { enter(s, false); if (s.hasAttribute('data-exit-section')) exit(s); }
    });
    $$('.acc').forEach(accordion);
    homeSections();
    morphDoors();
    $$('.faq__list').forEach(faq);

    if (R.reduce) { R.loaded(); return; }
    gsap.set(nav, { yPercent: -102 });
    R.loaded();
    const tl = gsap.timeline();
    if (first) tl.add(first(), 0);
    tl.to(nav, { yPercent: 0, duration: 1.0, ease: 'expo.out' }, 0.35);
    R.progress();
  });
})();
