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
     [data-morph-in] an image or panel that arrives as a pill and opens to its rounded frame (radius = value, default 20)
     .gl            gridlines: hairlines that draw themselves in when their section enters; .gl--v[data-x] sits on a
                    column's edge, .gl--h[data-y] under a block
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
      o.style.setProperty('--fit', 1);
      const mid = o.parentNode, room = mid.clientWidth - 48, w = o.offsetWidth;
      o.style.setProperty('--fit', w && room > 0 ? Math.min(1, room / w).toFixed(3) : 1);
    });
  }
  fitObjects();
  addEventListener('resize', fitObjects);

  /* ---------------------------------------------------------------- gridlines: vertical lines follow their column */
  // layout position inside the section (offsets ignore transforms, so motion never moves a line)
  const offsetIn = (el, sec) => { let x = 0, y = 0; while (el && el !== sec) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; } return { x, y }; };
  function placeLines() {
    $$('.gl--v[data-x]').forEach((l) => {
      const sec = l.parentNode, col = $(l.dataset.x, sec);
      if (!col) return;
      l.style.left = `${offsetIn(col, sec).x + (parseFloat(l.dataset.dx) || 0) * rem()}px`;
      const from = l.dataset.from && $(l.dataset.from, sec);
      l.style.top = from ? `${offsetIn(from, sec).y + from.offsetHeight}px` : '0px';
      l.style.bottom = '0px';
    });
    // horizontal lines that mark the bottom of a block (data-y), screen edge to screen edge
    $$('.gl--h[data-y]').forEach((l) => {
      const sec = l.parentNode, el = $(l.dataset.y, sec);
      if (el) l.style.top = `${offsetIn(el, sec).y + el.offsetHeight + (parseFloat(l.dataset.dy) || 0) * rem()}px`;
      const after = l.dataset.after && $(l.dataset.after, sec), before = l.dataset.before && $(l.dataset.before, sec);
      if (after) { l.style.left = `${offsetIn(after, sec).x + after.offsetWidth}px`; l.style.right = '0px'; }   // from its right edge to the screen edge
      if (before) { l.style.left = '0px'; l.style.right = `${sec.offsetWidth - offsetIn(before, sec).x}px`; } // from the screen edge to its left edge
    });
  }
  placeLines();
  addEventListener('resize', placeLines);
  if (document.fonts) document.fonts.ready.then(placeLines);

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
    if (!words.length && !rise.length && !photos.length && !objs.length && !$('.gl', section) && !$('[data-morph-in]', section)) return () => {};
    if (words.length) gsap.set(words, { ...R.standFrom });
    if (rise.length) gsap.set(rise, { ...R.riseFrom });
    if (photos.length) gsap.set(photos, { autoAlpha: 0, scale: 1.06, filter: 'blur(10px)' });
    if (objs.length) gsap.set(objs, { autoAlpha: 0, y: 24 * rem() });
    const morphs = $$('[data-morph-in]', section);
    if (morphs.length) morphs.forEach((m) => setClip(m, [16, 22, 16, 22, 999]));
    const lines = $$('.gl', section);
    if (lines.length) gsap.set(lines, { scaleX: (i, el) => (el.classList.contains('gl--h') ? 0 : 1), scaleY: (i, el) => (el.classList.contains('gl--v') ? 0 : 1) });
    const play = () => {
      const tl = gsap.timeline();
      if (lines.length) tl.to(lines, { scaleX: 1, scaleY: 1, duration: 1.6, ease: 'expo.inOut', stagger: 0.12 }, 0);
      morphs.forEach((m, i) => tl.add(clip(m, [0, 0, 0, 0, parseFloat(m.dataset.morphIn) || 20], { duration: 1.4, ease: 'expo.inOut' }), 0.05 + i * 0.1));
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
            onUpdate: () => { const p = o.p, r = 120 * p * rem(); photo.style.clipPath = p ? `inset(0% ${2 * p}% 0% ${2 * p}% round ${r}px ${r}px 0px 0px)` : ''; } });
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

  /* ---------------------------------------------------------------- no jumps: keep what you clicked where it was
     When something opens or closes, content above the click can change height and shove the page. For the
     length of the motion, the page scroll follows the clicked element so it stays put under the pointer;
     ScrollTrigger re-measures once at the end, from the settled layout. */
  function keepInPlace(el, dur = 0.8) {
    const y0 = el.getBoundingClientRect().top;
    const fix = () => {
      const d = el.getBoundingClientRect().top - y0;
      if (Math.abs(d) < 0.5) return;
      if (R.lenis) R.lenis.scrollTo(R.lenis.scroll + d, { immediate: true, force: true });
      else window.scrollBy(0, d);
    };
    gsap.ticker.add(fix);
    gsap.delayedCall(dur, () => { gsap.ticker.remove(fix); fix(); ST.refresh(); });
  }

  /* ---------------------------------------------------------------- accordion: one item open; the stage crossfades */
  function accordion(acc) {
    const items = $$('.acc__item', acc), scenes = $$('.scene', acc), stage = $('.acc__stage', acc), inner = $('.acc__inner', acc);
    let current = Math.max(0, items.findIndex((i) => i.classList.contains('is-open')));
    // phones: each step carries its own panel (a copy of its scene) inside its body, and steps open and close
    // like the questions — heights only, no travelling stage, no layout jump
    items.forEach((it, i) => {
      const body = $('.acc__body', it); if (!body || $('.acc__bodyin', body)) return;
      const bin = document.createElement('div'); bin.className = 'acc__bodyin';
      while (body.firstChild) bin.append(body.firstChild);
      body.append(bin);
      if (!scenes[i]) return;
      const panel = document.createElement('div'); panel.className = 'acc__panel';
      if (scenes[i].querySelector('.scene__img') == null && !/scene--/.test(scenes[i].className)) panel.classList.add('acc__panel--tone');
      const sc = scenes[i].cloneNode(true); sc.classList.add('is-on'); sc.classList.remove('is-leaving'); sc.style.cssText = '';
      sc.querySelectorAll('[data-morph-in],[data-photo]').forEach((e) => { e.removeAttribute('data-morph-in'); e.removeAttribute('data-photo'); });
      sc.querySelectorAll('[data-object],[data-tick],.scene__top').forEach((e) => gsap.set(e, { clearProps: 'all' }));
      panel.append(sc); bin.append(panel);
    });
    const place = () => {};
    let leaveCall = null;
    const showScene = (i, animate, from) => {
      const prev = scenes.find((s) => s.classList.contains('is-on'));
      scenes.forEach((s, j) => { s.classList.toggle('is-on', j === i); s.classList.remove('is-leaving'); s.style.zIndex = j === i ? 2 : 0; });
      const s = scenes[i], obj = $('[data-object]', s), top = $('.scene__top', s), bg = $('.scene__img', s) || s;
      if (!animate || R.reduce) { tick(obj); return; }
      // the outgoing scene stays underneath until the new one has faded in over it
      if (prev && prev !== s) {
        prev.classList.add('is-leaving'); prev.style.zIndex = 1;
        if (leaveCall) leaveCall.kill();
        leaveCall = gsap.delayedCall(stage.hasAttribute('data-morph') ? 0.8 : 0.9, () => prev.classList.remove('is-leaving'));
      }
      if (stage.hasAttribute('data-morph')) {
        // the new scene grows out of the step you clicked: a small pill on the panel's edge, level with that
        // step, swells to fill the panel and settles at its rounded corners; it fades up over the first third
        // so it never pops, and the scene underneath sinks back a little as it's covered
        const sr = stage.getBoundingClientRect(), H = sr.height || 1;
        let y = 50;
        if (from && !phone()) { const r = from.getBoundingClientRect(); y = Math.max(8, Math.min(92, ((r.top + r.height / 2 - sr.top) / H) * 100)); }
        const h = 7, startShape = phone() ? [0, 40, 92, 40, 999] : [y - h / 2, 88, 100 - y - h / 2, 0, 999];
        gsap.set(bg, { opacity: 1 });
        if (s.__clipTw) s.__clipTw.kill();
        s.__clipTw = clip(s, [0, 0, 0, 0, 20], { from: startShape, duration: 0.75, ease: 'expo.out' });
        gsap.fromTo(s, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power1.out', overwrite: 'auto' });
        // a scene on the same field as the last (tone after tone) would grow invisibly: it starts a shade deeper
        // and lightens as it lands, and the old card steps back, so the change always reads
        const field = (el) => el.className.replace(/\bis-(on|leaving)\b/g, '').trim();
        if (prev && bg === s && field(prev) === field(s)) gsap.fromTo(s, { filter: 'brightness(0.9)' }, { filter: 'brightness(1)', duration: 0.9, ease: 'power2.out', clearProps: 'filter' });
        const po = prev && prev !== s && $('[data-object]', prev);
        if (po) gsap.fromTo(po, { opacity: 1, y: 0 }, { opacity: 0, y: -10 * rem(), duration: 0.3, ease: 'power2.in', onComplete: () => gsap.set(po, { opacity: 1, y: 0 }) });
        if (bg !== s) gsap.fromTo(bg, { scale: 1.12 }, { scale: 1, duration: 0.95, ease: 'expo.out', overwrite: true });
        if (prev && prev !== s) {
          const pb = $('.scene__img', prev) || prev;
          gsap.fromTo(pb, { scale: 1 }, { scale: 0.96, duration: 0.75, ease: 'expo.out', onComplete: () => gsap.set(pb, { scale: 1 }) });
        }
      } else {
        if (bg !== s) gsap.set(s, { opacity: 1 });
        gsap.fromTo(bg, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'expo.out', overwrite: true });
      }
      if (top) gsap.fromTo(top, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.7, delay: 0.1, ease: 'expo.out', overwrite: true });
      if (obj) gsap.fromTo(obj, { opacity: 0, y: 24 * rem() }, { opacity: 1, y: 0, duration: 0.8, delay: 0.1, ease: 'expo.out', overwrite: 'auto', onStart: () => tick(obj) });
    };
    const openPhone = (i) => {
      const was = items[current], now = items[i];
      // when the step closing is above the one you tapped, everything shifts up by its height; if that would carry
      // the tapped step off the top, the page follows it in the same 0.6s ease, landing it just under the nav
      const head = $('.acc__head', now), closing = $('.acc__body', was);
      const lift = current < i ? closing.scrollHeight : 0, endTop = head.getBoundingClientRect().top - lift;
      if (!R.reduce && endTop < 64) {
        // the tapped step glides along one smooth path to 64px from the top; the scroll is set each frame to keep it on it
        const y0 = head.getBoundingClientRect().top, t0 = performance.now(), ease = gsap.parseEase('power3.inOut');
        const follow = () => {
          const t = (performance.now() - t0) / 1000, p = ease(Math.min(1, t / 0.6));
          const d = head.getBoundingClientRect().top - (y0 + (64 - y0) * p);
          if (Math.abs(d) >= 0.5) { if (R.lenis) R.lenis.scrollTo(R.lenis.scroll + d, { immediate: true, force: true }); else window.scrollBy(0, d); }
          if (t > 1.0) gsap.ticker.remove(follow); // holds at 64 a little past the motion, while the layout settles
        };
        gsap.ticker.add(follow);
      }
      was.classList.remove('is-open'); $('.acc__head', was).setAttribute('aria-expanded', 'false');
      now.classList.add('is-open'); $('.acc__head', now).setAttribute('aria-expanded', 'true');
      current = i;
      if (R.reduce) { ST.refresh(); return; }
      const wb = $('.acc__body', was), nb = $('.acc__body', now);
      gsap.fromTo(wb, { height: wb.scrollHeight }, { height: 0, duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: () => { wb.style.height = ''; } });
      gsap.fromTo(nb, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: () => { nb.style.height = ''; ST.refresh(); } });
      const kids = $$('.acc__bodyin > *', now);
      gsap.fromTo(kids, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, delay: 0.12, ease: 'expo.out', clearProps: 'transform,opacity,visibility' });
      fitObjects();
      tick($('.acc__panel [data-object]', now));
    };
    const open = (i) => {
      if (i === current) return;
      if (phone()) return openPhone(i);
      const state = window.Flip && !R.reduce ? window.Flip.getState(items.map((it) => $('.acc__head', it)).concat(items)) : null;
      items[current].classList.remove('is-open'); $('.acc__head', items[current]).setAttribute('aria-expanded', 'false');
      items[i].classList.add('is-open'); $('.acc__head', items[i]).setAttribute('aria-expanded', 'true');
      current = i; place();
      if (state) {
        window.Flip.from(state, { duration: 0.75, ease: 'expo.out', simple: true });
        gsap.fromTo($$('.acc__bodyin > :not(.acc__panel)', items[i]), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06, delay: 0.12, ease: 'expo.out' });
      }
      fitObjects();
      showScene(i, true, $('.acc__head', items[i]));
    };
    items.forEach((it, i) => $('.acc__head', it).addEventListener('click', () => open(i)));
    place(); showScene(current, false);
    // on phones the open step's panel ticks in when the section is reached
    // the first object ticks when the module comes into view
    ST.create({ trigger: acc, start: 'top 60%', once: true, onEnter: () => tick(phone() ? $('.acc__panel [data-object]', items[current]) : $('[data-object]', scenes[current])) });
  }

  /* ---------------------------------------------------------------- questions */
  // one answer open at a time: opening a question closes the one that was open
  function faq(list) {
    const items = $$('.faq__item', list);
    const set = (it, open) => {
      const q = $('.faq__q', it), a = $('.faq__a', it);
      if (it.classList.contains('is-open') === open) return;
      it.classList.toggle('is-open', open); q.setAttribute('aria-expanded', String(open));
      if (R.reduce) return;
      if (open) {
        gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: () => ST.refresh() });
        gsap.fromTo(a.firstElementChild, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.7, delay: 0.08, ease: 'expo.out' });
      } else {
        gsap.fromTo(a, { height: a.offsetHeight }, { height: 0, duration: 0.6, ease: 'power3.inOut', overwrite: true, onComplete: () => { a.style.height = ''; } });
      }
    };
    items.forEach((it) => {
      const q = $('.faq__q', it);
      q.setAttribute('aria-expanded', String(it.classList.contains('is-open')));
      q.addEventListener('click', () => {
        const opening = !it.classList.contains('is-open');
        items.forEach((o) => { if (o !== it) set(o, false); });
        set(it, opening);
        if (R.reduce) ST.refresh();
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
    if (url.origin === location.origin && url.pathname === location.pathname && url.hash) {
      const t = document.getElementById(url.hash.slice(1)); if (!t) return;
      e.preventDefault();
      const head = t.classList.contains('acc__item') && $('.acc__head', t);
      const sec = head ? t.closest('section') : t;
      R.scrollTo(sec.getBoundingClientRect().top + R.scrollY() - (head ? 0 : 48));
      if (head && !t.classList.contains('is-open')) gsap.delayedCall(0.5, () => head.click());
      return;
    }
    if (a.target || e.metaKey || e.ctrlKey || e.shiftKey || url.origin !== location.origin) return;
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
    // modules with their own behaviour (sub/modules/*.js) register here: { name, init(K) }
    const K = { gsap, ST, R, $, $$, rem, phone, keepInPlace, tick, tilt };
    (window.RovnSubModules || []).forEach((m) => { try { m.init(K); } catch (err) { console.error('[sub] module ' + m.name, err); } });
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
