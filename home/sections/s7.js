/* Rōvn home · 7 · "You decide who sees what." (Working Board 2: 7a/7b, phone 7a/7b)
   - 7a: Renée's permissions for Quarrystone. The switches set themselves in sequence as the sheet arrives:
     the knob springs across (stretching as it travels) and the ink fill eases in behind it; Download stays off.
     Hovering a switch answers at once (the knob leans the way it would travel); clicking toggles it.
   - 7a → 7b (scrubbed): the white sheet's frame becomes the dark receipt's frame (size, radius, fill and shadow
     morph as one object). The sheet's rows shrink with the frame and fade, so nothing is ever cut by an edge;
     the receipt's content fades in once the frame is dark. Then the "used" log slides out from under the
     receipt like section 3's drawer, and the receipt rises to make room.
   - The pill's sub rolls "Choosing what they see" → "Shared with Quarrystone" and the pill eases to the new width.
   Phones follow the 390×844 frames: the headline block on top, the amber panel below. */
(function () {
  function parts(H) {
    const { $, $$ } = H;
    const sec = $('.s7'); if (!sec) return null;
    return {
      sec, pin: $('.s7__pin', sec), img: $('.s7__panel .panel__img', sec),
      pill: $('.s7__pill', sec), roll: $('.s7__roll', sec),
      object: $('.s7__object', sec), morph: $('.s7__morph', sec), dark: $('.s7__dark', sec), sheet: $('.s7__sheet', sec), card: $('.s7__card', sec),
      logwrap: $('.s7__logwrap', sec), log: $('.s7__log', sec), switches: $$('.s7__switch', sec),
      title: $('.s7__title', sec), sub: $('.s7__sub', sec), subLines: $$('.s7__sub .ln', sec), eyebrow: $('.s7__eyebrow', sec),
    };
  }

  // the pill's sub: lines share a grid cell inside a feathered mask; the box eases to the incoming line's width
  function subRoller(gsap, el) {
    const lines = Array.from(el.querySelectorAll('.rl'));
    let cur = 0;
    gsap.set(lines, { yPercent: (i) => (i ? 110 : 0), autoAlpha: (i) => (i ? 0 : 1) });
    const fit = () => gsap.set(el, { width: lines[cur].offsetWidth });
    fit();
    const to = (i, instant) => {
      if (i === cur) return;
      const dir = i > cur ? 1 : -1, a = lines[cur], b = lines[i];
      cur = i;
      lines.forEach((l, j) => l.setAttribute('aria-hidden', j === i ? 'false' : 'true'));
      if (instant) { gsap.set(lines, { yPercent: (j) => (j === i ? 0 : 110), autoAlpha: (j) => (j === i ? 1 : 0), filter: 'none' }); fit(); return; }
      gsap.to(el, { width: b.offsetWidth, duration: 0.7, ease: 'expo.out', overwrite: true });
      gsap.to(a, { yPercent: -110 * dir, autoAlpha: 0, filter: 'blur(2px)', duration: 0.5, ease: 'expo.out', overwrite: true });
      gsap.fromTo(b, { yPercent: 110 * dir, autoAlpha: 0, filter: 'blur(2px)' }, { yPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out', overwrite: true });
    };
    return { to, fit };
  }

  // switches: knob x and width, ink fill opacity and growth, track tint
  function switches(H, P) {
    const { gsap, K, R } = H;
    return P.switches.map((btn) => {
      const knob = btn.querySelector('.s7__knob'), fill = btn.querySelector('.s7__fill');
      const c = { btn, on: false, hover: false };
      const pose = () => { const w = c.hover ? 24 : 20; return { x: (c.on ? 36 - w : 0) * K(), width: w * K() }; }; // leans toward its travel
      c.render = (mode) => {
        btn.setAttribute('aria-checked', String(c.on));
        const p = pose(), fillTo = { opacity: c.on ? 1 : 0, scaleX: c.on ? 1 : 0.62 };
        const track = c.on || !c.hover ? 'rgba(15, 15, 15, 0.1)' : 'rgba(15, 15, 15, 0.16)';
        if (mode === 'set') { gsap.set(knob, p); gsap.set(fill, fillTo); gsap.set(btn, { backgroundColor: track }); return; }
        if (mode === 'spring') {
          // a spring with one soft overshoot; the knob stretches while it travels, the ink flows in behind it
          gsap.to(knob, { x: p.x, duration: 0.62, ease: 'back.out(2.1)', overwrite: 'auto' });
          gsap.timeline().to(knob, { width: p.width + 7 * K(), duration: 0.14, ease: 'power2.out' }).to(knob, { width: p.width, duration: 0.42, ease: 'back.out(2)' });
          gsap.to(fill, { ...fillTo, duration: c.on ? 0.55 : 0.3, ease: c.on ? 'power3.out' : 'power2.out', overwrite: 'auto' });
          gsap.to(btn, { backgroundColor: track, duration: 0.2, overwrite: 'auto' });
          return;
        }
        gsap.to(knob, { ...p, duration: 0.16, ease: 'power2.out', overwrite: 'auto' }); // hover: answers at once
        gsap.to(btn, { backgroundColor: track, duration: 0.16, ease: 'power2.out', overwrite: 'auto' });
      };
      if (!btn.__wired) {
        btn.__wired = true;
        if (R.fine && !R.reduce) {
          btn.addEventListener('pointerenter', () => { c.hover = true; c.render('hover'); });
          btn.addEventListener('pointerleave', () => { c.hover = false; c.render('hover'); });
        }
        btn.addEventListener('click', () => { c.on = !c.on; c.render(R.reduce ? 'set' : 'spring'); });
        btn.__ctl = c;
      }
      return btn.__ctl;
    });
  }

  // hover tilt for the receipt (home.js's tilt, but only once the sheet has become the receipt)
  function tiltWhen(H, el, ok) {
    const { gsap, R } = H;
    if (!R.fine || R.reduce || el.__tilt) return;
    el.__tilt = true;
    const g = document.createElement('span'); g.className = 'card__glare'; el.append(g);
    gsap.set(el.parentNode, { transformPerspective: 900 });
    const rx = gsap.quickTo(el.parentNode, 'rotationX', { duration: 0.7, ease: 'power3' });
    const ry = gsap.quickTo(el.parentNode, 'rotationY', { duration: 0.7, ease: 'power3' });
    const gx = gsap.quickTo(g, 'xPercent', { duration: 0.5, ease: 'power3' }), gy = gsap.quickTo(g, 'yPercent', { duration: 0.5, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      if (!ok()) { rx(0); ry(0); gsap.to(g, { opacity: 0, duration: 0.3, overwrite: 'auto' }); return; }
      const r = el.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      ry(u * 10); rx(-v * 10); gx(u * 60); gy(v * 60);
      gsap.to(g, { opacity: 1, duration: 0.35, overwrite: 'auto' });
    });
    el.addEventListener('pointerleave', () => { rx(0); ry(0); gsap.to(g, { opacity: 0, duration: 0.6, overwrite: 'auto' }); });
  }

  function init(desk, H) {
    const { gsap, ST, K, pillIn, standOnEnter, riseOnEnter, split } = H;
    const P = parts(H); if (!P) return;

    /* ---------- arrival ---------- */
    standOnEnter(split(P.title), P.title, 'top 85%');
    if (desk) riseOnEnter([P.eyebrow], P.eyebrow, 'top 92%', 0.1);
    riseOnEnter(P.subLines, P.sub, 'top 92%', 0.3);
    const sub = subRoller(gsap, P.roll);
    ST.addEventListener('refresh', sub.fit);
    const pi = pillIn(P.pill);
    ST.create({ trigger: P.pill, start: 'top 88%', once: true, onEnter: () => pi.play() });
    // the sheet arrives like a stack does: from below, standing up from a tilt
    gsap.set(P.object, { autoAlpha: 0, y: 70 * K(), rotationX: 24, transformPerspective: 1400, transformOrigin: '50% 100%' });
    ST.create({ trigger: P.object, start: 'top 92%', once: true, onEnter: () => gsap.to(P.object, { autoAlpha: 1, y: 0, rotationX: 0, duration: 1.0, ease: 'expo.out' }) });
    gsap.fromTo(P.img, { yPercent: 2.5, scale: 1.06 }, { yPercent: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: P.pin, start: 'top bottom', end: 'top top', scrub: true } });

    /* ---------- 7a: the switches set themselves (and set again if you come back to it) ---------- */
    const ctl = switches(H, P);
    let seq = null;
    const reset = () => { if (seq) seq.kill(); ctl.forEach((c) => { c.on = false; c.render('set'); }); };
    const play = () => {
      reset();
      seq = gsap.timeline({ delay: 0.5 })
        .add(() => { ctl[0].on = true; ctl[0].render('spring'); }, 0)
        .add(() => { ctl[1].on = true; ctl[1].render('spring'); }, 0.4); // Download a copy stays off
    };
    reset();
    ST.create({ trigger: P.pin, start: 'top 6%', onEnter: play, onLeaveBack: reset });

    /* ---------- 7a → 7b: the sheet becomes the receipt, then the log slides out from under it ---------- */
    let rolled = 0, receipt = false;
    const sync = (self) => {
      const p = self.progress;
      if (!rolled && p >= 0.24) { rolled = 1; sub.to(1); } else if (rolled && p < 0.2) { rolled = 0; sub.to(0); }
      receipt = p >= 0.4;
    };
    tiltWhen(H, P.morph, () => receipt);

    const shadow = (a, b, c, d, e, f) => () => { const k = K(); return `0px ${a * k}px ${b * k}px 0px rgba(40, 25, 10, ${c}), 0px ${d * k}px ${e * k}px 0px rgba(40, 25, 10, ${f})`; };
    const SHEET = shadow(1, 2, 0.08, 18, 44, 0.16), RECEIPT = shadow(1, 2, 0.12, 16, 38, 0.22);
    const sw = () => P.sheet.offsetWidth, sh = () => P.sheet.offsetHeight;
    const fitScale = () => Math.min((340 * K()) / sw(), (214 * K()) / sh());

    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: P.pin, start: 'top top', end: () => '+=' + innerHeight * 1.7, pin: P.pin, scrub: 0.35, invalidateOnRefresh: true, onUpdate: sync, onRefresh: sync } });
    tl.to({}, { duration: 1 }, 0); // 0–.14 rests on 7a, .64–1 on 7b
    const m = 0.14, M = 0.22, d = m + M + 0.04;
    tl.fromTo(P.morph, { width: sw, height: sh, borderRadius: () => 20 * K(), boxShadow: SHEET },
      { width: () => 340 * K(), height: () => 214 * K(), borderRadius: () => 18 * K(), boxShadow: RECEIPT, duration: M, ease: 'power2.inOut', immediateRender: true }, m)
      // the rows shrink with the frame (so no edge ever cuts them) and fade out early
      .fromTo(P.sheet, { scale: 1 }, { scale: fitScale, duration: M, ease: 'power2.inOut', immediateRender: true }, m)
      .fromTo(P.sheet, { autoAlpha: 1, filter: 'blur(0px)' }, { autoAlpha: 0, filter: 'blur(3px)', duration: 0.08, ease: 'power1.in', immediateRender: true }, m + 0.02)
      // the receipt's dark face floods up through the white, and its content crossfades in over the sheet's
      .fromTo(P.dark, { '--fl': 0 }, { '--fl': 1, duration: 0.15, ease: 'power1.inOut', immediateRender: true }, m + 0.02)
      .fromTo(P.card, { autoAlpha: 0, filter: 'blur(3px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: 0.1, ease: 'power1.out', immediateRender: true }, m + 0.11)
      // the drawer: the log slides out from under the receipt, which rises (and tips back a touch) to make room
      .fromTo(P.logwrap, { height: 0 }, { height: () => P.log.offsetHeight, duration: 0.24, ease: 'power2.inOut', immediateRender: true }, d)
      .fromTo(P.log, { y: () => -(P.log.offsetHeight + 18 * K()) }, { y: 0, duration: 0.24, ease: 'power2.inOut', immediateRender: true }, d)
      .fromTo(P.morph, { rotationX: 0, transformPerspective: 1200 }, { rotationX: 6, duration: 0.1, ease: 'power1.out', immediateRender: true }, d)
      .to(P.morph, { rotationX: 0, duration: 0.14, ease: 'power2.out' }, d + 0.1);
  }

  // reduced motion: 7b, unpinned (the CSS sets the frame; this rolls the pill and settles the switches)
  function reduce(desk, H) {
    const { gsap, ST } = H;
    const P = parts(H); if (!P) return;
    const sub = subRoller(gsap, P.roll);
    sub.to(1, true);
    ST.addEventListener('refresh', sub.fit);
    switches(H, P).forEach((c, i) => { c.on = i < 2; c.render('set'); });
  }

  (window.RovnHomeSections = window.RovnHomeSections || []).push({ name: 'trust', init, reduce });
})();
