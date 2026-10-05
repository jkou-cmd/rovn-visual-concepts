/* Rōvn home · 4 · Agents do the follow-through.
   One pin, three beats (4a → 4b → 4c), all scrubbed:
   - the copy stands up on arrival and then holds still while the right column changes;
   - Quarrystone's log fills in first: the card rises, and each step is logged into it (the row opens,
     its check draws, its date settles); the live step's amber dot lands and breathes;
   - the frames morph: Quarrystone's window closes from below while Renée's opens from her 64px peek;
     Renée's pill grows out of its tile and her log fills in the same way;
   - Quarrystone's window closes to a sliver; what's in it rides up with its closing edge and slips out
     under the top of the frame (nothing fades, nothing is cut by an invisible line).
   Phones follow M · 4a–4c: the same beats in a stacked column with a 20px peek and sliver.
   Registers with home.js (see home/sections/BRIEF.md). */
(function () {
  // Hover bindings are made once and read this, so a breakpoint change never doubles them up.
  const live = { desk: false };

  function words(H, el) {
    const have = H.$$('.split-word', el);
    return have.length ? have : H.split(el);
  }

  function logParts(H, log) {
    return {
      log,
      card: H.$('.log__rows', log),
      rows: H.$$('.log__row', log).map((row) => ({
        row,
        check: H.$('.log__check path', row),
        text: H.$('.log__text', row),
        date: H.$('.log__date', row),
        dot: H.$('.log__dot', row),
        who: H.$('.log__av', row),
      })),
    };
  }

  // A log fills in at `at`: the card slides up out from behind its window's bottom edge (opaque, never
  // faded in) with its first step, then each step opens below the last (the card grows with it), its
  // check draws, its line rises and its date settles.
  const below = (H, desk) => () => (desk ? 8 + 40 + 8 + 32 : 6 + 36 + 6 + 16) * H.K() + 6;
  function fill(H, tl, P, at, step, desk) {
    const { K } = H;
    tl.fromTo(P.log, { y: below(H, desk), rotationX: 18 }, { y: 0, rotationX: 0, duration: 0.06, ease: 'power3.out' }, at);
    P.rows.forEach((r, i) => {
      const open = at + 0.006 + i * step;
      if (i) tl.fromTo(r.row, { '--o': 0 }, { '--o': 1, duration: 0.026, ease: 'power2.inOut' }, open);
      // the first step arrives with the card (never an empty card); later ones once their row has opened
      const land = i ? open + 0.014 : at + 0.002;
      if (r.check) tl.set(r.check, { opacity: 1 }, land).fromTo(r.check, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.022, ease: 'power1.inOut' }, land);
      tl.fromTo(r.text, { autoAlpha: 0, y: () => 8 * K(), filter: 'blur(4px)' }, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.026, ease: 'power2.out' }, land);
      if (r.date) tl.fromTo(r.date, { autoAlpha: 0, y: () => -6 * K() }, { autoAlpha: 1, y: 0, duration: 0.022, ease: 'power2.out' }, land + 0.01);
      if (r.dot) tl.fromTo(r.dot, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.022, ease: 'back.out(3)' }, land + 0.004);
      if (r.who) tl.fromTo(r.who, { autoAlpha: 0, scale: 0.5 }, { autoAlpha: 1, scale: 1, duration: 0.026, ease: 'back.out(2.2)' }, land + 0.012);
    });
  }

  function hide(H, P, desk) {
    const { gsap } = H;
    gsap.set(P.log, { y: below(H, desk)(), rotationX: 18, transformPerspective: 900, transformOrigin: '50% 100%' });
    P.rows.forEach((r, i) => {
      gsap.set(r.row, { '--o': i ? 0 : 1 });
      if (r.check) gsap.set(r.check, { opacity: 0, strokeDashoffset: 1 });
      gsap.set(r.text, { autoAlpha: 0 });
      if (r.date) gsap.set(r.date, { autoAlpha: 0 });
      if (r.dot) gsap.set(r.dot, { autoAlpha: 0, scale: 0 });
      if (r.who) gsap.set(r.who, { autoAlpha: 0, scale: 0.5 });
    });
  }

  const S = { name: 'agents' };

  S.init = function (desk, H) {
    const { gsap, ST, R, $, $$, K } = H;
    const sec = $('.agents'); if (!sec) return;
    live.desk = desk;
    const pin = $('.agents__pin', sec), col = $('.agents__col', sec);
    const qs = $('.agent--qs', sec), rn = $('.agent--rn', sec);
    const qsImg = $('.panel__img', qs), rnImg = $('.panel__img', rn);
    const qsPill = $('.agent__pill', qs), rnPill = $('.agent__pill', rn);
    const Q = logParts(H, $('.log', qs)), N = logParts(H, $('.log', rn));
    const title = $('.agents__title', sec), eyebrow = $('.agents__eyebrow', sec);
    const subLines = $$('.agents__sub .ln', sec);

    // ---- arrival: the copy stands up and then stays put; Quarrystone's pill grows out of its tile
    if (desk) H.riseOnEnter([eyebrow], eyebrow, 'top 92%', 0);
    H.standOnEnter(words(H, title), title, 'top 86%');
    H.riseOnEnter(subLines, title, 'top 86%', 0.3);
    const qp = H.pillIn(qsPill);
    ST.create({ trigger: qsPill, start: 'top 90%', once: true, onEnter: () => qp.play() });
    // the photos drift into place as the section comes up (the pin holds them afterwards)
    gsap.fromTo([qsImg, rnImg], { yPercent: 4 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: pin, start: 'top bottom', end: 'top top', scrub: true } });

    hide(H, Q, desk); hide(H, N, desk);
    gsap.set(qs, { '--hov': '0px' });
    gsap.set([Q.card, N.card], { transformPerspective: 900 });

    // ---- the pin: 4a → 4b → 4c
    const gap = () => 8 * K();
    const inner = () => col.clientHeight - (desk ? 16 : 0) * K();
    const peek = () => (desk ? 64 : 20) * K();
    const full = () => inner() - gap() - peek();
    const half = () => (inner() - gap()) / 2;

    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + innerHeight * (desk ? 2.4 : 2.2), pin, scrub: 0.35, invalidateOnRefresh: true } });
    tl.to({}, { duration: 1 }, 0);

    // 4a: Quarrystone's agent has the column; its log fills in
    fill(H, tl, Q, 0.04, 0.03, desk);

    // 4a → 4b: the frames morph to halves. Renée's pill grows in once her window has room, then her log fills.
    tl.fromTo(qs, { '--h': () => full() + 'px' }, { '--h': () => half() + 'px', duration: 0.23, ease: 'power2.inOut' }, 0.27);
    const rp = H.pillIn(rnPill); rp.paused(false);
    tl.add(rp.timeScale(rp.duration() / 0.12), 0.36);
    fill(H, tl, N, 0.42, 0.03, desk);

    // 4b → 4c: Quarrystone's window closes to a sliver. Its log stays docked to the closing edge, pushes the
    // pill up and out under the top of the frame, and slips out after it, tipping back as it goes;
    // Renée's window takes the column.
    tl.to(qs, { '--h': () => peek() + 'px', duration: 0.24, ease: 'power2.inOut' }, 0.64)
      .fromTo(Q.log, { y: 0, rotationX: 0 }, { y: () => -48 * K(), rotationX: 16, duration: 0.24, ease: 'power2.in', immediateRender: false }, 0.64);

    // parallax inside the windows: Renée's photo settles as her window opens, Quarrystone's drifts up as it closes
    tl.fromTo(rnImg, { scale: 1.08, y: () => 28 * K() }, { scale: 1, y: 0, duration: 0.61, ease: 'power1.inOut' }, 0.27)
      .fromTo(qsImg, { y: 0 }, { y: () => -28 * K(), duration: 0.61, ease: 'power1.inOut' }, 0.27);

    // ---- hovers (desktop, fine pointers): the hovered window opens a little and its neighbour gives way;
    // a log tips toward the pointer; a soft highlight follows the step under it
    if (!R.fine || R.reduce) return;
    if (!sec.__s4hover) {
      sec.__s4hover = true;
      const nudge = (v) => { if (live.desk) gsap.to(qs, { '--hov': v * K() + 'px', duration: 0.6, ease: 'expo.out', overwrite: 'auto' }); };
      qs.addEventListener('pointerenter', () => nudge(28));
      rn.addEventListener('pointerenter', () => nudge(-28));
      col.addEventListener('pointerleave', () => nudge(0));
      [Q, N].forEach((P) => { R.glider(P.card, P.rows.map((r) => r.row), { kind: 'cell' }); H.tilt(P.card, { max: 4, glare: false }); });
    }
  };

  // Reduced motion: the CSS already rests at 4b with both logs complete; nothing is pinned.
  S.reduce = function () {};

  (window.RovnHomeSections = window.RovnHomeSections || []).push(S);
})();
