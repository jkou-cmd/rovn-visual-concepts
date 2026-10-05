/* Rōvn home · 6 · "Your career is bigger than one job." (Working Board 2: 6a/6b/6c, phone 6a/6b/6c)
   Three applications, one record.
   - Each hospital is a frame. The next one waits as a tile at the bottom right, grows into the main panel over
     the current one (which darkens a touch as it goes under), and the current one slides out from under it and
     shrinks to a tile at the top left. Tiles move one slot along the same up-left diagonal; the image keeps the
     panel's scale, so a tile is a window onto it and the image drifts at about half the speed of the moving edge.
   - The pill and Renée's stack stay put on top. Per hospital the stack re-deals: cards that stay keep their place
     and close ranks; cards that leave slide out sideways from behind the cards in front (plain stacking order
     hides them until they clear) and carry on out of frame; arriving cards slide back in behind the front cards,
     back to front. Cards are opaque throughout and nothing glows.
   - The pill's name rolls Hospital 1 → 2 → 3 as each new panel reaches it. At 6c the page turns dark (a fired
     tween with hysteresis), which carries into section 7.
   Phones follow the 390×844 frames: one hospital per beat, the previous one a 20px sliver at the top (it tucks
   under the headline block when it leaves), the next one a 20px peek at the bottom. */
