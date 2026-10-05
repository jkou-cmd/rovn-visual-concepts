/* Rōvn home · 5 · Each department knows what happens next.
   One pin, four beats, all scrubbed; the headline never moves.
   5.1  the statement alone (it stood up on arrival).
   5.2a five department photos come in from beyond the edges, small, tilted and out of focus;
   5.2b they swirl clockwise along curved paths, growing, coming into focus and forward;
   5.2c they settle upright, ringed around the statement, and Renée's pill grows in under it.
   The swirl is Lassie's orbit collage (INVENTORY §6): every photo moves on an ellipse around the statement,
   its angle and radius eased through Jerry's three keyframes (Paper 5.2a/b/c; the ring turns about 55°
   clockwise as it closes), and the photo inside each frame zooms from 2× to 1× (max(1, 2 − 1.5p)).
   Motion blur comes from speed (H.MB on the wrapper, blur on its child). Photos only, no text on them.
   Registers with home.js (see home/sections/BRIEF.md). */
(function () {
  const live = { desk: false };

  // Storyboard keyframes per photo: centre x, centre y, scale of the 5.2c size, tilt (deg).
  // The swirl centre is the middle of the statement; q is the ellipse's height / width. `avoid` is the
  // statement's box (headline, sub and pill, padded): a photo passing it slides around it, never over it.
  const DESK = { cx: 720, cy: 459, x0: 720, y0: 450, q: 0.625, avoid: [[476, 300, 964, 606]], sats: {
    recruiting:    { a: [60, 560, 0.433, -10],  b: [102, 281, 0.74, -5],  c: [330, 200] },
    hr:            { a: [459, 40, 0.468, 8],    b: [950, 60, 0.74, 4],    c: [1072, 172] },
    occhealth:     { a: [1168, 135, 0.48, -8],  b: [1299, 367, 0.74, -4], c: [1212, 500] },
    credentialing: { a: [1395, 560, 0.443, 10], b: [1167, 726, 0.74, 5],  c: [930, 752] },
    training:      { a: [800, 868, 0.499, -6],  b: [399, 796, 0.74, -3],  c: [302, 656] },
  } };
  const PHONE = { cx: 195, cy: 461, x0: 195, y0: 444, q: 2.16, avoid: [[24, 343, 366, 499], [86, 518, 304, 579]], sats: {
    recruiting:    { a: [20, 640, 0.52, -10], b: [36, 290, 0.74, -5],  c: [88, 168] },
    occhealth:     { a: [14, 288, 0.52, 8],   b: [90, 140, 0.74, 4],   c: [196, 272] },
    hr:            { a: [70, 122, 0.52, 10],  b: [252, 150, 0.74, 5],  c: [306, 162] },
    training:      { a: [370, 800, 0.52, -8], b: [212, 770, 0.74, -4], c: [86, 672] },
    credentialing: { a: [372, 300, 0.52, 9],  b: [352, 600, 0.74, 4],  c: [300, 702] },
  } };
  // where on the journey each keyframe sits: in from beyond the edge (0), 5.2a, 5.2b, 5.2c (1)
  const U = [0, 0.3, 0.64, 1];
  // depth of field: blur as a share of the frame's shown width. 5.2a matches the -blur stills
  // (gaussian ≈ 1.25% of the width, numerically fitted); sharp from 5.2b on.
  const F = [0.024, 0.0125, 0, 0];
  // the photo inside each frame: 2× as it enters, easing to 1× by 5.2b (≈1.28× at 5.2a, so Jerry's framing holds)
  const zoom = (u) => 1 + Math.pow(Math.max(0, 1 - u / U[2]), 2);

  // monotone cubic (Fritsch–Carlson) through (U, v): smooth, never overshoots a keyframe. Photos come in
  // already moving and settle into 5.2c (zero slope at the end), so the scroll drives u linearly.
  function curve(v) {
    const n = U.length, d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((v[i + 1] - v[i]) / (U[i + 1] - U[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    m[n - 1] = 0;
    return (u) => {
      if (u <= U[0]) return v[0];
      if (u >= U[n - 1]) return v[n - 1];
      let i = 0; while (u > U[i + 1]) i++;
      const hgt = U[i + 1] - U[i], t = (u - U[i]) / hgt, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * v[i] + (t3 - 2 * t2 + t) * hgt * m[i] + (-2 * t3 + 3 * t2) * v[i + 1] + (t3 - t2) * hgt * m[i + 1];
    };
  }

  // A small hover for the photos: they lean toward the pointer with a soft glare, at once.
  function lean(H, sat) {
    const { gsap } = H;
    const tgt = sat.querySelector('.sat__mb'), frame = sat.querySelector('.sat__frame');
    const g = document.createElement('span'); g.className = 'card__glare'; g.setAttribute('aria-hidden', 'true'); frame.append(g);
    const rx = gsap.quickTo(tgt, 'rotationX', { duration: 0.6, ease: 'power3' });
    const ry = gsap.quickTo(tgt, 'rotationY', { duration: 0.6, ease: 'power3' });
    const sc = gsap.quickTo(tgt, 'scale', { duration: 0.5, ease: 'power3' });
    const gx = gsap.quickTo(g, 'xPercent', { duration: 0.5, ease: 'power3' });
    const gy = gsap.quickTo(g, 'yPercent', { duration: 0.5, ease: 'power3' });
    sat.addEventListener('pointermove', (e) => {
      if (!live.desk) return;
      const r = sat.getBoundingClientRect(), u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5;
      ry(u * 12); rx(-v * 12); gx(u * 60); gy(v * 60);
    });
    sat.addEventListener('pointerenter', () => { if (!live.desk) return; sc(1.035); gsap.to(g, { opacity: 1, duration: 0.3, overwrite: 'auto' }); });
    sat.addEventListener('pointerleave', () => { rx(0); ry(0); sc(1); gsap.to(g, { opacity: 0, duration: 0.5, overwrite: 'auto' }); });
  }

  const S = { name: 'departments' };

  S.init = function (desk, H) {
    const { gsap, ST, R, $, $$, K } = H;
    const sec = $('.depts'); if (!sec) return;
    live.desk = desk;
    const pin = $('.depts__pin', sec), title = $('.depts__title', sec), eyebrow = $('.depts__eyebrow', sec);
    const subLines = $$('.depts__sub .ln', sec), pill = $('.depts__pill', sec);
    const B = desk ? DESK : PHONE;

    // ---- arrival: the statement stands up word by word, then holds perfectly still
    const have = $$('.split-word', title), words = have.length ? have : H.split(title);
    if (desk) H.riseOnEnter([eyebrow], eyebrow, 'top 92%', 0);
    H.standOnEnter(words, title, 'top 86%');
    H.riseOnEnter(subLines, title, 'top 86%', 0.3);

    // ---- the photos: polar keyframes around the statement (angles unwrapped so the ring only turns clockwise)
    const polar = (x, y) => [Math.atan2((y - B.cy) / B.q, x - B.cx), Math.hypot(x - B.cx, (y - B.cy) / B.q)];
    // decode the photos now: they enter from beyond the edge, where the browser would otherwise decode them
    // late and show an empty frame for a few frames
    $$('.sat__img', sec).forEach((img) => { if (img.decode) img.decode().catch(() => {}); });
    const sats = $$('.sat', sec).map((el) => {
      const k = B.sats[el.dataset.sat];
      const [pa, ra] = polar(k.a[0], k.a[1]); let [pb, rb] = polar(k.b[0], k.b[1]); let [pc, rc] = polar(k.c[0], k.c[1]);
      while (pb <= pa) pb += Math.PI * 2; while (pc <= pb) pc += Math.PI * 2;
      const w = parseFloat(getComputedStyle(el).width) / K(), h = parseFloat(getComputedStyle(el).height) / K();
      const sat = { el, img: $('.sat__img', el), k, w, h, pa, ra, pb, rb, pc, rc, pre: null, key: '' };
      if (!el.__s5mb) { el.__s5mb = true; H.MB(el, $('.sat__mb', el), { max: 3, gain: 0.08 }); }
      return sat;
    });

    // Where each photo starts: 24° further back along its turn, pushed out until it is wholly outside the
    // frame (so it comes in from beyond the edge rather than appearing). Re-solved when the viewport changes.
    const solve = (s) => {
      const k = K(), key = innerWidth + 'x' + pin.clientHeight + 'x' + k.toFixed(4);
      if (s.key === key) return;
      s.key = key;
      const Wv = innerWidth / k, Hv = pin.clientHeight / k;
      const L = B.x0 - Wv / 2, Rt = B.x0 + Wv / 2, T = B.y0 - Hv / 2, Bt = B.y0 + Hv / 2;
      const ph = s.pa - (24 * Math.PI) / 180, sc = s.k.a[2] * 0.85, rad = (sc * Math.hypot(s.w, s.h)) / 2 + 6;
      let rr = s.ra * 1.08;
      for (let i = 0; i < 400; i++, rr += 6) {
        const x = B.cx + rr * Math.cos(ph), y = B.cy + B.q * rr * Math.sin(ph);
        if (x + rad < L || x - rad > Rt || y + rad < T || y - rad > Bt) break;
      }
      s.pre = { ph, rr, sc, tilt: s.k.a[3] * 1.6 };
      s.fp = curve([ph, s.pa, s.pb, s.pc]);
      s.fr = curve([rr, s.ra, s.rb, s.rc]);
      s.fs = curve([sc, s.k.a[2], s.k.b[2], 1]);
      s.ft = curve([s.pre.tilt, s.k.a[3], s.k.b[3], 0]);
      s.ff = curve(F);
    };

    // true if a photo centred at (x, y), at scale sc and tilt deg, would touch the statement
    const touches = (s, x, y, sc, deg) => {
      const t = (deg * Math.PI) / 180, hw = (s.w * sc) / 2, hh = (s.h * sc) / 2;
      const ex = Math.abs(hw * Math.cos(t)) + Math.abs(hh * Math.sin(t)), ey = Math.abs(hw * Math.sin(t)) + Math.abs(hh * Math.cos(t));
      return B.avoid.some((E) => !(x + ex < E[0] || x - ex > E[2] || y + ey < E[1] || y - ey > E[3]));
    };

    const place = (u) => {
      const k = K(), z = zoom(u);
      sats.forEach((s) => {
        solve(s);
        const ph = s.fp(u), f = Math.max(0, s.ff(u)), sc = s.fs(u), deg = s.ft(u);
        let rr = s.fr(u), x, y;
        for (let i = 0; i < 120; i++, rr += 1.5) {   // slide around the statement, along the swirl's own ray
          x = B.cx + rr * Math.cos(ph); y = B.cy + B.q * rr * Math.sin(ph);
          if (!touches(s, x, y, sc, deg)) break;
        }
        gsap.set(s.el, { x: (x - s.k.c[0]) * k, y: (y - s.k.c[1]) * k, scale: sc, rotation: deg });
        // the blur is set inside the zoomed photo, so it is divided by the zoom to land at f × the frame's width
        gsap.set(s.img, { scale: z, filter: f > 0.0003 ? `blur(${((f * s.w * k) / z).toFixed(2)}px)` : 'none' });
      });
    };

    const st = { u: 0 };
    place(0);
    const pp = H.pillIn(pill); pp.paused(false);

    const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + innerHeight * (desk ? 2.4 : 2.2), pin, scrub: 0.35, invalidateOnRefresh: true,
      onRefresh: () => place(st.u) } });
    tl.to({}, { duration: 1 }, 0)
      // 5.1 holds; the photos swirl in through 5.2a and 5.2b and settle at 5.2c
      .fromTo(st, { u: 0 }, { u: 1, duration: 0.78, ease: 'none', onUpdate: () => place(st.u) }, 0.06)
      // together: Renée's pill grows out of her photo
      .add(pp.timeScale(pp.duration() / 0.1), 0.84);

    // ---- hover (desktop, fine pointers): a photo leans toward the pointer
    if (!R.fine || R.reduce) return;
    gsap.set($$('.sat__mb', sec), { transformPerspective: 700 });
    sats.forEach((s) => { if (!s.el.__s5lean) { s.el.__s5lean = true; lean(H, s.el); } });
  };

  // Reduced motion: the CSS already lays the photos out together with the pill shown; nothing is pinned.
  S.reduce = function () {};

  (window.RovnHomeSections = window.RovnHomeSections || []).push(S);
})();