(function () {
  const ORDER = ['share', 'emp', 'fnp', 'bls', 'dea', 'rn', 'aprn', 'identity']; // stacking order, front last
  const SETS = [ORDER, ['share', 'bls', 'dea', 'rn', 'identity'], ['share', 'fnp', 'bls', 'dea', 'rn', 'identity']];
  // a card's offset from the top of the 8-card stack box, as a percentage of its own height (214): the cascade is
  // re-centred per hospital. (GSAP folds a CSS translate into its own transform, so this rides on yPercent.)
  const dy = (h, key) => ((19 * (ORDER.length - SETS[h].length) + 38 * SETS[h].indexOf(key)) / 214) * 100;
  const LEAVE_A = ['aprn', 'fnp', 'emp']; // 6a → 6b, front to back (so scrolling back deals them in back to front)

  const state = { p: 0, busy: false, hosp: 0, wired: false };
  const blurred = new WeakSet();

  function parts(H) {
    const { $, $$ } = H;
    const sec = $('.s6'); if (!sec) return null;
    const frames = [1, 2, 3].map((h) => $(`.s6__frame[data-h="${h}"]`, sec));
    const stack = $('.s6__stack', sec);
    const flys = $$('.fly', stack);
    return {
      sec, pin: $('.s6__pin', sec), stage: $('.s6__stage', sec), deck: $('.s6__deck', sec), frames,
      imgs: frames.map((f) => $('.panel__img', f)), shades: frames.map((f) => $('.s6__shade', f)),
      stack, flys, fly: Object.fromEntries(flys.map((f) => [f.dataset.key, f])),
      pill: $('.s6__pill', sec), roll: $('.s6__roll', sec),
      title: $('.s6__title', sec), sub: $('.s6__sub', sec), subLines: $$('.s6__sub .ln', sec), eyebrow: $('.s6__eyebrow', sec),
    };
  }

  // slot geometry in pin coordinates (px). S2 = main panel, S1 = waiting tile, S3 = previous tile;
  // S0 / S4 are S1 / S3 shifted one more step along the diagonal (off the frame).
  function geometry(desk, P, K) {
    const k = K(), W = P.pin.clientWidth, G = {};
    if (desk) {
      const col = Math.round(W * 0.33), Hh = P.pin.clientHeight;
      const S2 = { x: col + 8 * k, y: 8 * k, w: col - 16 * k, h: Hh - 16 * k }, tw = 90 * k, th = 160 * k;
      G.main = [S2, S2, S2];
      G.S1 = { x: S2.x + S2.w + 8 * k, y: S2.y + S2.h - th, w: tw, h: th };
      G.S3 = { x: S2.x - 8 * k - tw, y: S2.y, w: tw, h: th };
      G.in = { x: 98 * k, y: 176 * k };
      G.out = { x: -98 * k, y: -176 * k };
      G.tileY = G.main.map((m) => -(m.h - th) / 2); // a tile shows the panel's left strip at mid-height (Paper)
    } else {
      const A = P.stage.clientHeight, pk = 20 * k, gap = 8 * k;
      G.main = [{ x: 0, y: 0, w: W, h: A - pk - gap }, { x: 0, y: pk + gap, w: W, h: A - 2 * (pk + gap) }, { x: 0, y: pk + gap, w: W, h: A - pk - gap }];
      G.S1 = { x: 0, y: A - pk, w: W, h: pk };
      G.S3 = { x: 0, y: 0, w: W, h: pk };
      G.in = { x: 0, y: pk + gap };
      G.out = { x: 0, y: -(pk + gap) };
      G.tileY = G.main.map((m) => -(m.h - pk) / 2);
    }
    // how far a card travels to leave the frame on the right
    G.cardOut = G.main.map((m) => W - (m.x + (m.w - 340 * k) / 2) + 40 * k);
    return G;
  }

  // a line that rolls to the next label inside a feathered mask (Lassie's ticker, Collins's 2px blur)
  function roller(gsap, el) {
    const lines = Array.from(el.querySelectorAll('.rl'));
    let cur = 0;
    gsap.set(lines, { yPercent: (i) => (i ? 110 : 0), autoAlpha: (i) => (i ? 0 : 1) });
    return (to, instant) => {
      if (to === cur) return;
      const dir = to > cur ? 1 : -1, a = lines[cur], b = lines[to];
      cur = to;
      lines.forEach((l, i) => l.setAttribute('aria-hidden', i === to ? 'false' : 'true'));
      if (instant) { gsap.set(lines, { yPercent: (i) => (i === to ? 0 : 110), autoAlpha: (i) => (i === to ? 1 : 0), filter: 'none' }); return; }
      gsap.to(a, { yPercent: -110 * dir, autoAlpha: 0, filter: 'blur(2px)', duration: 0.5, ease: 'expo.out', overwrite: true });
      gsap.fromTo(b, { yPercent: 110 * dir, autoAlpha: 0, filter: 'blur(2px)' }, { yPercent: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 0.75, ease: 'expo.out', overwrite: true });
    };
  }

  // hover: the visible cards fan like a dock under the pointer (section 2's fan, for whichever subset is dealt)
  function fan(H, P) {
    const { gsap, R, K } = H;
    if (!R.fine || R.reduce || state.wired) return;
    state.wired = true;
    const to = Object.fromEntries(P.flys.map((f) => [f.dataset.key, gsap.quickTo(f.firstElementChild, 'y', { duration: 0.55, ease: 'power3' })]));
    const rest = () => Object.values(to).forEach((t) => t(0));
    P.stack.addEventListener('pointermove', (e) => {
      if (state.busy) { rest(); return; }
      const keys = SETS[state.hosp], n = keys.length;
      const r = P.stack.getBoundingClientRect(), step = 38 * K(), top = r.top + 19 * (ORDER.length - n) * K();
      const at = Math.min(n - 1, Math.max(0, (e.clientY - top) / step - 0.5));
      keys.forEach((k, i) => to[k](-Math.max(0, 1 - Math.abs(i - at) / 2.2) * 10 * K() - (i < at ? 3 * K() : 0)));
    });
    P.stack.addEventListener('pointerleave', rest);
  }

  function init(desk, H) {
    const { gsap, ST, R, K, MB, pillIn, walletIn, standOnEnter, riseOnEnter, split } = H;
    const P = parts(H); if (!P) return;
    const { sec, pin, deck, frames, imgs, shades, fly, flys } = P;
    let G = geometry(desk, P, K);
    const measure = () => {
      G = geometry(desk, P, K);
      frames.forEach((f, i) => gsap.set(imgs[i], { width: G.main[i].w, height: G.main[i].h }));
      if (desk) gsap.set(deck, { left: G.main[0].x, top: G.main[0].y, width: G.main[0].w, height: G.main[0].h });
    };
    measure();
    ST.addEventListener('refreshInit', measure);

    const box = (get) => ({ left: () => get().x, top: () => get().y, width: () => get().w, height: () => get().h });
    const main = (i) => box(() => G.main[i]);
    const S1 = box(() => G.S1), S3 = box(() => G.S3);
    gsap.set(flys, { yPercent: (i, el) => dy(0, el.dataset.key) });

    /* ---------- arrival: the copy stands up, the pill grows out of its avatar, the stack fans up ---------- */
    standOnEnter(split(P.title), P.title, 'top 85%');
    if (desk) riseOnEnter([P.eyebrow], P.eyebrow, 'top 92%', 0.1);
    riseOnEnter(P.subLines, P.sub, 'top 92%', 0.3);
    const pi = pillIn(P.pill), wi = walletIn(P.stack);
    ST.create({ trigger: P.pill, start: 'top 88%', once: true, onEnter: () => pi.play() });
    ST.create({ trigger: P.stack, start: 'top 85%', once: true, onEnter: () => wi.play() });
    fan(H, P);
    flys.forEach((f) => { if (!blurred.has(f)) { blurred.add(f); MB(f, f.firstElementChild, { max: 4, gain: 0.12 }); } });
    // the small tiles travel fast between slots (x/y); the main panel never moves that way, so it stays crisp
    frames.forEach((f) => { if (!blurred.has(f)) { blurred.add(f); MB(f, f.firstElementChild, { max: 3, gain: 0.1 }); } });
    // while the section arrives, the waiting tile slides up into its slot and the first panel's image settles
    gsap.fromTo(frames[1], { x: () => G.in.x, y: () => G.in.y }, { x: 0, y: 0, ease: 'none', scrollTrigger: { trigger: pin, start: 'top 85%', end: 'top top', scrub: true, invalidateOnRefresh: true } });
    gsap.fromTo(imgs[0], { yPercent: 2.5, scale: 1.06 }, { yPercent: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: pin, start: 'top bottom', end: 'top top', scrub: true } });

    /* ---------- the label and the theme are fired, with a little hysteresis ---------- */
    const roll = roller(gsap, P.roll);
    let lbl = 0, dark = false;
    const UP = [0.245, 0.675], DOWN = [0.225, 0.655];
    const setDark = (on) => { if (on === dark) return; dark = on; gsap.to(sec, { '--dk': on ? 1 : 0, duration: 0.9, ease: 'sine.inOut', overwrite: 'auto' }); };
    const sync = (self) => {
      const p = self.progress; state.p = p;
      while (lbl < 2 && p >= UP[lbl]) lbl++;
      while (lbl > 0 && p < DOWN[lbl - 1]) lbl--;
      roll(lbl);
      if (!dark && p >= 0.64) setDark(true); else if (dark && p < 0.58) setDark(false);
      state.busy = (p > 0.075 && p < 0.44) || (p > 0.5 && p < 0.865);
      const h = p < 0.3 ? 0 : p < 0.7 ? 1 : 2;
      if (h !== state.hosp || !self.__a11y) { self.__a11y = true; flys.forEach((f) => f.setAttribute('aria-hidden', String(!SETS[h].includes(f.dataset.key)))); }
      state.hosp = h;
    };

    /* ---------- the pinned scene: 6a → 6b → 6c ---------- */
    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + innerHeight * 2.5, pin, scrub: 0.35, invalidateOnRefresh: true, onUpdate: sync, onRefresh: sync } });
    tl.to({}, { duration: 1 }, 0); // timeline length 1: 0–.07 rests on 6a, .43–.50 on 6b, .86–1 on 6c
    const SH0 = '0px 0px 0px 0px rgba(28, 18, 8, 0)', SH1 = desk ? '0px 34px 80px 0px rgba(28, 18, 8, 0.30)' : SH0;
    const IN = 0.2; // a panel's grow / shrink

    // one hospital hands over to the next, starting at t
    function handover(t, from, to) {
      const next = frames[to], prev = frames[from];
      // the next panel grows out of its tile over the current one; its image settles from a slight zoom
      tl.fromTo(next, S1, { ...main(to), duration: IN, ease: 'power2.inOut', immediateRender: true }, t)
        .fromTo(imgs[to], { y: () => G.tileY[to], scale: 1.08 }, { y: 0, scale: 1, duration: IN, ease: 'power2.inOut', immediateRender: true }, t);
      if (desk) {
        tl.fromTo(next, { boxShadow: SH0 }, { boxShadow: SH1, duration: IN / 2, ease: 'power1.out', immediateRender: false }, t)
          .to(next, { boxShadow: SH0, duration: IN / 2, ease: 'power1.in' }, t + IN / 2)
          // the current one darkens as it goes under, then slides out from under the new one into the top-left tile
          .fromTo(shades[from], { opacity: 0 }, { opacity: 0.22, duration: 0.14, ease: 'power1.in', immediateRender: true }, t + 0.06)
          .to(shades[from], { opacity: 0, duration: 0.14, ease: 'power1.out' }, t + IN)
          .fromTo(prev, main(from), { ...S3, duration: 0.14, ease: 'power2.inOut', immediateRender: from === 0 }, t + IN)
          .fromTo(imgs[from], { y: 0 }, { y: () => G.tileY[from], duration: 0.14, ease: 'power2.inOut', immediateRender: from === 0 }, t + IN);
      } else {
        // phone: the two move together like a column with an 8px gutter; the old one collapses to the top sliver
        tl.fromTo(prev, main(from), { ...S3, duration: IN, ease: 'power2.inOut', immediateRender: from === 0 }, t)
          .fromTo(imgs[from], { y: 0 }, { y: () => G.tileY[from], duration: IN, ease: 'power2.inOut', immediateRender: from === 0 }, t)
          .fromTo(deck, main(from), { ...main(to), duration: IN, ease: 'power2.inOut', immediateRender: from === 0 }, t);
      }
    }

    // ---- 6a → 6b
    const a = 0.07;
    handover(a, 0, 1);
    // the tile after next slides up into the waiting slot
    tl.fromTo(frames[2], { x: () => G.in.x, y: () => G.in.y }, { x: 0, y: 0, duration: 0.14, ease: 'power3.out', immediateRender: true }, desk ? a + 0.21 : a + 0.04);
    // Hospital 2 doesn't ask for these: front to back, each slides out from behind the cards in front of it
    LEAVE_A.forEach((k, i) => {
      const t = a + 0.05 + i * 0.018; // one gesture, front card first
      tl.fromTo(fly[k], { x: 0 }, { x: () => G.cardOut[0], duration: 0.1, ease: 'power2.in', immediateRender: true }, t); // ends past the pin's edge
    });
    // the cards that stay keep their place and close ranks around the new centre
    SETS[1].forEach((k) => tl.fromTo(fly[k], { yPercent: dy(0, k) }, { yPercent: dy(1, k), duration: 0.1, ease: 'power2.inOut', immediateRender: true }, a + 0.13));

    // ---- 6b → 6c
    const b = 0.5;
    handover(b, 1, 2);
    // the first hospital's tile moves on, up and out of the frame
    tl.fromTo(frames[0], { x: 0, y: 0 }, { x: () => G.out.x, y: () => G.out.y, duration: desk ? 0.12 : IN, ease: desk ? 'power2.in' : 'power2.inOut', immediateRender: true }, desk ? b + 0.04 : b);
    // Hospital 3 asks for the board certification again: the cascade opens a slot and the card slides back in
    SETS[1].forEach((k) => tl.fromTo(fly[k], { yPercent: dy(1, k) }, { yPercent: dy(2, k), duration: 0.1, ease: 'power2.inOut', immediateRender: false }, b + 0.12));
    tl.fromTo(fly.fnp, { x: () => G.cardOut[2] }, { x: 0, duration: 0.13, ease: 'power3.out', immediateRender: false }, b + 0.17);
  }

  // reduced motion: 6c, unpinned
  function reduce(desk, H) {
    const { gsap, ST, K } = H;
    const P = parts(H); if (!P) return;
    const place = () => {
      const G = geometry(desk, P, K);
      const set = (el, s) => gsap.set(el, { left: s.x, top: s.y, width: s.w, height: s.h, x: 0, y: 0 });
      P.frames.forEach((f, i) => gsap.set(P.imgs[i], { width: G.main[i].w, height: G.main[i].h }));
      set(P.frames[2], G.main[2]);
      set(P.frames[1], G.S3); gsap.set(P.imgs[1], { y: G.tileY[1] });
      gsap.set(P.frames[0], { autoAlpha: 0 });
      set(P.deck, G.main[2]);
      P.flys.forEach((f) => {
        const k = f.dataset.key, on = SETS[2].includes(k);
        gsap.set(f, { yPercent: on ? dy(2, k) : 0, autoAlpha: on ? 1 : 0 });
      });
    };
    place();
    ST.addEventListener('refresh', place);
    roller(gsap, P.roll)(2, true);
    gsap.set(P.sec, { '--dk': 1 });
  }

  (window.RovnHomeSections = window.RovnHomeSections || []).push({ name: 'career', init, reduce });
})();
